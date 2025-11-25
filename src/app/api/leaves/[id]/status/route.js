import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { formatDateFR } from '@/lib/dateUtils';
import { sendLeaveApprovedEmail, sendLeaveRejectedEmail } from '@/lib/email';

export async function PUT(request, { params }) {
  try {
    const { authorized, user } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { statut, commentaire_rh } = await request.json();

    if (!statut || !['validee', 'refusee'].includes(statut)) {
      return NextResponse.json(
        { success: false, message: 'Statut invalide' },
        { status: 400 }
      );
    }

    const leaveResult = await db.execute({
      sql: `
        SELECT dc.*, u.nom, u.prenom, u.email
        FROM demandes_conges dc
        JOIN users u ON dc.user_id = u.id
        WHERE dc.id = ?
      `,
      args: [id]
    });

    if (leaveResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Demande non trouvée' },
        { status: 404 }
      );
    }

    const leave = leaveResult.rows[0];

    if (leave.statut !== 'en_attente') {
      return NextResponse.json(
        { success: false, message: 'Cette demande a déjà été traitée' },
        { status: 400 }
      );
    }

    await db.execute({
      sql: `
        UPDATE demandes_conges
        SET statut = ?, date_validation = CURRENT_TIMESTAMP, validateur_id = ?, commentaire_rh = ?
        WHERE id = ?
      `,
      args: [statut, user.userId, commentaire_rh || null, id]
    });

    if (statut === 'validee') {
      const currentYear = new Date(leave.date_debut).getFullYear();
      await db.execute({
        sql: `
          UPDATE soldes_conges
          SET jours_pris = jours_pris + ?,
              jours_restants = jours_restants - ?
          WHERE user_id = ? AND annee = ?
        `,
        args: [leave.nombre_jours_ouvres, leave.nombre_jours_ouvres, leave.user_id, currentYear]
      });

      await sendLeaveApprovedEmail(
        leave.email,
        `${leave.prenom} ${leave.nom}`,
        formatDateFR(leave.date_debut),
        formatDateFR(leave.date_fin),
        leave.nombre_jours_ouvres
      );
    } else {
      await sendLeaveRejectedEmail(
        leave.email,
        `${leave.prenom} ${leave.nom}`,
        formatDateFR(leave.date_debut),
        formatDateFR(leave.date_fin),
        commentaire_rh
      );
    }

    return NextResponse.json({
      success: true,
      message: `Demande ${statut === 'validee' ? 'validée' : 'refusée'} avec succès`
    });
  } catch (error) {
    console.error('Error updating leave status:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la mise à jour de la demande' },
      { status: 500 }
    );
  }
}
