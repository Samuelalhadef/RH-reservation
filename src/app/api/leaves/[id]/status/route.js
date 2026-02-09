import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { formatDateFR } from '@/lib/dateUtils';
import { sendLeaveApprovedEmail, sendLeaveRejectedEmail } from '@/lib/email';
import { validateLeaveAtLevel } from '@/lib/hierarchy';
import { notifyLeaveDecision, notifyLeaveProgress, sendPushToUser, sendPushToRH } from '@/lib/pushNotifications';

export async function PUT(request, { params }) {
  try {
    // Vérification de l'authentification
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: 'Token invalide' },
        { status: 401 }
      );
    }

    const validatorId = decoded.userId;
    const { id } = await params;
    const { statut, commentaire_rh } = await request.json();

    if (!statut || !['validee', 'refusee'].includes(statut)) {
      return NextResponse.json(
        { success: false, message: 'Statut invalide' },
        { status: 400 }
      );
    }

    // Récupérer la demande
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

    // Utiliser le système de validation hiérarchique
    try {
      const result = await validateLeaveAtLevel(
        id,
        validatorId,
        statut,
        commentaire_rh || ''
      );

      // Récupérer le nom du validateur pour la notification
      const validatorResult = await db.execute({
        sql: 'SELECT nom, prenom FROM users WHERE id = ?',
        args: [validatorId]
      });
      const validatorName = validatorResult.rows[0]
        ? `${validatorResult.rows[0].prenom} ${validatorResult.rows[0].nom}`
        : 'un responsable';

      // Envoyer les emails et notifications push
      if (result.isFinal) {
        if (statut === 'validee') {
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
        // Notification push à l'agent
        try {
          await notifyLeaveDecision(leave.user_id, statut, validatorName);
        } catch (e) { /* ignore push errors */ }
      } else {
        // Validation intermédiaire - notifier l'agent de l'avancement
        try {
          await notifyLeaveProgress(leave.user_id, result.message);
        } catch (e) { /* ignore push errors */ }

        // Notifier le validateur suivant
        if (result.nextLevel === 'rh') {
          try {
            await sendPushToRH({
              title: 'Demande en attente de validation RH',
              body: `La demande de ${leave.prenom} ${leave.nom} nécessite votre validation`,
              url: '/validation',
              tag: `leave-${id}`
            });
          } catch (e) { /* ignore */ }
        }
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        isFinal: result.isFinal,
        nextLevel: result.nextLevel
      });
    } catch (validationError) {
      return NextResponse.json(
        { success: false, message: validationError.message },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('Error updating leave status:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la mise à jour de la demande' },
      { status: 500 }
    );
  }
}
