const test = require('node:test');
const assert = require('node:assert/strict');
const { runMigrationPreflight } = require('../migration-preflight');

function fakePool({ issue = null, chainColumns = [] } = {}) {
  return {
    async query(sql) {
      if (sql.includes('information_schema.tables')) return { rows: ['auth', 'profile', 'product'].map((table_name) => ({ table_name })) };
      if (sql.includes('information_schema.columns')) return { rows: chainColumns.map((column_name) => ({ column_name })) };
      if (issue && sql.includes(issue.match)) return { rows: [{ key: issue.key, occurrences: issue.occurrences || 1 }] };
      return { rows: [] };
    },
  };
}

test('migration preflight passes a clean legacy schema', async () => {
  const messages = [];
  const findings = await runMigrationPreflight(fakePool(), { log: (message) => messages.push(message) });
  assert.equal(findings.length, 0);
  assert.match(messages[0], /passed/);
});

test('migration preflight reports and blocks duplicate product serials', async () => {
  const messages = [];
  await assert.rejects(
    runMigrationPreflight(fakePool({ issue: { match: 'GROUP BY serialnumber', key: 'SERIAL-1', occurrences: 2 } }), { log: (message) => messages.push(message) }),
    /blocking data issue/
  );
  assert.ok(messages.some((message) => message.includes('SERIAL-1')));
});

test('unverified legacy product confirmations are reported without blocking repair', async () => {
  const messages = [];
  const findings = await runMigrationPreflight(
    fakePool({ issue: { match: "chain_status = 'confirmed'", key: 'SERIAL-2' }, chainColumns: ['chain_status', 'chain_tx_hash'] }),
    { log: (message) => messages.push(message) }
  );
  assert.ok(findings.some((finding) => finding.name === 'products marked confirmed without a valid transaction hash'));
  assert.ok(messages.some((message) => message.includes('confirmed without a valid transaction hash')));
});

test('legacy products without manufacturer ownership are reported for manual source review', async () => {
  const messages = [];
  const findings = await runMigrationPreflight(
    fakePool({ issue: { match: 'WHERE manufacturer_username IS NULL', key: 'SS-LEGACY-1' }, chainColumns: ['manufacturer_username', 'chain_status'] }),
    { log: (message) => messages.push(message) },
  );
  const ownershipFinding = findings.find((finding) => finding.name.startsWith('legacy products without an assigned manufacturer'));
  assert.ok(ownershipFinding);
  assert.equal(ownershipFinding.reportOnly, true);
  assert.ok(messages.some((message) => message.includes('manual source-record review required')));
});

test('legacy identifiers outside the V2 format are reported for evidence-backed rekey review', async () => {
  const messages = [];
  const findings = await runMigrationPreflight(
    fakePool({ issue: { match: "WHERE serialnumber !~*", key: 'legacy-456' }, chainColumns: ['chain_status'] }),
    { log: (message) => messages.push(message) },
  );
  const identifierFinding = findings.find((finding) => finding.name.startsWith('legacy product identifiers outside the canonical SS-UUID format'));
  assert.ok(identifierFinding);
  assert.equal(identifierFinding.reportOnly, true);
  assert.ok(messages.some((message) => message.includes('legacy-456')));
});
