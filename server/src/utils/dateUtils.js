/**
 * Calcule le nombre de jours ouvrés entre deux dates (exclut weekends et jours fériés)
 */
export const calculateBusinessDays = (startDate, endDate, holidays = []) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;

  const holidaySet = new Set(holidays.map(h => new Date(h).toISOString().split('T')[0]));

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split('T')[0];

    // Exclure samedis (6) et dimanches (0) et jours fériés
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      count++;
    }
  }

  return count;
};

/**
 * Vérifie si une demande est faite au moins 7 jours à l'avance
 */
export const isAtLeast7DaysInAdvance = (startDate) => {
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = start - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 7;
};

/**
 * Vérifie si deux périodes de congés se chevauchent
 */
export const hasOverlap = (start1, end1, start2, end2) => {
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);

  return s1 <= e2 && s2 <= e1;
};

/**
 * Formate une date au format français DD/MM/YYYY
 */
export const formatDateFR = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};
