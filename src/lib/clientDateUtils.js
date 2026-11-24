/**
 * Client-side date utilities
 */

import { toDayUTC } from './dateUtils.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

export const formatDateFR = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatDateForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const calculateBusinessDays = (startDate, endDate, holidays = []) => {
  const start = toDayUTC(startDate);
  const end = toDayUTC(endDate);
  let count = 0;

  const holidaySet = new Set(holidays.map(h => dayKey(toDayUTC(h))));

  for (let t = start; t <= end; t += DAY_MS) {
    const dayOfWeek = new Date(t).getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dayKey(t))) {
      count++;
    }
  }

  return count;
};

export const isAtLeast7DaysInAdvance = (date) => {
  // Comparaison en jours calendaires (sinon J+6 passait grâce au décalage horaire)
  const diffDays = Math.round((toDayUTC(date) - toDayUTC(new Date())) / DAY_MS);
  return diffDays >= 7;
};

export const getMinimumStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return formatDateForInput(date);
};

export const formatStatus = (status) => {
  const statuses = {
    en_attente: 'En attente',
    validee: 'Validée',
    refusee: 'Refusée',
    annulee: 'Annulée',
  };
  return statuses[status] || status;
};

export const getStatusColor = (status) => {
  const colors = {
    en_attente: 'bg-yellow-100 text-yellow-800',
    validee: 'bg-green-100 text-green-800',
    refusee: 'bg-red-100 text-red-800',
    annulee: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

/**
 * Période de fractionnement = hors période principale (1er mai → 31 octobre),
 * soit janvier-avril et novembre-décembre. Même règle que src/lib/fractionnement.js.
 * @param {Date} date - date locale (cases des calendriers)
 */
export const isPeriodeFractionnement = (date) => {
  const month = date.getMonth(); // 0-11
  return month < 4 || month > 9;
};
