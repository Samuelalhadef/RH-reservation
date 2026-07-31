import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { createClient } from '@libsql/client';
import webpush from 'web-push';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

webpush.setVapidDetails(
  'mailto:testdev2026@outlook.fr',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function main() {
  // Abonnements push de Virginie (id 57)
  const subs = await db.execute({
    sql: 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
    args: [57],
  });
  console.log(`\n=== Abonnements push de Virginie (id 57): ${subs.rows.length} ===`);
  for (const s of subs.rows) {
    const provider = s.endpoint.includes('mozilla') ? 'Firefox'
      : s.endpoint.includes('google') || s.endpoint.includes('fcm') ? 'Chrome/Android'
      : s.endpoint.includes('apple') ? 'Apple/Safari' : 'autre';
    console.log(`  sub#${s.id} [${provider}] | ${s.endpoint.slice(0, 60)}...`);
  }

  // Test réel de délivrabilité (envoi silencieux)
  console.log('\n=== Test de délivrabilité ===');
  for (const s of subs.rows) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: 'Test notification', body: 'Diagnostic RH — vous pouvez ignorer ce message' })
      );
      console.log(`  sub#${s.id}: OK (accepté par le service push)`);
    } catch (e) {
      console.log(`  sub#${s.id}: ÉCHEC statusCode=${e.statusCode} ${e.body || e.message}`);
    }
  }

  // Demandes récentes de Samuel (id 88)
  const dem = await db.execute({
    sql: 'SELECT id, date_debut, date_fin, statut, date_demande FROM demandes_conges WHERE user_id = ? ORDER BY date_demande DESC LIMIT 5',
    args: [88],
  });
  console.log(`\n=== ${dem.rows.length} dernières demandes de Samuel (id 88) ===`);
  for (const d of dem.rows) {
    console.log(`  demande#${d.id} ${d.date_debut}->${d.date_fin} [${d.statut}] demandée le ${d.date_demande}`);
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
