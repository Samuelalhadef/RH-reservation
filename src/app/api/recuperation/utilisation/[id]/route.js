import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { validateRecuperationAtLevel, forceValidateRecuperationByRH } from '@/lib/hierarchy';
import { sendPushToUser, sendPushToRH } from '@/lib/pushNotifications';

// PUT - Valider/Refuser une demande d'utilisation via circuit hiérarchique
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
      return NextResponse.json({ success: false, message: 'Action invalide' }, { status: 400 });
    }

    const decision = action === 'valider' ? 'validee' : 'refusee';

    const demandeResult = await db.execute({
      sql: `SELECT d.*, u.nom, u.prenom
            FROM demandes_utilisation_recup d
            JOIN users u ON d.user_id = u.id
            WHERE d.id = ?`,
      args: [id]
    });

    if (demandeResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Demande non trouvée' }, { status: 404 });
    }
    const demande = demandeResult.rows[0];

    if (demande.statut !== 'en_attente') {
      return NextResponse.json({ success: false, message: 'Cette demande a déjà été traitée' }, { status: 400 });
    }

    try {
      const result = force_rh
        ? await forceValidateRecuperationByRH(id, validatorId, decision, commentaire || '', 'demandes_utilisation_recup')
        : await validateRecuperationAtLevel(id, validatorId, decision, commentaire || '', 'demandes_utilisation_recup');

      if (result.isFinal) {
        try {
          await sendPushToUser(demande.user_id, {
            title: decision === 'validee' ? 'Utilisation de récupération validée' : 'Utilisation de récupération refusée',
            body: decision === 'validee'
              ? 'Votre demande d\'utilisation de récupération a été acceptée'
              : 'Votre demande d\'utilisation de récupération a été refusée',
            url: '/recuperation',
            tag: 'recup-util-decision'
          });
        } catch (e) { /* ignore */ }
      } else {
        try {
          await sendPushToUser(demande.user_id, {
            title: 'Avancement de votre demande',
            body: result.message,
            url: '/recuperation',
            tag: `recup-util-progress-${id}`
          });
        } catch (e) { /* ignore */ }
        if (result.nextLevel === 'rh') {
          try {
            await sendPushToRH({
              title: 'Utilisation de récupération en attente RH',
              body: `La demande de ${demande.prenom} ${demande.nom} nécessite votre validation`,
              url: '/validation',
              tag: `recup-util-${id}`
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
      return NextResponse.json({ success: false, message: validationError.message }, { status: 403 });
    }
  } catch (error) {
    console.error('Error processing utilisation recup:', error);
    return NextResponse.json({ success: false, message: `Erreur` }, { status: 500 });
  }
}
