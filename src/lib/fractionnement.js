import { db } from './db.js';
import { totalDroits } from './soldes.js';
import { toDayUTC } from './dateUtils.js';

/**
 * Calcule le nombre de jours ouvrés hors période principale (mai-octobre)
 * pour un congé donné.
 * @param {string} dateDebut - Date de début (YYYY-MM-DD)
 * @param {string} dateFin - Date de fin (YYYY-MM-DD)
 * @returns {number} Nombre de jours ouvrés hors période principale
 */
function countDaysOutsideMainPeriod(dateDebut, dateFin) {
  const start = toDayUTC(dateDebut);
  const end = toDayUTC(dateFin);
  let count = 0;

  for (let t = start; t <= end; t += 24 * 60 * 60 * 1000) {
    const d = new Date(t);
    const dayOfWeek = d.getUTCDay();
    // Exclure weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const month = d.getUTCMonth(); // 0-11
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
    sql: 'SELECT jours_acquis, jours_reportes, jours_fractionnement, jours_compensateurs, jours_cet, jours_pris FROM soldes_conges WHERE user_id = ? AND annee = ?',
    args: [userId, year]
  });

  if (soldeResult.rows.length > 0) {
    const s = soldeResult.rows[0];
    const totalAcquis = totalDroits({ ...s, jours_fractionnement: fractionnement });
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

/**
 * Recalcul complet du solde d'une année : jours_pris, jours_fractionnement et
 * jours_restants en 3 requêtes (au lieu de 6 pour recalculateBalance() suivi de
 * recalculateFractionnement()). À utiliser après toute validation, annulation
 * ou création de congé.
 *
 * @param {number} userId - ID de l'utilisateur
 * @param {number} year - Année concernée
 * @returns {Promise<{jours_pris: number, jours_fractionnement: number, jours_restants: number}|null>}
 *   null si aucune ligne soldes_conges pour cette année
 */
export async function recalculateSoldeComplet(userId, year) {
  const [leavesResult, soldeResult] = await Promise.all([
    db.execute({
      sql: `
        SELECT date_debut, date_fin, nombre_jours_ouvres
        FROM demandes_conges
        WHERE user_id = ? AND statut = 'validee'
          AND strftime('%Y', date_debut) = ?
      `,
      args: [userId, String(year)]
    }),
    db.execute({
      sql: 'SELECT jours_acquis, jours_reportes, jours_compensateurs, jours_cet FROM soldes_conges WHERE user_id = ? AND annee = ?',
      args: [userId, year]
    }),
  ]);

  if (soldeResult.rows.length === 0) return null;

  let joursPris = 0;
  let totalDaysOutside = 0;
  for (const leave of leavesResult.rows) {
    joursPris += Number(leave.nombre_jours_ouvres) || 0;
    totalDaysOutside += countDaysOutsideMainPeriod(leave.date_debut, leave.date_fin);
  }
  const fractionnement = applyFractionnementRules(totalDaysOutside);
  const restants = totalDroits({ ...soldeResult.rows[0], jours_fractionnement: fractionnement }) - joursPris;

  await db.execute({
    sql: `
      UPDATE soldes_conges
      SET jours_pris = ?, jours_fractionnement = ?, jours_restants = ?
      WHERE user_id = ? AND annee = ?
    `,
    args: [joursPris, fractionnement, restants, userId, year]
  });

  return { jours_pris: joursPris, jours_fractionnement: fractionnement, jours_restants: restants };
}
