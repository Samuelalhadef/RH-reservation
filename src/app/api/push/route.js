import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// POST - S'abonner aux notifications push
export async function POST(request) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { subscription } = await request.json();

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { success: false, message: 'Subscription invalide' },
        { status: 400 }
      );
    }

    // Vérifier si l'abonnement existe déjà
    const existing = await db.execute({
      sql: 'SELECT id FROM push_subscriptions WHERE endpoint = ?',
      args: [subscription.endpoint]
    });

    if (existing.rows.length > 0) {
      // Mettre à jour l'abonnement existant
      await db.execute({
        sql: 'UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ? WHERE endpoint = ?',
        args: [user.userId, subscription.keys.p256dh, subscription.keys.auth, subscription.endpoint]
      });
    } else {
      // Créer un nouvel abonnement
      await db.execute({
        sql: 'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)',
        args: [user.userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
      });
    }

    return NextResponse.json({ success: true, message: 'Notifications activées' });
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur: ' + error.message },
      { status: 500 }
    );
  }
}

// DELETE - Se désabonner des notifications push
export async function DELETE(request) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { endpoint } = await request.json();

    if (endpoint) {
      await db.execute({
        sql: 'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?',
        args: [endpoint, user.userId]
      });
    } else {
      // Supprimer tous les abonnements de l'utilisateur
      await db.execute({
        sql: 'DELETE FROM push_subscriptions WHERE user_id = ?',
        args: [user.userId]
      });
    }

    return NextResponse.json({ success: true, message: 'Notifications désactivées' });
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur: ' + error.message },
      { status: 500 }
    );
  }
}
