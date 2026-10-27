require('dotenv').config();

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { URL } = require('url');

function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const databaseUrl = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
    throw new Error('This backup helper only writes backups for a local PostgreSQL host');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = path.join(os.tmpdir(), `smartscan-pre-migration-${timestamp}.dump`);
  const pgDump = process.env.PG_DUMP_PATH || 'pg_dump';
  const environment = { ...process.env };
  environment.PGPASSWORD = decodeURIComponent(databaseUrl.password);

  const result = spawnSync(pgDump, [
    '--format=custom', '--no-owner', '--no-acl', '--file', output,
    '--host', databaseUrl.hostname,
    '--port', databaseUrl.port || '5432',
    '--username', decodeURIComponent(databaseUrl.username),
    '--dbname', decodeURIComponent(databaseUrl.pathname.slice(1)),
  ], { env: environment, encoding: 'utf8' });

  if (result.error) throw new Error(`Could not start pg_dump: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`pg_dump failed with exit code ${result.status}: ${String(result.stderr || '').trim()}`);
  const size = fs.statSync(output).size;
  if (size === 0) throw new Error('pg_dump produced an empty backup');
  console.log(`Database backup created: ${output} (${size} bytes)`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
