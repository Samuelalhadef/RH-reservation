import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';

// PUT - Valider/Refuser une demande d'utilisation (RH/DGS)
export async function PUT(request, { params }) {
  try {
    const { authorized, user } = await requireRH();
    if (!authorized) {
      return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    }

    const { id } = await params;
    const { action, commentaire } = await request.json();

    if (!['valider', 'refuser'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Action invalide' }, { status: 400 });
    }

    const demandeResult = await db.execute({
      sql: 'SELECT * FROM demandes_utilisation_recup WHERE id = ? AND statut = ?',
      args: [id, 'en_attente']
    });

    if (demandeResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Demande non trouvée ou déjà traitée' }, { status: 404 });
    }

    const demande = demandeResult.rows[0];
    const newStatut = action === 'valider' ? 'validee' : 'refusee';

    await db.execute({
      sql: `UPDATE demandes_utilisation_recup
            SET statut = ?, date_validation = CURRENT_TIMESTAMP, validateur_id = ?, commentaire = ?
            WHERE id = ?`,
      args: [newStatut, user.userId, commentaire || null, id]
    });

    return NextResponse.json({
      success: true,
      message: `Demande ${action === 'valider' ? 'validée' : 'refusée'}`
    });
  } catch (error) {
    console.error('Error processing utilisation recup:', error);
    return NextResponse.json({ success: false, message: `Erreur: ${error.message}` }, { status: 500 });
  }
}
