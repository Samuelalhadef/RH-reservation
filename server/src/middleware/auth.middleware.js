import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification manquant'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Vérifier que l'utilisateur existe et est actif
    const result = await db.execute({
      sql: 'SELECT id, nom, prenom, email, type_utilisateur, actif FROM users WHERE id = ? AND actif = 1',
      args: [decoded.userId]
    });

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    req.user = {
      id: result.rows[0].id,
      nom: result.rows[0].nom,
      prenom: result.rows[0].prenom,
      email: result.rows[0].email,
      type: result.rows[0].type_utilisateur
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        message: 'Token invalide'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        message: 'Token expiré'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Erreur d\'authentification'
    });
  }
};

export const requireRH = (req, res, next) => {
  if (req.user.type !== 'RH') {
    return res.status(403).json({
      success: false,
      message: 'Accès réservé aux RH'
    });
  }
  next();
};
