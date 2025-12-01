import bcrypt from 'bcrypt';
import { db } from '../config/database.js';
import { sendTemporaryPasswordEmail } from '../utils/emailService.js';

/**
 * Récupère les informations du profil de l'utilisateur connecté
 */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.execute({
      sql: `
        SELECT u.id, u.nom, u.prenom, u.email, u.type_utilisateur,
               sc.jours_acquis, sc.jours_pris, sc.jours_restants, sc.jours_reportes, sc.jours_fractionnement
        FROM users u
        LEFT JOIN soldes_conges sc ON u.id = sc.user_id AND sc.annee = ?
        WHERE u.id = ?
      `,
      args: [new Date().getFullYear(), userId]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  }
};

/**
 * Récupère tous les utilisateurs avec leurs soldes (RH uniquement)
 */
export const getAllUsersWithBalances = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    const result = await db.execute({
      sql: `
        SELECT u.id, u.nom, u.prenom, u.email, u.type_utilisateur, u.actif,
               sc.jours_acquis, sc.jours_pris, sc.jours_restants, sc.jours_reportes, sc.jours_fractionnement
        FROM users u
        LEFT JOIN soldes_conges sc ON u.id = sc.user_id AND sc.annee = ?
        ORDER BY u.nom, u.prenom
      `,
      args: [currentYear]
    });

    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('Error fetching users with balances:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs'
    });
  }
};

/**
 * Crée un nouvel utilisateur (RH uniquement)
 */
export const createUser = async (req, res) => {
  try {
    const { nom, prenom, email, type_utilisateur } = req.body;

    if (!nom || !prenom || !email || !type_utilisateur) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis'
      });
    }

    // Vérifier que l'email n'existe pas déjà
    const existingUser = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email]
    });

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Générer un mot de passe temporaire
    const tempPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Créer l'utilisateur
    const result = await db.execute({
      sql: `
        INSERT INTO users (nom, prenom, email, mot_de_passe, type_utilisateur, mot_de_passe_temporaire)
        VALUES (?, ?, ?, ?, ?, 1)
      `,
      args: [nom, prenom, email, hashedPassword, type_utilisateur]
    });

    const userId = result.lastInsertRowid;

    // Créer le solde de congés pour l'année en cours
    const currentYear = new Date().getFullYear();
    await db.execute({
      sql: `
        INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants, jours_reportes, jours_fractionnement)
        VALUES (?, ?, 25, 0, 25, 0, 0)
      `,
      args: [userId, currentYear]
    });

    // Envoyer l'email avec le mot de passe temporaire (ne pas bloquer si l'envoi échoue)
    try {
      await sendTemporaryPasswordEmail(email, `${prenom} ${nom}`, tempPassword);
      console.log(`Email envoyé à ${email} avec le mot de passe temporaire`);
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email, mais l\'utilisateur est créé:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      user: {
        id: userId,
        nom,
        prenom,
        email,
        type_utilisateur
      },
      tempPassword
    });
  } catch (error) {
    console.error('Error creating user:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la création de l'utilisateur: ${error.message}`
    });
  }
};

/**
 * Met à jour un utilisateur (RH uniquement)
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, email, type_utilisateur, actif } = req.body;

    if (!nom || !prenom || !email || !type_utilisateur) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis'
      });
    }

    // Vérifier que l'utilisateur existe
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE id = ?',
      args: [id]
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Mettre à jour l'utilisateur
    await db.execute({
      sql: `
        UPDATE users
        SET nom = ?, prenom = ?, email = ?, type_utilisateur = ?, actif = ?
        WHERE id = ?
      `,
      args: [nom, prenom, email, type_utilisateur, actif ? 1 : 0, id]
    });

    res.json({
      success: true,
      message: 'Utilisateur mis à jour avec succès'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'utilisateur'
    });
  }
};

/**
 * Réinitialise le mot de passe d'un utilisateur (RH uniquement)
 */
export const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur existe
    const result = await db.execute({
      sql: 'SELECT nom, prenom, email FROM users WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const user = result.rows[0];

    // Générer un nouveau mot de passe temporaire
    const tempPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Mettre à jour le mot de passe
    await db.execute({
      sql: 'UPDATE users SET mot_de_passe = ?, mot_de_passe_temporaire = 1 WHERE id = ?',
      args: [hashedPassword, id]
    });

    // Envoyer l'email
    await sendTemporaryPasswordEmail(
      user.email,
      `${user.prenom} ${user.nom}`,
      tempPassword
    );

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
      tempPassword // À retirer en production
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation du mot de passe'
    });
  }
};
