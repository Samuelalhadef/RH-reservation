import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH, verifyToken } from '@/lib/auth';
import { sendPushToUser } from '@/lib/pushNotifications';

// PUT - RH valide ou refuse une demande de parentalité
export async function PUT(request, { params }) {
  try {
    const { authorized } = await requireRH();
    if (!authorized) {
      return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    }

    const token = request.cookies.get('auth_token')?.value;
    const decoded = verifyToken(token);
    const validatorId = decoded?.userId;

    const { id } = await params;
    const { action, commentaire } = await request.json();

    if (!['valider', 'refuser'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Action invalide' },
        { status: 400 }
      );
    }

    const statut = action === 'valider' ? 'validee' : 'refusee';

    const demandeResult = await db.execute({
      sql: `SELECT d.*, u.nom, u.prenom
            FROM demandes_parentalite d
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

    await db.execute({
      sql: `
        UPDATE demandes_parentalite
        SET statut = ?, date_validation = CURRENT_TIMESTAMP, validateur_id = ?, commentaire_rh = ?
        WHERE id = ?
      `,
      args: [statut, validatorId || null, commentaire || null, id]
    });

    const typeLabel = demande.type === 'maternite'
      ? 'maternité'
      : demande.type === 'paternite'
      ? 'paternité'
      : 'adoption';

    try {
      await sendPushToUser(demande.user_id, {
        title: action === 'valider' ? 'Demande validée' : 'Demande refusée',
        body: `Votre demande de congé ${typeLabel} a été ${action === 'valider' ? 'validée' : 'refusée'}`,
        url: '/recuperation',
        tag: `parentalite-${id}`
      });
    } catch (e) { /* ignore push errors */ }

    return NextResponse.json({
      success: true,
      message: `Demande ${statut === 'validee' ? 'validée' : 'refusée'} avec succès`
    });
  } catch (error) {
    console.error('Error updating parentalite status:', error);
    return NextResponse.json(
      { success: false, message: `Erreur` },
      { status: 500 }
    );
  }
}
