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

    // Total des jours transférés vers le CET cette année
    const currentYear = new Date().getFullYear();
    const transfersThisYear = await db.execute({
      sql: `
        SELECT COALESCE(SUM(jours), 0) as total
        FROM cet_historique
        WHERE user_id = ? AND type = 'credit' AND strftime('%Y', date_operation) = ?
      `,
      args: [user.userId, String(currentYear)]
    });

    // Demandes CET en attente
    const pendingRequests = await db.execute({
      sql: `
        SELECT id, type, jours, motif, statut,
               strftime('%d/%m/%Y', date_demande) as date_demande
        FROM demandes_cet
        WHERE user_id = ? AND statut = 'en_attente'
        ORDER BY date_demande DESC
      `,
      args: [user.userId]
    });

    // Demandes CET récentes (validées/refusées)
    const recentRequests = await db.execute({
      sql: `
        SELECT d.id, d.type, d.jours, d.motif, d.statut, d.commentaire_rh,
               strftime('%d/%m/%Y', d.date_demande) as date_demande,
               strftime('%d/%m/%Y', d.date_validation) as date_validation
        FROM demandes_cet d
        WHERE d.user_id = ? AND d.statut != 'en_attente'
        ORDER BY d.date_validation DESC
        LIMIT 10
      `,
      args: [user.userId]
    });

    return NextResponse.json({
      success: true,
      cet: {
        solde: cetResult.rows[0]?.solde || 0,
        historique: historiqueResult.rows,
        jours_transferes_annee: transfersThisYear.rows[0]?.total || 0,
        demandes_en_attente: pendingRequests.rows,
        demandes_recentes: recentRequests.rows
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
