import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { notifyLeaveCancelled } from '@/lib/pushNotifications';
import { recalculateSoldeComplet } from '@/lib/fractionnement';

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

      // Recalculer le solde (jours pris + jours restants, mouvements CET inclus)
      await recalculateSoldeComplet(leave.user_id, currentYear);
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
      { success: false, message: 'Erreur lors de l\'annulation' },
      { status: 500 }
    );
  }
}
