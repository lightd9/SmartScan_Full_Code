const DELETE_EXPIRED_SCAN_BATCH = `
  WITH expired_batch AS (
    SELECT id
    FROM product_scans
    WHERE scanned_at < now() - ($1::integer * interval '1 day')
    ORDER BY scanned_at, id
    LIMIT $2
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM product_scans AS scans
  USING expired_batch
  WHERE scans.id = expired_batch.id
`;

async function deleteExpiredScans(pool, retentionDays, batchSize = 5000) {
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 1 || retentionDays > 36500) {
    throw new Error('SCAN_RETENTION_DAYS must be an integer from 1 to 36500');
  }
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 50000) {
    throw new Error('SCAN_RETENTION_BATCH_SIZE must be an integer from 1 to 50000');
  }
  let deleted = 0;
  while (true) {
    const result = await pool.query(DELETE_EXPIRED_SCAN_BATCH, [retentionDays, batchSize]);
    const batchCount = Number(result.rowCount || 0);
    deleted += batchCount;
    if (batchCount < batchSize) return deleted;
  }
}

module.exports = { DELETE_EXPIRED_SCAN_BATCH, deleteExpiredScans };
