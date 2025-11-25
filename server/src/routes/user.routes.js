import express from 'express';
import {
  getProfile,
  getAllUsersWithBalances,
  createUser,
  updateUser,
  resetPassword
} from '../controllers/user.controller.js';
import { authenticateToken, requireRH } from '../middleware/auth.middleware.js';

const router = express.Router();

// Toutes les routes nécessitent l'authentification
router.use(authenticateToken);

// Routes accessibles à tous les utilisateurs authentifiés
router.get('/profile', getProfile);

// Routes RH uniquement
router.get('/all', requireRH, getAllUsersWithBalances);
router.post('/', requireRH, createUser);
router.put('/:id', requireRH, updateUser);
router.post('/:id/reset-password', requireRH, resetPassword);

export default router;
