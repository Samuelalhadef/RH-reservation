import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import webpush from 'web-push';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  console.error('VAPID keys manquantes dans .env.local');
  process.exit(1);
}

webpush.setVapidDetails(
  'mailto:testdev2026@outlook.fr',
  vapidPublicKey,
  vapidPrivateKey
);

const messages = [
  { title: '🔔 Test 1/10', body: 'Ceci est une notification de test n°1' },
  { title: '📋 Test 2/10', body: 'Nouvelle demande de congé fictive' },
  { title: '✅ Test 3/10', body: 'Votre congé a été validé (test)' },
  { title: '❌ Test 4/10', body: 'Votre congé a été refusé (test)' },
  { title: '📅 Test 5/10', body: 'Rappel : vous avez un congé demain (test)' },
  { title: '👥 Test 6/10', body: 'Un agent a fait une demande de récupération (test)' },
  { title: '💼 Test 7/10', body: 'Demande CET en attente de validation (test)' },
  { title: '🔄 Test 8/10', body: 'Mise à jour de votre solde de congés (test)' },
  { title: '⚠️ Test 9/10', body: 'Action requise : demande en attente (test)' },
  { title: '🎉 Test 10/10', body: 'Dernière notification de test - tout fonctionne !' },
];

async function sendTestNotifications() {
  try {
    // Trouver Carmen
    const carmen = await db.execute(
      "SELECT id FROM users WHERE nom = 'DI STEFANO' AND prenom = 'Carmen'"
    );

    if (carmen.rows.length === 0) {
      console.error('Carmen DI STEFANO non trouvée dans la base');
      process.exit(1);
    }

    const carmenId = carmen.rows[0].id;
    console.log(`Carmen trouvée (ID: ${carmenId})`);

    // Récupérer ses abonnements push
    const subscriptions = await db.execute({
      sql: 'SELECT * FROM push_subscriptions WHERE user_id = ?',
      args: [carmenId],
    });

    if (subscriptions.rows.length === 0) {
      console.error('Carmen n\'a pas d\'abonnement push actif. Elle doit activer les notifications dans l\'app.');
      process.exit(1);
    }

    console.log(`${subscriptions.rows.length} abonnement(s) push trouvé(s)\n`);

    let success = 0;
    let failed = 0;

    for (const msg of messages) {
      const payload = JSON.stringify({
        title: msg.title,
        body: msg.body,
        icon: '/icons/icon-192x192.png',
        url: '/',
        tag: `test-${Date.now()}`,
      });

      for (const sub of subscriptions.rows) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          success++;
          console.log(`✅ Envoyé: ${msg.title}`);
        } catch (error) {
          failed++;
          console.error(`❌ Échec: ${msg.title} - ${error.message}`);
          if (error.statusCode === 404 || error.statusCode === 410) {
            console.log('   (abonnement expiré)');
          }
        }
      }

      // Petite pause entre chaque notification
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`\nTerminé: ${success} envoyées, ${failed} échouées`);
  } catch (error) {
    console.error('Erreur:', error);
  }

  process.exit(0);
}

sendTestNotifications();
