import { db } from '../config/database.js';
import {
  calculateBusinessDays,
  isAtLeast7DaysInAdvance,
  hasOverlap,
  formatDateFR
} from '../utils/dateUtils.js';
import {
  sendLeaveApprovedEmail,
  sendLeaveRejectedEmail,
  sendNewLeaveRequestEmail
} from '../utils/emailService.js';

/**
 * Récupère toutes les demandes de congés (avec filtres optionnels)
 */
export const getAllLeaves = async (req, res) => {
  try {
    const { userId, status, year } = req.query;

    let sql = `
      SELECT dc.*, u.nom, u.prenom, u.email, u.type_utilisateur,
             v.nom as validateur_nom, v.prenom as validateur_prenom
      FROM demandes_conges dc
      JOIN users u ON dc.user_id = u.id
      LEFT JOIN users v ON dc.validateur_id = v.id
      WHERE 1=1
    `;
    const args = [];

    // Filtrer par année seulement si spécifié
    if (year) {
      sql += ' AND strftime(\'%Y\', dc.date_debut) = ?';
      args.push(year.toString());
    }

    if (userId) {
      sql += ' AND dc.user_id = ?';
      args.push(userId);
    }

    if (status) {
      sql += ' AND dc.statut = ?';
      args.push(status);
    }

    sql += ' ORDER BY dc.date_demande DESC';

    const result = await db.execute({ sql, args });

    res.json({
      success: true,
      leaves: result.rows
    });
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des demandes'
    });
  }
};

/**
 * Récupère les demandes de l'utilisateur connecté
 */
export const getMyLeaves = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.execute({
      sql: `
        SELECT dc.*, v.nom as validateur_nom, v.prenom as validateur_prenom
        FROM demandes_conges dc
        LEFT JOIN users v ON dc.validateur_id = v.id
        WHERE dc.user_id = ?
        ORDER BY dc.date_demande DESC
      `,
      args: [userId]
    });

    res.json({
      success: true,
      leaves: result.rows
    });
  } catch (error) {
    console.error('Error fetching my leaves:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de vos demandes'
    });
  }
};

/**
 * Crée une nouvelle demande de congés
 */
export const createLeaveRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date_debut, date_fin, motif } = req.body;

    if (!date_debut || !date_fin) {
      return res.status(400).json({
        success: false,
        message: 'Les dates de début et de fin sont requises'
      });
    }

    // Vérifier que la date de début est avant la date de fin
    if (new Date(date_debut) > new Date(date_fin)) {
      return res.status(400).json({
        success: false,
        message: 'La date de début doit être avant la date de fin'
      });
    }

    // Vérifier le délai minimum de 7 jours
    if (!isAtLeast7DaysInAdvance(date_debut)) {
      return res.status(400).json({
        success: false,
        message: 'Les demandes doivent être faites au moins 7 jours à l\'avance'
      });
    }

    // Récupérer les jours fériés de l'année
    const holidaysResult = await db.execute({
      sql: `
        SELECT date FROM jours_feries
        WHERE date >= ? AND date <= ?
      `,
      args: [date_debut, date_fin]
    });
    const holidays = holidaysResult.rows.map(row => row.date);

    // Vérifier si la période contient UNIQUEMENT des jours fériés ou week-ends
    // Si c'est le cas, on refuse la demande
    if (holidays.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas prendre de congés sur des jours fériés. La période sélectionnée contient des jours chômés.'
      });
    }

    // Calculer le nombre de jours ouvrés
    const businessDays = calculateBusinessDays(date_debut, date_fin, holidays);

    if (businessDays === 0) {
      return res.status(400).json({
        success: false,
        message: 'La période sélectionnée ne contient aucun jour ouvré'
      });
    }

    // Vérifier le solde de congés
    // Utiliser l'année de la date de début de la demande
    const requestYear = new Date(date_debut).getFullYear();
    const balanceResult = await db.execute({
      sql: 'SELECT jours_restants FROM soldes_conges WHERE user_id = ? AND annee = ?',
      args: [userId, requestYear]
    });

    if (balanceResult.rows.length === 0) {
      // Créer le solde si inexistant
      await db.execute({
        sql: `
          INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants, jours_reportes, jours_fractionnement)
          VALUES (?, ?, 25, 0, 25, 0, 0)
        `,
        args: [userId, requestYear]
      });
    }

    // Récupérer à nouveau le solde après création éventuelle
    const updatedBalanceResult = await db.execute({
      sql: 'SELECT jours_restants FROM soldes_conges WHERE user_id = ? AND annee = ?',
      args: [userId, requestYear]
    });

    const joursRestants = updatedBalanceResult.rows[0]?.jours_restants || 25;

    if (businessDays > joursRestants) {
      return res.status(400).json({
        success: false,
        message: `Solde insuffisant. Vous avez ${joursRestants} jour(s) disponible(s)`
      });
    }

    // Vérifier les chevauchements avec d'autres demandes VALIDÉES uniquement
    const validatedOverlapResult = await db.execute({
      sql: `
        SELECT COUNT(*) as count FROM demandes_conges
        WHERE user_id = ? AND statut = 'validee'
        AND ((date_debut <= ? AND date_fin >= ?)
             OR (date_debut <= ? AND date_fin >= ?)
             OR (date_debut >= ? AND date_fin <= ?))
      `,
      args: [userId, date_fin, date_debut, date_debut, date_debut, date_debut, date_fin]
    });

    if (validatedOverlapResult.rows[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà une demande validée sur cette période. Vous ne pouvez pas la modifier.'
      });
    }

    // Supprimer automatiquement les demandes EN ATTENTE qui chevauchent
    const pendingOverlapResult = await db.execute({
      sql: `
        SELECT id, date_debut, date_fin FROM demandes_conges
        WHERE user_id = ? AND statut = 'en_attente'
        AND ((date_debut <= ? AND date_fin >= ?)
             OR (date_debut <= ? AND date_fin >= ?)
             OR (date_debut >= ? AND date_fin <= ?))
      `,
      args: [userId, date_fin, date_debut, date_debut, date_debut, date_debut, date_fin]
    });

    // Supprimer les demandes en attente qui chevauchent
    if (pendingOverlapResult.rows.length > 0) {
      for (const pendingLeave of pendingOverlapResult.rows) {
        await db.execute({
          sql: 'DELETE FROM demandes_conges WHERE id = ?',
          args: [pendingLeave.id]
        });
      }
      console.log(`Supprimé ${pendingOverlapResult.rows.length} demande(s) en attente qui chevauchaient`);
    }

    // Créer la demande
    const result = await db.execute({
      sql: `
        INSERT INTO demandes_conges (user_id, date_debut, date_fin, nombre_jours_ouvres, motif, statut)
        VALUES (?, ?, ?, ?, ?, 'en_attente')
      `,
      args: [userId, date_debut, date_fin, businessDays, motif || null]
    });

    // Récupérer les infos de l'utilisateur pour l'email
    const userResult = await db.execute({
      sql: 'SELECT nom, prenom FROM users WHERE id = ?',
      args: [userId]
    });
    const user = userResult.rows[0];

    // Récupérer les emails des RH
    const rhResult = await db.execute({
      sql: 'SELECT email FROM users WHERE type_utilisateur = "RH" AND actif = 1'
    });

    // Envoyer notification aux RH
    for (const rh of rhResult.rows) {
      await sendNewLeaveRequestEmail(
        rh.email,
        `${user.prenom} ${user.nom}`,
        formatDateFR(date_debut),
        formatDateFR(date_fin),
        businessDays
      );
    }

    res.status(201).json({
      success: true,
      message: 'Demande de congés créée avec succès',
      leaveId: result.lastInsertRowid,
      businessDays
    });
  } catch (error) {
    console.error('Error creating leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la demande'
    });
  }
};

/**
 * Valide ou refuse une demande de congés (RH uniquement)
 */
export const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, commentaire_rh } = req.body;
    const validatorId = req.user.id;

    if (!statut || !['validee', 'refusee'].includes(statut)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide'
      });
    }

    // Récupérer la demande
    const leaveResult = await db.execute({
      sql: `
        SELECT dc.*, u.nom, u.prenom, u.email
        FROM demandes_conges dc
        JOIN users u ON dc.user_id = u.id
        WHERE dc.id = ?
      `,
      args: [id]
    });

    if (leaveResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée'
      });
    }

    const leave = leaveResult.rows[0];

    if (leave.statut !== 'en_attente') {
      return res.status(400).json({
        success: false,
        message: 'Cette demande a déjà été traitée'
      });
    }

    // Mettre à jour la demande
    await db.execute({
      sql: `
        UPDATE demandes_conges
        SET statut = ?, date_validation = CURRENT_TIMESTAMP, validateur_id = ?, commentaire_rh = ?
        WHERE id = ?
      `,
      args: [statut, validatorId, commentaire_rh || null, id]
    });

    // Mettre à jour le solde si validée
    if (statut === 'validee') {
      const currentYear = new Date(leave.date_debut).getFullYear();
      await db.execute({
        sql: `
          UPDATE soldes_conges
          SET jours_pris = jours_pris + ?,
              jours_restants = jours_restants - ?
          WHERE user_id = ? AND annee = ?
        `,
        args: [leave.nombre_jours_ouvres, leave.nombre_jours_ouvres, leave.user_id, currentYear]
      });

      // Envoyer email de validation
      await sendLeaveApprovedEmail(
        leave.email,
        `${leave.prenom} ${leave.nom}`,
        formatDateFR(leave.date_debut),
        formatDateFR(leave.date_fin),
        leave.nombre_jours_ouvres
      );
    } else {
      // Envoyer email de refus
      await sendLeaveRejectedEmail(
        leave.email,
        `${leave.prenom} ${leave.nom}`,
        formatDateFR(leave.date_debut),
        formatDateFR(leave.date_fin),
        commentaire_rh
      );
    }

    res.json({
      success: true,
      message: `Demande ${statut === 'validee' ? 'validée' : 'refusée'} avec succès`
    });
  } catch (error) {
    console.error('Error updating leave status:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la demande'
    });
  }
};

/**
 * Récupère le calendrier global (toutes les absences validées)
 */
export const getCalendar = async (req, res) => {
  try {
    const { year, month } = req.query;

    let sql = `
      SELECT dc.id, dc.date_debut, dc.date_fin, dc.nombre_jours_ouvres,
             u.id as user_id, u.nom, u.prenom, u.type_utilisateur
      FROM demandes_conges dc
      JOIN users u ON dc.user_id = u.id
      WHERE dc.statut = 'validee'
    `;
    const args = [];

    // Filtrer par année si fournie, sinon récupérer toutes les années
    if (year) {
      sql += ' AND strftime("%Y", dc.date_debut) = ?';
      args.push(year.toString());
    }

    if (month) {
      sql += ' AND strftime("%m", dc.date_debut) = ?';
      args.push(month.toString().padStart(2, '0'));
    }

    sql += ' ORDER BY dc.date_debut';

    const result = await db.execute({ sql, args });

    res.json({
      success: true,
      events: result.rows
    });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du calendrier'
    });
  }
};

/**
 * Supprime une demande de congé (uniquement si elle n'est pas encore passée et en attente)
 */
export const deleteLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Récupérer la demande
    const leaveResult = await db.execute({
      sql: 'SELECT * FROM demandes_conges WHERE id = ? AND user_id = ?',
      args: [id, userId]
    });

    if (leaveResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée ou vous n\'êtes pas autorisé à la supprimer'
      });
    }

    const leave = leaveResult.rows[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(leave.date_debut);

    // Vérifier que la date n'est pas passée
    if (startDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas supprimer une demande dont la date est déjà passée'
      });
    }

    // Vérifier que la demande est en attente
    if (leave.statut !== 'en_attente') {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez supprimer que les demandes en attente'
      });
    }

    // Supprimer la demande
    await db.execute({
      sql: 'DELETE FROM demandes_conges WHERE id = ?',
      args: [id]
    });

    res.json({
      success: true,
      message: 'Demande supprimée avec succès'
    });
  } catch (error) {
    console.error('Error deleting leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la demande'
    });
  }
};

/**
 * Supprime une demande de congé (RH uniquement - peut supprimer même les demandes validées)
 */
export const deleteLeaveRequestByRH = async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer la demande
    const leaveResult = await db.execute({
      sql: 'SELECT * FROM demandes_conges WHERE id = ?',
      args: [id]
    });

    if (leaveResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée'
      });
    }

    const leave = leaveResult.rows[0];
    const requestYear = new Date(leave.date_debut).getFullYear();

    // Si la demande était validée, restaurer le solde de congés
    if (leave.statut === 'validee') {
      await db.execute({
        sql: `
          UPDATE soldes_conges
          SET jours_pris = jours_pris - ?,
              jours_restants = jours_restants + ?
          WHERE user_id = ? AND annee = ?
        `,
        args: [leave.nombre_jours_ouvres, leave.nombre_jours_ouvres, leave.user_id, requestYear]
      });
    }

    // Supprimer la demande
    await db.execute({
      sql: 'DELETE FROM demandes_conges WHERE id = ?',
      args: [id]
    });

    res.json({
      success: true,
      message: 'Demande supprimée avec succès'
    });
  } catch (error) {
    console.error('Error deleting leave request by RH:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la demande'
    });
  }
};

/**
 * Récupère les statistiques pour le tableau de bord RH
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();

    // Statistiques globales des demandes
    const statsResult = await db.execute({
      sql: `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN statut = 'en_attente' THEN 1 ELSE 0 END) as en_attente,
          SUM(CASE WHEN statut = 'validee' THEN 1 ELSE 0 END) as validee,
          SUM(CASE WHEN statut = 'refusee' THEN 1 ELSE 0 END) as refusee,
          SUM(CASE WHEN statut = 'validee' THEN nombre_jours_ouvres ELSE 0 END) as total_jours_valides
        FROM demandes_conges
        WHERE strftime('%Y', date_debut) = ?
      `,
      args: [currentYear.toString()]
    });

    // Demandes par mois
    const monthlyResult = await db.execute({
      sql: `
        SELECT
          strftime('%m', date_debut) as mois,
          COUNT(*) as total,
          SUM(CASE WHEN statut = 'validee' THEN 1 ELSE 0 END) as validees,
          SUM(CASE WHEN statut = 'refusee' THEN 1 ELSE 0 END) as refusees,
          SUM(CASE WHEN statut = 'en_attente' THEN 1 ELSE 0 END) as en_attente
        FROM demandes_conges
        WHERE strftime('%Y', date_debut) = ?
        GROUP BY strftime('%m', date_debut)
        ORDER BY mois
      `,
      args: [currentYear.toString()]
    });

    // Demandes par type d'utilisateur
    const userTypeResult = await db.execute({
      sql: `
        SELECT
          u.type_utilisateur,
          COUNT(*) as total_demandes,
          SUM(CASE WHEN dc.statut = 'validee' THEN 1 ELSE 0 END) as validees,
          SUM(CASE WHEN dc.statut = 'validee' THEN dc.nombre_jours_ouvres ELSE 0 END) as jours_pris
        FROM demandes_conges dc
        JOIN users u ON dc.user_id = u.id
        WHERE strftime('%Y', dc.date_debut) = ?
        GROUP BY u.type_utilisateur
      `,
      args: [currentYear.toString()]
    });

    // Top 10 des employés avec le plus de congés pris
    const topUsersResult = await db.execute({
      sql: `
        SELECT
          u.nom,
          u.prenom,
          u.type_utilisateur,
          COUNT(*) as nombre_demandes,
          SUM(CASE WHEN dc.statut = 'validee' THEN dc.nombre_jours_ouvres ELSE 0 END) as jours_pris,
          sc.jours_restants
        FROM demandes_conges dc
        JOIN users u ON dc.user_id = u.id
        LEFT JOIN soldes_conges sc ON u.id = sc.user_id AND sc.annee = ?
        WHERE strftime('%Y', dc.date_debut) = ?
        GROUP BY u.id
        ORDER BY jours_pris DESC
        LIMIT 10
      `,
      args: [currentYear.toString(), currentYear.toString()]
    });

    // Statistiques des soldes
    const balancesResult = await db.execute({
      sql: `
        SELECT
          COUNT(*) as total_users,
          SUM(jours_acquis) as total_acquis,
          SUM(jours_pris) as total_pris,
          SUM(jours_restants) as total_restants,
          AVG(jours_restants) as moyenne_restants
        FROM soldes_conges
        WHERE annee = ?
      `,
      args: [currentYear.toString()]
    });

    // Distribution des soldes restants
    const balanceDistributionResult = await db.execute({
      sql: `
        SELECT
          CASE
            WHEN jours_restants = 0 THEN '0 jours'
            WHEN jours_restants BETWEEN 1 AND 5 THEN '1-5 jours'
            WHEN jours_restants BETWEEN 6 AND 10 THEN '6-10 jours'
            WHEN jours_restants BETWEEN 11 AND 15 THEN '11-15 jours'
            WHEN jours_restants BETWEEN 16 AND 20 THEN '16-20 jours'
            ELSE '21+ jours'
          END as tranche,
          COUNT(*) as nombre_employes
        FROM soldes_conges sc
        JOIN users u ON sc.user_id = u.id
        WHERE sc.annee = ? AND u.actif = 1
        GROUP BY tranche
        ORDER BY
          CASE tranche
            WHEN '0 jours' THEN 1
            WHEN '1-5 jours' THEN 2
            WHEN '6-10 jours' THEN 3
            WHEN '11-15 jours' THEN 4
            WHEN '16-20 jours' THEN 5
            ELSE 6
          END
      `,
      args: [currentYear.toString()]
    });

    // Taux d'approbation par mois
    const approvalRateResult = await db.execute({
      sql: `
        SELECT
          strftime('%m', date_validation) as mois,
          COUNT(*) as total_traitees,
          SUM(CASE WHEN statut = 'validee' THEN 1 ELSE 0 END) as validees,
          ROUND(CAST(SUM(CASE WHEN statut = 'validee' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 1) as taux_approbation
        FROM demandes_conges
        WHERE strftime('%Y', date_validation) = ? AND statut != 'en_attente'
        GROUP BY strftime('%m', date_validation)
        ORDER BY mois
      `,
      args: [currentYear.toString()]
    });

    // Statistiques par trimestre
    const quarterlyResult = await db.execute({
      sql: `
        SELECT
          CASE
            WHEN CAST(strftime('%m', date_debut) AS INTEGER) BETWEEN 1 AND 3 THEN 'T1'
            WHEN CAST(strftime('%m', date_debut) AS INTEGER) BETWEEN 4 AND 6 THEN 'T2'
            WHEN CAST(strftime('%m', date_debut) AS INTEGER) BETWEEN 7 AND 9 THEN 'T3'
            ELSE 'T4'
          END as trimestre,
          COUNT(*) as total_demandes,
          SUM(CASE WHEN statut = 'validee' THEN nombre_jours_ouvres ELSE 0 END) as jours_valides
        FROM demandes_conges
        WHERE strftime('%Y', date_debut) = ?
        GROUP BY trimestre
        ORDER BY
          CASE trimestre
            WHEN 'T1' THEN 1
            WHEN 'T2' THEN 2
            WHEN 'T3' THEN 3
            ELSE 4
          END
      `,
      args: [currentYear.toString()]
    });

    // Durée moyenne des congés par type d'utilisateur
    const avgDurationResult = await db.execute({
      sql: `
        SELECT
          u.type_utilisateur,
          ROUND(AVG(dc.nombre_jours_ouvres), 2) as duree_moyenne,
          COUNT(*) as nombre_demandes
        FROM demandes_conges dc
        JOIN users u ON dc.user_id = u.id
        WHERE strftime('%Y', dc.date_debut) = ? AND dc.statut = 'validee'
        GROUP BY u.type_utilisateur
      `,
      args: [currentYear.toString()]
    });

    // Délai moyen de validation (en jours)
    const avgValidationTimeResult = await db.execute({
      sql: `
        SELECT
          ROUND(AVG(julianday(date_validation) - julianday(date_demande)), 1) as delai_moyen_jours
        FROM demandes_conges
        WHERE strftime('%Y', date_debut) = ? AND statut != 'en_attente' AND date_validation IS NOT NULL
      `,
      args: [currentYear.toString()]
    });

    // Congés par jour de la semaine (début de congé)
    const weekdayResult = await db.execute({
      sql: `
        SELECT
          CASE CAST(strftime('%w', date_debut) AS INTEGER)
            WHEN 0 THEN 'Dimanche'
            WHEN 1 THEN 'Lundi'
            WHEN 2 THEN 'Mardi'
            WHEN 3 THEN 'Mercredi'
            WHEN 4 THEN 'Jeudi'
            WHEN 5 THEN 'Vendredi'
            WHEN 6 THEN 'Samedi'
          END as jour_semaine,
          COUNT(*) as nombre_demandes
        FROM demandes_conges
        WHERE strftime('%Y', date_debut) = ? AND statut = 'validee'
        GROUP BY CAST(strftime('%w', date_debut) AS INTEGER)
        ORDER BY CAST(strftime('%w', date_debut) AS INTEGER)
      `,
      args: [currentYear.toString()]
    });

    // Taux d'utilisation des congés par utilisateur
    const utilizationResult = await db.execute({
      sql: `
        SELECT
          u.type_utilisateur,
          ROUND(AVG(CAST(sc.jours_pris AS FLOAT) / sc.jours_acquis * 100), 1) as taux_utilisation
        FROM soldes_conges sc
        JOIN users u ON sc.user_id = u.id
        WHERE sc.annee = ? AND sc.jours_acquis > 0 AND u.actif = 1
        GROUP BY u.type_utilisateur
      `,
      args: [currentYear.toString()]
    });

    res.json({
      success: true,
      stats: {
        global: statsResult.rows[0],
        monthly: monthlyResult.rows,
        byUserType: userTypeResult.rows,
        topUsers: topUsersResult.rows,
        balances: balancesResult.rows[0],
        balanceDistribution: balanceDistributionResult.rows,
        approvalRate: approvalRateResult.rows,
        quarterly: quarterlyResult.rows,
        avgDuration: avgDurationResult.rows,
        avgValidationTime: avgValidationTimeResult.rows[0],
        weekday: weekdayResult.rows,
        utilization: utilizationResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};
