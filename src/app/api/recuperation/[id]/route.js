import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { validateRecuperationAtLevel, forceValidateRecuperationByRH } from '@/lib/hierarchy';
import { notifyRecuperationDecision, sendPushToUser, sendPushToRH } from '@/lib/pushNotifications';

// GET - Récupérer une demande spécifique (avec document)
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const result = await db.execute({
      sql: `
        SELECT d.*,
               u.nom, u.prenom, u.service, u.poste,
               strftime('%d/%m/%Y', d.date_travail) as date_travail_fr,
               strftime('%d/%m/%Y', d.date_demande) as date_demande_fr
        FROM demandes_recuperation d
        JOIN users u ON d.user_id = u.id
        WHERE d.id = ?
      `,
      args: [id]
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Demande non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      demande: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching recuperation request:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// PUT - Valider/Refuser une demande via circuit hiérarchique
export async function PUT(request, { params }) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Token invalide' }, { status: 401 });
    }
    const validatorId = decoded.userId;

    const { id } = await params;
    const { action, commentaire, force_rh } = await request.json();

    if (!['valider', 'refuser'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Action invalide' },
        { status: 400 }
      );
    }

    const decision = action === 'valider' ? 'validee' : 'refusee';

    // Récupérer la demande pour notifications
    const demandeResult = await db.execute({
      sql: `SELECT d.*, u.nom, u.prenom
            FROM demandes_recuperation d
            JOIN users u ON d.user_id = u.id
            WHERE d.id = ?`,
      args: [id]
    });
    if (demandeResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Demande non trouvée' },
        { status: 404 }
      );
    }
    const demande = demandeResult.rows[0];

    if (demande.statut !== 'en_attente') {
      return NextResponse.json(
        { success: false, message: 'Cette demande a déjà été traitée' },
        { status: 400 }
      );
    }

    try {
      const result = force_rh
        ? await forceValidateRecuperationByRH(id, validatorId, decision, commentaire || '', 'demandes_recuperation')
        : await validateRecuperationAtLevel(id, validatorId, decision, commentaire || '', 'demandes_recuperation');

      // Notifications
      if (result.isFinal) {
        try {
          await notifyRecuperationDecision(demande.user_id, action, demande.type_compensation);
        } catch (e) { /* ignore push errors */ }
      } else {
        try {
          await sendPushToUser(demande.user_id, {
            title: 'Avancement de votre demande',
            body: result.message,
            url: '/recuperation',
            tag: `recup-progress-${id}`
          });
        } catch (e) { /* ignore */ }
        if (result.nextLevel === 'rh') {
          try {
            await sendPushToRH({
              title: 'Demande d\'heures sup en attente RH',
              body: `La demande de ${demande.prenom} ${demande.nom} nécessite votre validation`,
              url: '/validation',
              tag: `recup-${id}`
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
    console.error('Error processing recuperation request:', error);
    return NextResponse.json(
      { success: false, message: `Erreur: ${error.message}` },
      { status: 500 }
    );
  }
}
