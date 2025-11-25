import express from 'express';
import { initHolidays, getHolidays, getAllHolidays } from '../controllers/holiday.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Route publique pour initialiser les jours fériés
router.post('/init', initHolidays);

// Routes protégées
router.get('/', authenticateToken, getHolidays);
router.get('/all', authenticateToken, getAllHolidays);

export default router;
