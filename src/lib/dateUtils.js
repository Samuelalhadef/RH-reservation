const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Convertit une date en jour calendaire UTC (timestamp à minuit UTC).
 * Une chaîne 'YYYY-MM-DD' est prise telle quelle ; un objet Date est pris
 * dans le fuseau local. Indispensable pour itérer jour par jour : avec des
 * dates locales, le passage à l'heure d'hiver décalait d'une heure et faisait
 * sortir le dernier jour de la boucle.
 */
export const toDayUTC = (value) => {
  if (typeof value === 'string') {
    const m = value.match(/^(d{4})-(d{2})-(d{2})/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  }
  const d = new Date(value);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};

const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

/**
 * Calcule le nombre de jours ouvrés entre deux dates (exclut weekends et jours fériés)
 */
export const calculateBusinessDays = (startDate, endDate, holidays = []) => {
  const start = toDayUTC(startDate);
  const end = toDayUTC(endDate);
  let count = 0;

  const holidaySet = new Set(holidays.map(h => dayKey(toDayUTC(h))));

  for (let t = start; t <= end; t += DAY_MS) {
    const dayOfWeek = new Date(t).getUTCDay();
    // Exclure samedis (6) et dimanches (0) et jours fériés
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dayKey(t))) {
      count++;
    }
  }

  return count;
};

/**
 * Nombre de jours décomptés pour un congé, demi-journées comprises.
 * Une demi-journée n'est retirée que si le jour concerné est réellement
 * ouvré (pas un week-end ni un férié), sinon on retirait 0,5 jour à tort,
 * et une demi-journée posée un samedi était décomptée.
 *
 * @param {string} dateDebut - 'YYYY-MM-DD'
 * @param {string} dateFin - 'YYYY-MM-DD'
 * @param {string[]} holidays - jours fériés 'YYYY-MM-DD'
 * @param {'journee_complete'|'matin'|'apres_midi'} typeDebut
 * @param {'journee_complete'|'matin'|'apres_midi'} typeFin
 * @returns {number}
 */
export const calculateLeaveDays = (dateDebut, dateFin, holidays = [], typeDebut = 'journee_complete', typeFin = 'journee_complete') => {
  const total = calculateBusinessDays(dateDebut, dateFin, holidays);
  if (total === 0) return 0;

  if (toDayUTC(dateDebut) === toDayUTC(dateFin)) {
    if (typeDebut === 'matin' && typeFin === 'apres_midi') return 1;
    if (typeDebut === 'matin' || typeDebut === 'apres_midi') return 0.5;
    return total;
  }

  const isWorked = (d) => calculateBusinessDays(d, d, holidays) === 1;
  let days = total;
  if (typeDebut === 'apres_midi' && isWorked(dateDebut)) days -= 0.5;
  if (typeFin === 'matin' && isWorked(dateFin)) days -= 0.5;
  return Math.max(0, days);
};

/**
 * Vérifie si une demande est faite au moins 7 jours à l'avance
 */
export const isAtLeast7DaysInAdvance = (startDate) => {
  // Comparaison en jours calendaires (sinon J+6 passait grâce au décalage horaire)
  const diffDays = Math.round((toDayUTC(startDate) - toDayUTC(new Date())) / DAY_MS);
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

/**
 * Formate le statut en français
 */
export const formatStatus = (status) => {
  const statusMap = {
    'en_attente': 'En attente',
    'validee': 'Validée',
    'refusee': 'Refusée',
  };
  return statusMap[status] || status;
};

/**
 * Retourne la classe CSS pour le statut
 */
export const getStatusColor = (status) => {
  const colorMap = {
    'en_attente': 'bg-yellow-100 text-yellow-800',
    'validee': 'bg-green-100 text-green-800',
    'refusee': 'bg-red-100 text-red-800',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
};
