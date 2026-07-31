import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, isRHType } from '@/lib/auth';

// GET - Détail d'une demande
export async function GET(request, { params }) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;

    const result = await db.execute({
      sql: `
        SELECT d.*,
               u.nom, u.prenom, u.service, u.poste,
               strftime('%d/%m/%Y', d.date_debut) as date_debut_fr,
               strftime('%d/%m/%Y', d.date_fin) as date_fin_fr,
               strftime('%d/%m/%Y', d.date_demande) as date_demande_fr
        FROM demandes_parentalite d
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

    // Contrôle d'accès : congés maternité/paternité/adoption contiennent des
    // documents sensibles (justificatifs médicaux). Seul le propriétaire ou la RH.
    const demande = result.rows[0];
    if (demande.user_id !== user.userId && !isRHType(user.type)) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      demande
    });
  } catch (error) {
    console.error('Error fetching parentalite request:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// DELETE - L'agent annule sa propre demande (uniquement si en_attente)
export async function DELETE(request, { params }) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.execute({
      sql: 'SELECT user_id, statut FROM demandes_parentalite WHERE id = ?',
      args: [id]
    });

    if (existing.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Demande non trouvée' }, { status: 404 });
    }

    const demande = existing.rows[0];
    if (demande.user_id !== user.userId) {
      return NextResponse.json({ success: false, message: 'Action non autorisée' }, { status: 403 });
    }

    if (demande.statut !== 'en_attente') {
      return NextResponse.json(
        { success: false, message: 'Seules les demandes en attente peuvent être annulées' },
        { status: 400 }
      );
    }

    await db.execute({
      sql: `UPDATE demandes_parentalite SET statut = 'annulee' WHERE id = ?`,
      args: [id]
    });

    return NextResponse.json({ success: true, message: 'Demande annulée' });
  } catch (error) {
    console.error('Error cancelling parentalite request:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
