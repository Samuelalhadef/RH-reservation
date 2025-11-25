import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token JWT à chaque requête
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs d'authentification
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  getAllUsers: () => api.get('/auth/users'),
  login: (userId, password) => api.post('/auth/login', { userId, password }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Users
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  getAllUsersWithBalances: () => api.get('/users/all'),
  createUser: (userData) => api.post('/users', userData),
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  resetPassword: (id) => api.post(`/users/${id}/reset-password`),
};

// Leaves
export const leaveAPI = {
  getAllLeaves: (params) => api.get('/leaves', { params }),
  getMyLeaves: () => api.get('/leaves/my-leaves'),
  createLeaveRequest: (leaveData) => api.post('/leaves', leaveData),
  updateLeaveStatus: (id, status, commentaire_rh) =>
    api.put(`/leaves/${id}/status`, { statut: status, commentaire_rh }),
  getCalendar: (params) => api.get('/leaves/calendar', { params }),
};

// Holidays
export const holidayAPI = {
  initHolidays: () => api.post('/holidays/init'),
  getHolidays: (year) => api.get('/holidays', { params: { year } }),
  getAllHolidays: () => api.get('/holidays/all'),
};

export default api;
