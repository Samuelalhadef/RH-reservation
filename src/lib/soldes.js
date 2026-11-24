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
 * Solde réellement disponible pour une nouvelle demande ou une validation :
 * droits − congés validés − congés encore en attente.
 * Lecture seule (n'écrit rien en base).
 *
 * Sans la déduction des demandes en attente, un agent peut poser plusieurs
 * demandes qui passent chacune le contrôle, puis être validées et faire
 * passer le solde en négatif.
 *
 * @param {number} userId
 * @param {number} year
 * @param {number[]} [excludeIds] - demandes à ignorer (celle qu'on valide,
 *   ou des demandes en attente qui vont être remplacées)
 * @returns {Promise<{pris: number, restants: number, enAttente: number, disponible: number}|null>}
 *   null si aucune ligne soldes_conges pour cette année
 */
export async function getSoldeDisponible(userId, year, excludeIds = []) {
  const soldeResult = await db.execute({
    sql: `SELECT jours_acquis, jours_reportes, jours_fractionnement, jours_compensateurs, jours_cet
          FROM soldes_conges WHERE user_id = ? AND annee = ?`,
    args: [userId, year]
  });
  if (soldeResult.rows.length === 0) return null;

  const exclude = excludeIds.map(Number).filter(Number.isFinite);
  const excludeSql = exclude.length ? ` AND id NOT IN (${exclude.map(() => '?').join(',')})` : '';

  const sumsResult = await db.execute({
    sql: `
      SELECT
        COALESCE(SUM(CASE WHEN statut = 'validee' THEN nombre_jours_ouvres END), 0) as pris,
        COALESCE(SUM(CASE WHEN statut = 'en_attente' THEN nombre_jours_ouvres END), 0) as en_attente
      FROM demandes_conges
      WHERE user_id = ? AND statut IN ('validee', 'en_attente')
        AND strftime('%Y', date_debut) = ?${excludeSql}
    `,
    args: [userId, String(year), ...exclude]
  });

  const pris = sumsResult.rows[0]?.pris || 0;
  const enAttente = sumsResult.rows[0]?.en_attente || 0;
  const restants = totalDroits(soldeResult.rows[0]) - pris;

  return { pris, restants, enAttente, disponible: restants - enAttente };
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
