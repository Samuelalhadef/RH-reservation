import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  // First, list users that look like test accounts
  const result = await db.execute({
    sql: `SELECT id, nom, prenom, email, service, poste, type_utilisateur
          FROM users
          WHERE actif = 1
          ORDER BY nom, prenom`,
    args: [],
  });

  console.log('\n=== Utilisateurs actifs ===\n');
  for (const u of result.rows) {
    console.log(`  [${u.id}] ${u.prenom} ${u.nom} — ${u.email} — service: ${u.service} — poste: ${u.poste}`);
  }

  // Deactivate test users by name patterns
  const testPatterns = [
    // dede, cece, duendei, test test, alhadef (samuel)
    { field: 'nom', pattern: '%dede%' },
    { field: 'prenom', pattern: '%dede%' },
    { field: 'nom', pattern: '%cece%' },
    { field: 'prenom', pattern: '%cece%' },
    { field: 'nom', pattern: '%duendei%' },
    { field: 'prenom', pattern: '%duendei%' },
    { field: 'nom', pattern: '%test%' },
    { field: 'prenom', pattern: '%test%' },
  ];

  let deactivated = 0;
  for (const p of testPatterns) {
    const res = await db.execute({
      sql: `UPDATE users SET actif = 0 WHERE LOWER(${p.field}) LIKE LOWER(?) AND actif = 1`,
      args: [p.pattern],
    });
    deactivated += res.rowsAffected;
  }

  // Also deactivate Samuel Alhadef specifically
  const res2 = await db.execute({
    sql: `UPDATE users SET actif = 0 WHERE LOWER(nom) LIKE '%alhadef%' AND actif = 1`,
    args: [],
  });
  deactivated += res2.rowsAffected;

  console.log(`\n=== ${deactivated} utilisateur(s) desactive(s) ===\n`);

  // Show remaining active users
  const remaining = await db.execute({
    sql: `SELECT id, nom, prenom, email FROM users WHERE actif = 1 ORDER BY nom, prenom`,
    args: [],
  });
  console.log('=== Utilisateurs restants ===\n');
  for (const u of remaining.rows) {
    console.log(`  [${u.id}] ${u.prenom} ${u.nom} — ${u.email}`);
  }
}

main().catch(console.error);
