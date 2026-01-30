import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { jours } = await request.json();

    if (!jours || jours <= 0) {
      return NextResponse.json(
        { success: false, message: 'Nombre de jours invalide' },
        { status: 400 }
      );
    }

    // Vérifier le solde de congés
    const currentYear = new Date().getFullYear();
    const balanceResult = await db.execute({
      sql: 'SELECT jours_restants FROM soldes_conges WHERE user_id = ? AND annee = ?',
      args: [user.userId, currentYear]
    });

    if (balanceResult.rows.length === 0 || balanceResult.rows[0].jours_restants < jours) {
      return NextResponse.json(
        { success: false, message: 'Solde de congés insuffisant' },
        { status: 400 }
      );
    }

    // Créer le CET s'il n'existe pas
    await db.execute({
      sql: 'INSERT OR IGNORE INTO cet (user_id, solde) VALUES (?, 0)',
      args: [user.userId]
    });

    // Transférer les jours
    // 1. Déduire du solde de congés
    await db.execute({
      sql: `
        UPDATE soldes_conges
        SET jours_restants = jours_restants - ?
        WHERE user_id = ? AND annee = ?
      `,
      args: [jours, user.userId, currentYear]
    });

    // 2. Ajouter au CET
    await db.execute({
      sql: 'UPDATE cet SET solde = solde + ? WHERE user_id = ?',
      args: [jours, user.userId]
    });

    // 3. Enregistrer dans l'historique
    await db.execute({
      sql: `
        INSERT INTO cet_historique (user_id, type, jours, motif)
        VALUES (?, 'credit', ?, 'Transfert depuis solde congés')
      `,
      args: [user.userId, jours]
    });

    return NextResponse.json({
      success: true,
      message: `${jours} jour(s) transféré(s) vers votre CET`
    });
  } catch (error) {
    console.error('Error transferring to CET:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors du transfert' },
      { status: 500 }
    );
  }
}
