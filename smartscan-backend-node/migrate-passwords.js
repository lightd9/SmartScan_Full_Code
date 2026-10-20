require('dotenv').config();

const { createPool } = require('./db');
const { hashPassword, isHashed } = require('./password');

async function main() {
  const pool = createPool();
  try {
    const { rows } = await pool.query('SELECT username, password FROM auth');
    let migrated = 0;

    for (const row of rows) {
      if (!isHashed(row.password)) {
        await pool.query('UPDATE auth SET password = $1 WHERE username = $2', [
          hashPassword(row.password),
          row.username,
        ]);
        migrated += 1;
      }
    }

    console.log(`Migrated ${migrated} of ${rows.length} accounts to scrypt hashes.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Password migration failed:', err.message);
  process.exit(1);
});
