import webpush from 'web-push';
import { db } from './db.js';

// Configurer web-push avec les clés VAPID
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:testdev2026@outlook.fr',
    vapidPublicKey,
    vapidPrivateKey
  );
}

/**
 * Envoie une notification push à un utilisateur
 * @param {number} userId - ID de l'utilisateur destinataire
 * @param {Object} payload - Contenu de la notification
 * @param {string} payload.title - Titre
 * @param {string} payload.body - Message
 * @param {string} [payload.url] - URL à ouvrir au clic
 * @param {string} [payload.tag] - Tag pour regrouper les notifications
 */
export async function sendPushToUser(userId, payload) {
  try {
    const subscriptions = await db.execute({
      sql: 'SELECT * FROM push_subscriptions WHERE user_id = ?',
      args: [userId]
    });

    if (subscriptions.rows.length === 0) return;

    const notifPayload = JSON.stringify({
      title: payload.title || 'Portail Agent',
      body: payload.body,
      icon: '/icons/icon-192x192.png',
      url: payload.url || '/',
      tag: payload.tag || 'general'
    });

    for (const sub of subscriptions.rows) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };
        await webpush.sendNotification(pushSubscription, notifPayload);
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          // Abonnement expiré, le supprimer
          await db.execute({
            sql: 'DELETE FROM push_subscriptions WHERE id = ?',
            args: [sub.id]
          });
        }
      }
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

/**
 * Envoie une notification push à tous les RH
 */
export async function sendPushToRH(payload) {
  try {
    const rhUsers = await db.execute({
      sql: "SELECT id FROM users WHERE type_utilisateur IN ('RH', 'Direction') AND actif = 1"
    });

    for (const rh of rhUsers.rows) {
      await sendPushToUser(rh.id, payload);
    }
  } catch (error) {
    console.error('Error sending push to RH:', error);
  }
}

/**
 * Envoie une notification push à un validateur spécifique
 */
export async function notifyLeaveRequest(requesterName, validatorId, leaveId) {
  await sendPushToUser(validatorId, {
    title: 'Nouvelle demande de congé',
    body: `${requesterName} a fait une demande de congé`,
    url: '/validation',
    tag: `leave-${leaveId}`
  });
}

/**
 * Notifie l'agent que sa demande a été validée/refusée
 */
export async function notifyLeaveDecision(userId, decision, validatorName) {
  const isApproved = decision === 'validee';
  await sendPushToUser(userId, {
    title: isApproved ? 'Congé validé' : 'Congé refusé',
    body: isApproved
      ? `Votre demande de congé a été validée par ${validatorName}`
      : `Votre demande de congé a été refusée par ${validatorName}`,
    url: '/mes-demandes',
    tag: 'leave-decision'
  });
}

/**
 * Notifie la validation intermédiaire (passage au niveau suivant)
 */
export async function notifyLeaveProgress(userId, message) {
  await sendPushToUser(userId, {
    title: 'Avancement de votre demande',
    body: message,
    url: '/mes-demandes',
    tag: 'leave-progress'
  });
}

/**
 * Notifie les RH d'une nouvelle demande CET
 */
export async function notifyCetRequest(requesterName, type) {
  const label = type === 'credit' ? 'versement vers le CET' : 'retrait du CET';
  await sendPushToRH({
    title: 'Nouvelle demande CET',
    body: `${requesterName} a fait une demande de ${label}`,
    url: '/rh',
    tag: 'cet-request'
  });
}

/**
 * Notifie l'agent d'une décision sur sa demande CET
 */
export async function notifyCetDecision(userId, decision, jours) {
  const isApproved = decision === 'valider';
  await sendPushToUser(userId, {
    title: isApproved ? 'Demande CET validée' : 'Demande CET refusée',
    body: isApproved
      ? `Votre demande CET de ${jours} jour(s) a été validée`
      : `Votre demande CET de ${jours} jour(s) a été refusée`,
    url: '/profil',
    tag: 'cet-decision'
  });
}

/**
 * Notifie l'agent que son congé a été annulé par la RH
 */
export async function notifyLeaveCancelled(userId, dateDebut, dateFin) {
  await sendPushToUser(userId, {
    title: 'Congé annulé',
    body: `Votre congé du ${dateDebut} au ${dateFin} a été annulé par les RH`,
    url: '/mes-demandes',
    tag: 'leave-cancelled'
  });
}
