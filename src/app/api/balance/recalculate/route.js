import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { recalculateFractionnement } from '@/lib/fractionnement';

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
      // Recalculer jours_pris à partir des congés validés
      const totalResult = await db.execute({
        sql: `
          SELECT COALESCE(SUM(nombre_jours_ouvres), 0) as total_pris
          FROM demandes_conges
          WHERE user_id = ? AND statut = 'validee'
            AND strftime('%Y', date_debut) = ?
        `,
        args: [solde.user_id, String(currentYear)]
      });

      const totalPris = totalResult.rows[0]?.total_pris || 0;

      // D'abord recalculer le fractionnement
      const fractionnement = await recalculateFractionnement(solde.user_id, currentYear);

      // Re-lire le solde après le recalcul du fractionnement
      const updatedSolde = await db.execute({
        sql: 'SELECT jours_acquis, jours_reportes, jours_fractionnement, jours_compensateurs FROM soldes_conges WHERE user_id = ? AND annee = ?',
        args: [solde.user_id, currentYear]
      });

      if (updatedSolde.rows.length > 0) {
        const s = updatedSolde.rows[0];
        const totalAcquis = (s.jours_acquis || 0) + (s.jours_reportes || 0) + (s.jours_fractionnement || 0) + (s.jours_compensateurs || 0);
        const restants = totalAcquis - totalPris;

        await db.execute({
          sql: `
            UPDATE soldes_conges
            SET jours_pris = ?,
                jours_restants = ?
            WHERE user_id = ? AND annee = ?
          `,
          args: [totalPris, restants, solde.user_id, currentYear]
        });
        corrected++;
      }
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
      { success: false, message: 'Erreur lors du recalcul: ' + error.message },
      { status: 500 }
    );
  }
}
