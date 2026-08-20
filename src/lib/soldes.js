import { db } from './db.js';

/**
 * Total des droits à congés d'une ligne soldes_conges, hors jours déjà pris.
 * `jours_cet` est le solde net des mouvements CET validés de l'année :
 * négatif pour un versement congés -> CET, positif pour un retrait CET -> congés.
 * @param {Object} s - Ligne soldes_conges (jours_acquis, jours_reportes, ...)
 * @returns {number} Total des droits
 */
export function totalDroits(s) {
  return (s.jours_acquis || 0)
    + (s.jours_reportes || 0)
    + (s.jours_fractionnement || 0)
    + (s.jours_compensateurs || 0)
    + (s.jours_cet || 0);
}

/**
 * Recalcule jours_pris (à partir des congés validés) et jours_restants
 * (à partir de tous les droits, CET inclus) pour un utilisateur sur une année.
 *
 * C'est la SEULE source de vérité pour jours_restants : ne jamais incrémenter
 * cette colonne directement, elle est systématiquement recalculée ici.
 *
 * @param {number} userId - ID de l'utilisateur
 * @param {number} year - Année concernée
 * @returns {Promise<{jours_pris: number, jours_restants: number}|null>}
 */
export async function recalculateBalance(userId, year) {
  const totalResult = await db.execute({
    sql: `
      SELECT COALESCE(SUM(nombre_jours_ouvres), 0) as total_pris
      FROM demandes_conges
      WHERE user_id = ? AND statut = 'validee'
        AND strftime('%Y', date_debut) = ?
    `,
    args: [userId, String(year)]
  });
  const totalPris = totalResult.rows[0]?.total_pris || 0;

  const soldeResult = await db.execute({
    sql: `SELECT jours_acquis, jours_reportes, jours_fractionnement, jours_compensateurs, jours_cet
          FROM soldes_conges WHERE user_id = ? AND annee = ?`,
    args: [userId, year]
  });

  if (soldeResult.rows.length === 0) return null;

  const restants = totalDroits(soldeResult.rows[0]) - totalPris;

  await db.execute({
    sql: `
      UPDATE soldes_conges
      SET jours_pris = ?,
          jours_restants = ?
      WHERE user_id = ? AND annee = ?
    `,
    args: [totalPris, restants, userId, year]
  });

  return { jours_pris: totalPris, jours_restants: restants };
}
