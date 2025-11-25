import express from 'express';
import {
  getAllLeaves,
  getMyLeaves,
  createLeaveRequest,
  updateLeaveStatus,
  getCalendar
} from '../controllers/leave.controller.js';
import { authenticateToken, requireRH } from '../middleware/auth.middleware.js';

const router = express.Router();

// Toutes les routes nécessitent l'authentification
router.use(authenticateToken);

// Routes accessibles à tous
router.get('/my-leaves', getMyLeaves);
router.post('/', createLeaveRequest);
router.get('/calendar', getCalendar);

// Routes RH uniquement
router.get('/', requireRH, getAllLeaves);
router.put('/:id/status', requireRH, updateLeaveStatus);

export default router;
