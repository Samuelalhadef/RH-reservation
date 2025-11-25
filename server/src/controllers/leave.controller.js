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
    const currentYear = year || new Date().getFullYear();

    let sql = `
      SELECT dc.*, u.nom, u.prenom, u.email, u.type_utilisateur,
             v.nom as validateur_nom, v.prenom as validateur_prenom
      FROM demandes_conges dc
      JOIN users u ON dc.user_id = u.id
      LEFT JOIN users v ON dc.validateur_id = v.id
      WHERE strftime('%Y', dc.date_debut) = ?
    `;
    const args = [currentYear.toString()];

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

    // Calculer le nombre de jours ouvrés
    const businessDays = calculateBusinessDays(date_debut, date_fin, holidays);

    if (businessDays === 0) {
      return res.status(400).json({
        success: false,
        message: 'La période sélectionnée ne contient aucun jour ouvré'
      });
    }

    // Vérifier le solde de congés
    const currentYear = new Date().getFullYear();
    const balanceResult = await db.execute({
      sql: 'SELECT jours_restants FROM soldes_conges WHERE user_id = ? AND annee = ?',
      args: [userId, currentYear]
    });

    if (balanceResult.rows.length === 0) {
      // Créer le solde si inexistant
      await db.execute({
        sql: `
          INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants)
          VALUES (?, ?, 25, 0, 25)
        `,
        args: [userId, currentYear]
      });
    }

    const joursRestants = balanceResult.rows[0]?.jours_restants || 25;

    if (businessDays > joursRestants) {
      return res.status(400).json({
        success: false,
        message: `Solde insuffisant. Vous avez ${joursRestants} jour(s) disponible(s)`
      });
    }

    // Vérifier les chevauchements avec d'autres demandes validées
    const overlapResult = await db.execute({
      sql: `
        SELECT COUNT(*) as count FROM demandes_conges
        WHERE user_id = ? AND statut = 'validee'
        AND ((date_debut <= ? AND date_fin >= ?)
             OR (date_debut <= ? AND date_fin >= ?)
             OR (date_debut >= ? AND date_fin <= ?))
      `,
      args: [userId, date_fin, date_debut, date_debut, date_debut, date_debut, date_fin]
    });

    if (overlapResult.rows[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cette période chevauche une demande déjà validée'
      });
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
    const currentYear = year || new Date().getFullYear();

    let sql = `
      SELECT dc.id, dc.date_debut, dc.date_fin, dc.nombre_jours_ouvres,
             u.id as user_id, u.nom, u.prenom, u.type_utilisateur
      FROM demandes_conges dc
      JOIN users u ON dc.user_id = u.id
      WHERE dc.statut = 'validee'
      AND strftime('%Y', dc.date_debut) = ?
    `;
    const args = [currentYear.toString()];

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
