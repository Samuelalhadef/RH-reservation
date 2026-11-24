import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { recalculateSoldeComplet } from '@/lib/fractionnement';

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

    // Recalcul complet (pris + fractionnement + restants) de tous les agents en
    // parallèle : 3 requêtes par agent au lieu de 6 exécutées l'une après l'autre
    const results = await Promise.all(
      soldes.rows.map((solde) => recalculateSoldeComplet(solde.user_id, currentYear))
    );
    const corrected = results.filter(Boolean).length;

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
