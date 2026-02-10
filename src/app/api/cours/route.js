import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const userId = user.userId || user.id;

    const result = await db.execute({
      sql: `SELECT id, date FROM jours_cours WHERE user_id = ? ORDER BY date`,
      args: [userId]
    });

    return NextResponse.json({
      success: true,
      jours: result.rows
    });
  } catch (error) {
    console.error('Error fetching cours days:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des jours en cours' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const userId = user.userId || user.id;

    // Vérifier que l'utilisateur est bien un alternant
    const userResult = await db.execute({
      sql: `SELECT type_utilisateur FROM users WHERE id = ?`,
      args: [userId]
    });

    if (userResult.rows.length === 0 || userResult.rows[0].type_utilisateur !== 'Alternant') {
      return NextResponse.json(
        { success: false, message: 'Seuls les alternants peuvent marquer des jours en cours' },
        { status: 403 }
      );
    }

    const { date } = await request.json();

    if (!date) {
      return NextResponse.json(
        { success: false, message: 'Date requise' },
        { status: 400 }
      );
    }

    // Toggle: si le jour existe, on le supprime; sinon on l'ajoute
    const existing = await db.execute({
      sql: `SELECT id FROM jours_cours WHERE user_id = ? AND date = ?`,
      args: [userId, date]
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: `DELETE FROM jours_cours WHERE user_id = ? AND date = ?`,
        args: [userId, date]
      });
      return NextResponse.json({
        success: true,
        action: 'removed',
        message: 'Jour en cours supprimé'
      });
    } else {
      await db.execute({
        sql: `INSERT INTO jours_cours (user_id, date) VALUES (?, ?)`,
        args: [userId, date]
      });
      return NextResponse.json({
        success: true,
        action: 'added',
        message: 'Jour en cours ajouté'
      });
    }
  } catch (error) {
    console.error('Error toggling cours day:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la modification du jour en cours' },
      { status: 500 }
    );
  }
}
