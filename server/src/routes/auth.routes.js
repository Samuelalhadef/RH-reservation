import express from 'express';
import { getAllUsers, login, changePassword } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Routes publiques
router.get('/users', getAllUsers);
router.post('/login', login);

// Routes protégées
router.post('/change-password', authenticateToken, changePassword);

export default router;
