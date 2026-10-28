const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { hashPassword, verifyPassword } = require('./password');

// Try loading environment from .env or .env.staging in frontend
let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  const stagingEnvPath = path.join(__dirname, '../smartscan-frontend-react/.env.staging');
  if (fs.existsSync(stagingEnvPath)) {
    const parsed = dotenv.parse(fs.readFileSync(stagingEnvPath));
    dbUrl = parsed.DATABASE_URL || parsed.POSTGRES_URL;
  }
}

if (!dbUrl) {
  const localEnvPath = path.join(__dirname, '.env');
  if (fs.existsSync(localEnvPath)) {
    const parsed = dotenv.parse(fs.readFileSync(localEnvPath));
    dbUrl = parsed.DATABASE_URL || parsed.POSTGRES_URL;
  }
}

if (!dbUrl) {
  console.error('No DATABASE_URL or POSTGRES_URL found.');
  process.exit(1);
}

// Append /neondb catalog if omitted
try {
  const parsed = new URL(dbUrl);
  if (!parsed.pathname || parsed.pathname === '/') {
    parsed.pathname = '/neondb';
    dbUrl = parsed.toString();
  }
} catch (e) {
  console.error('Invalid connection string:', e.message);
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { require: true, rejectUnauthorized: true }
});

const SEED_USERS = [
  {
    username: 'admin',
    password: process.env.ADMIN_INITIAL_PASSWORD || 'admin',
    role: 'admin',
    profile: {
      name: 'System Administrator',
      description: 'Default administrator account for SmartScan Anti-Counterfeit Platform',
      website: 'https://smart-scan-ten.vercel.app',
      location: 'Kuala Lumpur, Malaysia',
      image: null
    }
  },
  {
    username: 'manu',
    password: process.env.MANU_INITIAL_PASSWORD || 'manu',
    role: 'manufacturer',
    profile: {
      name: 'Manu Group',
      description: 'Manu Group is one of the biggest manufacturer companies in Malaysia, covering the majority of the luxury industry',
      website: 'www.manu.com.my',
      location: 'Kuala Lumpur, Malaysia',
      image: null
    }
  },
  {
    username: 'supp',
    password: process.env.SUPP_INITIAL_PASSWORD || 'supp',
    role: 'supplier',
    profile: {
      name: 'CK Supplier',
      description: 'CK supplier supplies a myriad of luxury items and has long-term distribution contracts with verified brands',
      website: 'www.cksupp.com.my',
      location: 'Bangsar South, Malaysia',
      image: null
    }
  },
  {
    username: 'retailer',
    password: process.env.RETAILER_INITIAL_PASSWORD || 'retailer',
    role: 'retailer',
    profile: {
      name: 'RE Retailer',
      description: 'RE retailer is the authorized retailer to resell luxury verified consumer goods',
      website: 'www.reretailer.com.my',
      location: 'Kuala Lumpur, Malaysia',
      image: null
    }
  }
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding staging users into database...');
    await client.query('BEGIN');

    for (const u of SEED_USERS) {
      const hashedPassword = hashPassword(u.password);
      
      // Upsert auth row
      await client.query(`
        INSERT INTO auth (username, password, role, wallet_status, token_version)
        VALUES ($1, $2, $3, 'unlinked', 0)
        ON CONFLICT (username) DO UPDATE
        SET password = EXCLUDED.password,
            role = EXCLUDED.role
      `, [u.username, hashedPassword, u.role]);

      // Upsert profile row
      await client.query(`
        INSERT INTO profile (username, name, description, website, location, image, role)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (username) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            website = EXCLUDED.website,
            location = EXCLUDED.location,
            role = EXCLUDED.role
      `, [
        u.username,
        u.profile.name,
        u.profile.description,
        u.profile.website,
        u.profile.location,
        u.profile.image,
        u.role
      ]);

      console.log(`✓ Seeded user: ${u.username} (${u.role})`);
    }

    await client.query('COMMIT');
    console.log('All users and profiles seeded successfully.');

    // Verification check
    console.log('\n--- Verification ---');
    const { rows } = await client.query('SELECT username, password, role, wallet_status FROM auth ORDER BY id ASC');
    for (const row of rows) {
      const original = SEED_USERS.find(s => s.username === row.username);
      const ok = original ? verifyPassword(original.password, row.password) : false;
      console.log(`Account '${row.username}' (${row.role}): password verify = ${ok ? 'PASSED' : 'FAILED'}`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

