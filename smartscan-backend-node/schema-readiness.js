const fs = require('fs');
const path = require('path');

function latestMigrationName(directory = path.join(__dirname, 'migrations')) {
  const migrations = fs.readdirSync(directory)
    .filter((filename) => /^\d+_[a-z0-9_-]+\.sql$/i.test(filename))
    .sort();
  if (!migrations.length) throw new Error('No database migrations are available');
  return migrations[migrations.length - 1];
}

async function assertLatestMigration(pool, requiredMigration = latestMigrationName()) {
  const result = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [requiredMigration]);
  if (!result.rows.length) throw new Error(`Required database migration is not applied: ${requiredMigration}`);
}

module.exports = { latestMigrationName, assertLatestMigration };
