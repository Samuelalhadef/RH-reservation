import { db } from './db.js';

/**
 * Calcule le nombre de jours ouvrés hors période principale (mai-octobre)
 * pour un congé donné.
 * @param {string} dateDebut - Date de début (YYYY-MM-DD)
 * @param {string} dateFin - Date de fin (YYYY-MM-DD)
 * @returns {number} Nombre de jours ouvrés hors période principale
 */
function countDaysOutsideMainPeriod(dateDebut, dateFin) {
  const start = new Date(dateDebut);
  const end = new Date(dateFin);
  let count = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    // Exclure weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const month = d.getMonth(); // 0-11
    // Hors période principale (mai=4, octobre=9) → mois 0-3 et 10-11
    if (month < 4 || month > 9) {
      count++;
    }
  }

  return count;
}

/**
 * Applique les règles de fractionnement :
 * - 3 à 5 jours hors période = 1 jour bonus
 * - 6+ jours hors période = 2 jours bonus
 * @param {number} daysOutside - Nombre total de jours ouvrés hors période principale
 * @returns {number} Jours de fractionnement accordés (0, 1 ou 2)
 */
function applyFractionnementRules(daysOutside) {
  if (daysOutside >= 6) return 2;
  if (daysOutside >= 3) return 1;
  return 0;
}

/**
 * Recalcule les jours de fractionnement pour un utilisateur sur une année donnée
 * en se basant sur TOUS ses congés validés hors période principale.
 * Met à jour soldes_conges.jours_fractionnement et jours_restants.
 *
 * @param {number} userId - ID de l'utilisateur
 * @param {number} year - Année concernée
 * @returns {Promise<number>} Le nombre de jours de fractionnement calculés
 */
export async function recalculateFractionnement(userId, year) {
  // Récupérer tous les congés validés de l'année
  const leavesResult = await db.execute({
    sql: `
      SELECT date_debut, date_fin
      FROM demandes_conges
      WHERE user_id = ? AND statut = 'validee'
        AND strftime('%Y', date_debut) = ?
    `,
    args: [userId, String(year)]
  });

  // Compter le total de jours ouvrés hors période principale
  let totalDaysOutside = 0;
  for (const leave of leavesResult.rows) {
    totalDaysOutside += countDaysOutsideMainPeriod(leave.date_debut, leave.date_fin);
  }

  // Appliquer les règles
  const fractionnement = applyFractionnementRules(totalDaysOutside);

  // Mettre à jour le solde
  const soldeResult = await db.execute({
    sql: 'SELECT jours_acquis, jours_reportes, jours_fractionnement, jours_compensateurs, jours_pris FROM soldes_conges WHERE user_id = ? AND annee = ?',
    args: [userId, year]
  });

  if (soldeResult.rows.length > 0) {
    const s = soldeResult.rows[0];
    const totalAcquis = (s.jours_acquis || 0) + (s.jours_reportes || 0) + fractionnement + (s.jours_compensateurs || 0);
    const restants = totalAcquis - (s.jours_pris || 0);

    await db.execute({
      sql: `
        UPDATE soldes_conges
        SET jours_fractionnement = ?,
            jours_restants = ?
        WHERE user_id = ? AND annee = ?
      `,
      args: [fractionnement, restants, userId, year]
    });
  }

  return fractionnement;
}
