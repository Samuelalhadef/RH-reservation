import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { recalculateFractionnement } from '@/lib/fractionnement';
import { recalculateBalance } from '@/lib/soldes';

export async function POST(request) {
  try {
    const { authorized } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé - Réservé aux RH' },
        { status: 403 }
      );
    }

    const currentYear = new Date().getFullYear();

    // Récupérer tous les soldes de l'année en cours
    const soldes = await db.execute({
      sql: 'SELECT user_id, jours_acquis, jours_reportes, jours_fractionnement, jours_compensateurs, jours_pris, jours_restants FROM soldes_conges WHERE annee = ?',
      args: [currentYear]
    });

    let corrected = 0;

    for (const solde of soldes.rows) {
      // D'abord recalculer le fractionnement, puis le solde (CET inclus)
      await recalculateFractionnement(solde.user_id, currentYear);
      const result = await recalculateBalance(solde.user_id, currentYear);
      if (result) corrected++;
    }

    return NextResponse.json({
      success: true,
      message: `Recalcul terminé. ${corrected} solde(s) recalculé(s) (dont fractionnement) sur ${soldes.rows.length} utilisateur(s).`,
      corrected,
      total: soldes.rows.length
    });

  } catch (error) {
    console.error('Error recalculating balances:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors du recalcul' },
      { status: 500 }
    );
  }
}
