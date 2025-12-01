import express from 'express';
import {
  getAllLeaves,
  getMyLeaves,
  createLeaveRequest,
  updateLeaveStatus,
  getCalendar,
  deleteLeaveRequest,
  deleteLeaveRequestByRH,
  getDashboardStats
} from '../controllers/leave.controller.js';
import { authenticateToken, requireRH } from '../middleware/auth.middleware.js';

const router = express.Router();

// Toutes les routes nécessitent l'authentification
router.use(authenticateToken);

// Routes accessibles à tous
router.get('/my-leaves', getMyLeaves);
router.post('/', createLeaveRequest);
router.get('/calendar', getCalendar);
router.delete('/:id', deleteLeaveRequest);

// Routes RH uniquement
router.get('/', requireRH, getAllLeaves);
router.get('/dashboard-stats', requireRH, getDashboardStats);
router.put('/:id/status', requireRH, updateLeaveStatus);
router.delete('/:id/rh', requireRH, deleteLeaveRequestByRH);

export default router;
