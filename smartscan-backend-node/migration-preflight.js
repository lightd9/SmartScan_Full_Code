const REQUIRED_TABLES = ['auth', 'profile', 'product'];

const CHECKS = [
  ['auth rows with null ids', `SELECT id AS key, count(*)::int AS occurrences FROM auth WHERE id IS NULL GROUP BY id LIMIT 10`, true],
  ['duplicate auth ids', `SELECT id::text AS key, count(*)::int AS occurrences FROM auth WHERE id IS NOT NULL GROUP BY id HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 10`, true],
  ['duplicate auth usernames', `SELECT username AS key, count(*)::int AS occurrences FROM auth GROUP BY username HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 10`, true],
  ['null auth usernames', `SELECT id::text AS key, 1 AS occurrences FROM auth WHERE username IS NULL LIMIT 10`, true],
  ['invalid auth roles', `SELECT username AS key, 1 AS occurrences FROM auth WHERE role IS NULL OR role NOT IN ('admin', 'manufacturer', 'supplier', 'retailer') LIMIT 10`, true],
  ['duplicate profile usernames', `SELECT username AS key, count(*)::int AS occurrences FROM profile GROUP BY username HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 10`, true],
  ['orphan profiles', `SELECT p.username AS key, 1 AS occurrences FROM profile p LEFT JOIN auth a ON a.username = p.username WHERE a.username IS NULL LIMIT 10`, true],
  ['invalid profile roles', `SELECT username AS key, 1 AS occurrences FROM profile WHERE role IS NOT NULL AND role NOT IN ('admin', 'manufacturer', 'supplier', 'retailer') LIMIT 10`, true],
  ['null product serial numbers', `SELECT '<NULL>' AS key, count(*)::int AS occurrences FROM product WHERE serialnumber IS NULL HAVING count(*) > 0`, true],
  ['duplicate product serial numbers', `SELECT serialnumber AS key, count(*)::int AS occurrences FROM product GROUP BY serialnumber HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 10`, true],
];

async function runMigrationPreflight(pool, { log = console.log, failOnBlocking = true } = {}) {
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`,
    [REQUIRED_TABLES]
  );
  const present = new Set(tables.rows.map((row) => row.table_name));
  const missing = REQUIRED_TABLES.filter((table) => !present.has(table));
  if (missing.length) {
    throw new Error(`Migration preflight cannot run: required existing tables are missing: ${missing.join(', ')}. Restore/create the base schema first.`);
  }

  const findings = [];
  for (const [name, sql, blocking] of CHECKS) {
    const result = await pool.query(sql);
    if (result.rows.length) findings.push({ name, rows: result.rows, blocking });
  }

  const productColumns = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'product' AND column_name IN ('manufacturer_username', 'chain_status', 'chain_tx_hash')`
  );
  const columns = new Set(productColumns.rows.map((row) => row.column_name));
  if (columns.has('manufacturer_username')) {
    const result = await pool.query(`SELECT p.serialnumber AS key, 1 AS occurrences FROM product p LEFT JOIN auth a ON a.username = p.manufacturer_username WHERE p.manufacturer_username IS NOT NULL AND a.username IS NULL LIMIT 10`);
    if (result.rows.length) findings.push({ name: 'products with orphan manufacturer usernames', rows: result.rows, blocking: true });
    if (columns.has('chain_status')) {
      const unassigned = await pool.query(`SELECT serialnumber AS key, 1 AS occurrences FROM product WHERE manufacturer_username IS NULL ORDER BY created_at NULLS LAST LIMIT 10`);
      if (unassigned.rows.length) findings.push({
        name: 'legacy products without an assigned manufacturer (manual source-record review required before retry)',
        rows: unassigned.rows,
        blocking: false,
        reportOnly: true,
      });
    }
  }
  if (columns.has('chain_status')) {
    const invalidIdentifiers = await pool.query(`SELECT serialnumber AS key, 1 AS occurrences FROM product WHERE serialnumber !~* '^SS-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ORDER BY created_at NULLS LAST LIMIT 10`);
    if (invalidIdentifiers.rows.length) findings.push({
      name: 'legacy product identifiers outside the canonical SS-UUID format (chain verification/retry unavailable until evidence-backed rekey)',
      rows: invalidIdentifiers.rows,
      blocking: false,
      reportOnly: true,
    });
  }
  if (columns.has('chain_status')) {
    const statuses = await pool.query(`SELECT chain_status AS key, count(*)::int AS occurrences FROM product GROUP BY chain_status ORDER BY chain_status`);
    findings.push({ name: 'existing chain statuses', rows: statuses.rows, blocking: false, reportOnly: true });
    if (columns.has('chain_tx_hash')) {
      const unverified = await pool.query(`SELECT serialnumber AS key, 1 AS occurrences FROM product WHERE chain_status = 'confirmed' AND (chain_tx_hash IS NULL OR chain_tx_hash !~ '^0x[0-9a-fA-F]{64}$') ORDER BY created_at NULLS LAST LIMIT 10`);
      if (unverified.rows.length) findings.push({ name: 'products marked confirmed without a valid transaction hash', rows: unverified.rows, blocking: false, reportOnly: true });
      const malformedHashes = await pool.query(`SELECT serialnumber AS key, 1 AS occurrences FROM product WHERE chain_tx_hash IS NOT NULL AND chain_tx_hash !~ '^0x[0-9a-fA-F]{64}$' ORDER BY created_at NULLS LAST LIMIT 10`);
      if (malformedHashes.rows.length) findings.push({ name: 'products with malformed transaction hashes (will be sanitized to retry/review state)', rows: malformedHashes.rows, blocking: false, reportOnly: true });
    }
  }

  if (findings.length) {
    log('Migration preflight findings:');
    for (const finding of findings) {
      const label = finding.reportOnly ? 'REPORT' : finding.blocking ? 'BLOCKING' : 'WARNING';
      log(`- ${label}: ${finding.name}${finding.rows.length >= 10 ? ' (first 10 shown)' : ''}`);
      for (const row of finding.rows) log(`    ${String(row.key)}${row.occurrences > 1 ? ` (${row.occurrences} rows)` : ''}`);
    }
  } else {
    log('Migration preflight passed: no duplicate keys, invalid roles, or orphaned profile/product relations found.');
  }

  const blockingFindings = findings.filter((finding) => finding.blocking && !finding.reportOnly);
  if (failOnBlocking && blockingFindings.length) {
    throw new Error(`Migration preflight found ${blockingFindings.length} blocking data issue(s). Repair the reported rows, back them up, and rerun the preflight before migrating.`);
  }
  return findings;
}

module.exports = { runMigrationPreflight };
