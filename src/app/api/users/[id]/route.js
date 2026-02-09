import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { calculateLeaveBalance } from '@/lib/contractUtils';

export async function PUT(request, { params }) {
  try {
    const { authorized } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { nom, prenom, email, type_utilisateur, service, poste, actif, type_contrat, date_debut_contrat, date_fin_contrat, date_entree_mairie } = await request.json();

    if (!nom || !prenom || !email || !type_utilisateur) {
      return NextResponse.json(
        { success: false, message: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    // Validation: si CDD, les dates sont requises
    if (type_contrat === 'CDD' && (!date_debut_contrat || !date_fin_contrat)) {
      return NextResponse.json(
        { success: false, message: 'Les dates de début et fin sont requises pour un CDD' },
        { status: 400 }
      );
    }

    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE id = ?',
      args: [id]
    });

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Récupérer les anciennes valeurs pour vérifier si le contrat a changé
    const oldUserResult = await db.execute({
      sql: 'SELECT type_contrat, date_debut_contrat, date_fin_contrat FROM users WHERE id = ?',
      args: [id]
    });
    const oldUser = oldUserResult.rows[0];

    await db.execute({
      sql: `
        UPDATE users
        SET nom = ?, prenom = ?, email = ?, type_utilisateur = ?, service = ?, poste = ?, actif = ?,
            type_contrat = ?, date_debut_contrat = ?, date_fin_contrat = ?, date_entree_mairie = ?
        WHERE id = ?
      `,
      args: [
        nom,
        prenom,
        email,
        type_utilisateur,
        service || null,
        poste || null,
        actif ? 1 : 0,
        type_contrat || 'CDI',
        date_debut_contrat || null,
        date_fin_contrat || null,
        date_entree_mairie || null,
        id
      ]
    });

    // Si le type de contrat ou les dates ont changé, recalculer le solde
    const contractChanged =
      oldUser.type_contrat !== (type_contrat || 'CDI') ||
      oldUser.date_debut_contrat !== date_debut_contrat ||
      oldUser.date_fin_contrat !== date_fin_contrat;

    if (contractChanged) {
      const currentYear = new Date().getFullYear();
      const newJoursAcquis = calculateLeaveBalance(type_contrat || 'CDI', date_debut_contrat, date_fin_contrat, currentYear);

      // Récupérer les jours déjà pris
      const balanceResult = await db.execute({
        sql: 'SELECT jours_pris FROM soldes_conges WHERE user_id = ? AND annee = ?',
        args: [id, currentYear]
      });

      if (balanceResult.rows.length > 0) {
        const joursPris = balanceResult.rows[0].jours_pris || 0;
        const joursRestants = newJoursAcquis - joursPris;

        await db.execute({
          sql: `
            UPDATE soldes_conges
            SET jours_acquis = ?, jours_restants = ?
            WHERE user_id = ? AND annee = ?
          `,
          args: [newJoursAcquis, joursRestants, id, currentYear]
        });

        console.log(`Updated balance for user ${id}: ${newJoursAcquis} days acquired`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Utilisateur mis à jour avec succès'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    console.error('Error details:', error.message);
    return NextResponse.json(
      { success: false, message: `Erreur lors de la mise à jour de l'utilisateur: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { authorized } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Vérifier que l'utilisateur existe
    const existing = await db.execute({
      sql: 'SELECT id, nom, prenom FROM users WHERE id = ?',
      args: [id]
    });

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    const user = existing.rows[0];

    // Supprimer l'utilisateur (CASCADE supprimera aussi les soldes et demandes)
    await db.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [id]
    });

    console.log(`User deleted: ${user.prenom} ${user.nom} (ID: ${id})`);

    return NextResponse.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    console.error('Error details:', error.message);
    return NextResponse.json(
      { success: false, message: `Erreur lors de la suppression de l'utilisateur: ${error.message}` },
      { status: 500 }
    );
  }
}
