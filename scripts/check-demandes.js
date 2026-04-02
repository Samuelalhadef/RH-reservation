import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function check() {
  const count = await client.execute('SELECT COUNT(*) as cnt FROM demandes_conges');
  console.log(`demandes_conges: ${count.rows[0].cnt} lignes`);

  // Check if demandes_conges_backup exists
  const tables = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%backup%'`);
  console.log('\nTables backup:', tables.rows.map(r => r.name));

  // Check foreign keys on demandes_conges
  const schema = await client.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name='demandes_conges'`);
  console.log('\nSchema demandes_conges:\n', schema.rows[0]?.sql);

  // Show a few rows
  const sample = await client.execute('SELECT id, user_id, statut, date_demande FROM demandes_conges LIMIT 5');
  console.log('\nExemples:', sample.rows);
}

check().catch(e => console.error(e)).finally(() => process.exit(0));
