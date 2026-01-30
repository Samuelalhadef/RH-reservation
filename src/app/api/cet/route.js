import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Récupérer ou créer le CET de l'utilisateur
    let cetResult = await db.execute({
      sql: 'SELECT * FROM cet WHERE user_id = ?',
      args: [user.userId]
    });

    if (cetResult.rows.length === 0) {
      // Créer le CET s'il n'existe pas
      await db.execute({
        sql: 'INSERT INTO cet (user_id, solde) VALUES (?, 0)',
        args: [user.userId]
      });
      cetResult = await db.execute({
        sql: 'SELECT * FROM cet WHERE user_id = ?',
        args: [user.userId]
      });
    }

    // Récupérer l'historique
    const historiqueResult = await db.execute({
      sql: `
        SELECT type, jours, motif,
               strftime('%d/%m/%Y', date_operation) as date
        FROM cet_historique
        WHERE user_id = ?
        ORDER BY date_operation DESC
        LIMIT 10
      `,
      args: [user.userId]
    });

    return NextResponse.json({
      success: true,
      cet: {
        solde: cetResult.rows[0]?.solde || 0,
        historique: historiqueResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching CET:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération du CET' },
      { status: 500 }
    );
  }
}
