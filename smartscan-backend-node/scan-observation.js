const crypto = require('crypto');

function distanceKm(aLat, aLon, bLat, bLon) {
  const radians = degrees => degrees * Math.PI / 180;
  const a = Math.sin(radians(bLat - aLat) / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(radians(bLon - aLon) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}

async function recordObservation(pool, { eventId, serialNumber, contractAddress, visitorHash, outcome, latitude, longitude, purpose = 'unspecified', flags: initialFlags = [] }) {
  const hasLocation = latitude !== undefined;
  const lat = hasLocation ? Number(latitude.toFixed(2)) : null;
  const lon = hasLocation ? Number(longitude.toFixed(2)) : null;
  // Do not bind retries to IP: mobile networks can change between attempts.
  const digest = crypto.createHash('sha256').update(JSON.stringify([serialNumber, contractAddress, latitude ?? null, longitude ?? null, purpose])).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (eventId) {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`scan-event:${eventId}`]);
      const previous = await client.query('SELECT request_digest, flags FROM product_scans WHERE event_id = $1', [eventId]);
      if (previous.rows.length) {
        if (previous.rows[0].request_digest !== digest) {
          const error = new Error('This scan event ID was already used for a different request'); error.status = 409; throw error;
        }
        await client.query('COMMIT');
        return { flags: previous.rows[0].flags, replayed: true };
      }
    }
    // Serialize observations for one contract/serial so concurrent counts are reliable.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`scan-subject:${contractAddress}:${serialNumber}`]);
    const flags = [...initialFlags];
    const prior = hasLocation ? await client.query('SELECT latitude, longitude FROM product_scans WHERE serial_number = $1 AND contract_address IS NOT DISTINCT FROM $2 AND outcome = \'valid\' AND scanned_at > now() - interval \'1 hour\' AND latitude IS NOT NULL ORDER BY scanned_at DESC LIMIT 50', [serialNumber, contractAddress]) : { rows: [] };
    if (outcome === 'valid' && prior.rows.some(row => distanceKm(lat, lon, Number(row.latitude), Number(row.longitude)) > 100)) flags.push('suspicious_location');
    const frequency = await client.query('SELECT count(*)::int AS count FROM product_scans WHERE serial_number = $1 AND contract_address IS NOT DISTINCT FROM $2 AND outcome = \'valid\' AND scanned_at > now() - interval \'10 minutes\'', [serialNumber, contractAddress]);
    if (outcome === 'valid' && Number(frequency.rows[0]?.count || 0) + 1 >= 10) flags.push('unusual_frequency');
    await client.query('INSERT INTO product_scans (serial_number, contract_address, visitor_hash, outcome, latitude, longitude, location_source, flags, event_id, request_digest, scan_purpose) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [serialNumber, contractAddress, visitorHash, outcome, lat, lon, hasLocation ? 'browser_reported' : 'not_provided', flags, eventId || null, digest, purpose]);
    await client.query('COMMIT');
    return { flags, replayed: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

module.exports = { recordObservation };
