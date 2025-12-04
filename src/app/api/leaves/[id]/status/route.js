import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { formatDateFR } from '@/lib/dateUtils';
import { sendLeaveApprovedEmail, sendLeaveRejectedEmail } from '@/lib/email';
import { validateLeaveAtLevel } from '@/lib/hierarchy';

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

      // Envoyer les emails appropriés
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
