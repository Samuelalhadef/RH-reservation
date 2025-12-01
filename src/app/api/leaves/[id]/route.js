import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function DELETE(request, { params }) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { id } = params;
    const userId = user.userId || user.id;

    // Récupérer la demande
    const leaveResult = await db.execute({
      sql: 'SELECT * FROM demandes_conges WHERE id = ? AND user_id = ?',
      args: [id, userId]
    });

    if (leaveResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Demande non trouvée ou vous n\'êtes pas autorisé à la supprimer' },
        { status: 404 }
      );
    }

    const leave = leaveResult.rows[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(leave.date_debut);

    // Vérifier que la date n'est pas passée
    if (startDate < today) {
      return NextResponse.json(
        { success: false, message: 'Vous ne pouvez pas supprimer une demande dont la date est déjà passée' },
        { status: 400 }
      );
    }

    // Vérifier que la demande est en attente
    if (leave.statut !== 'en_attente') {
      return NextResponse.json(
        { success: false, message: 'Vous ne pouvez supprimer que les demandes en attente' },
        { status: 400 }
      );
    }

    // Supprimer la demande
    await db.execute({
      sql: 'DELETE FROM demandes_conges WHERE id = ?',
      args: [id]
    });

    return NextResponse.json({
      success: true,
      message: 'Demande supprimée avec succès'
    });
  } catch (error) {
    console.error('Error deleting leave request:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la suppression de la demande' },
      { status: 500 }
    );
  }
}
