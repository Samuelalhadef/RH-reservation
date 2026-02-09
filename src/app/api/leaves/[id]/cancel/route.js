import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { notifyLeaveCancelled } from '@/lib/pushNotifications';

export async function PUT(request, { params }) {
  try {
    const { authorized, user } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé - Réservé aux RH' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { motif } = await request.json();

    // Récupérer la demande
    const leaveResult = await db.execute({
      sql: 'SELECT * FROM demandes_conges WHERE id = ?',
      args: [id]
    });

    if (leaveResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Demande non trouvée' },
        { status: 404 }
      );
    }

    const leave = leaveResult.rows[0];

    if (leave.statut === 'annulee') {
      return NextResponse.json(
        { success: false, message: 'Cette demande est déjà annulée' },
        { status: 400 }
      );
    }

    const wasValidated = leave.statut === 'validee';
    const now = new Date().toISOString();
    const rhUserId = user.userId || user.id;

    // Marquer la demande comme annulée
    await db.execute({
      sql: `
        UPDATE demandes_conges
        SET statut = 'annulee',
            commentaire_rh = ?,
            date_validation = ?,
            validateur_id = ?
        WHERE id = ?
      `,
      args: [motif || 'Annulée par RH', now, rhUserId, id]
    });

    // Si le congé était validé, recalculer le solde
    if (wasValidated) {
      const currentYear = new Date().getFullYear();

      const totalResult = await db.execute({
        sql: `
          SELECT COALESCE(SUM(nombre_jours_ouvres), 0) as total_pris
          FROM demandes_conges
          WHERE user_id = ? AND statut = 'validee'
            AND strftime('%Y', date_debut) = ?
        `,
        args: [leave.user_id, String(currentYear)]
      });
      const totalPris = totalResult.rows[0]?.total_pris || 0;

      const soldeResult = await db.execute({
        sql: 'SELECT jours_acquis, jours_reportes, jours_fractionnement, jours_compensateurs FROM soldes_conges WHERE user_id = ? AND annee = ?',
        args: [leave.user_id, currentYear]
      });

      if (soldeResult.rows.length > 0) {
        const s = soldeResult.rows[0];
        const totalAcquis = (s.jours_acquis || 0) + (s.jours_reportes || 0) + (s.jours_fractionnement || 0) + (s.jours_compensateurs || 0);
        const restants = totalAcquis - totalPris;

        await db.execute({
          sql: `
            UPDATE soldes_conges
            SET jours_pris = ?,
                jours_restants = ?
            WHERE user_id = ? AND annee = ?
          `,
          args: [totalPris, restants, leave.user_id, currentYear]
        });
      }
    }

    // Notifier l'agent par push
    try {
      const dateDebut = new Date(leave.date_debut).toLocaleDateString('fr-FR');
      const dateFin = new Date(leave.date_fin).toLocaleDateString('fr-FR');
      await notifyLeaveCancelled(leave.user_id, dateDebut, dateFin);
    } catch (e) { /* ignore push errors */ }

    return NextResponse.json({
      success: true,
      message: wasValidated
        ? 'Congé annulé et solde recalculé'
        : 'Demande annulée',
      wasValidated
    });

  } catch (error) {
    console.error('Error cancelling leave:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de l\'annulation: ' + error.message },
      { status: 500 }
    );
  }
}
