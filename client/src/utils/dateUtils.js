/**
 * Formate une date au format français DD/MM/YYYY
 */
export const formatDateFR = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Formate une date pour les inputs HTML (YYYY-MM-DD)
 */
export const formatDateForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calcule le nombre de jours ouvrés entre deux dates
 */
export const calculateBusinessDays = (startDate, endDate, holidays = []) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;

  const holidaySet = new Set(holidays.map(h => new Date(h).toISOString().split('T')[0]));

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split('T')[0];

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      count++;
    }
  }

  return count;
};

/**
 * Vérifie si une date est au moins 7 jours dans le futur
 */
export const isAtLeast7DaysInAdvance = (date) => {
  const targetDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 7;
};

/**
 * Retourne la date minimum pour les demandes (aujourd'hui + 7 jours)
 */
export const getMinimumStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return formatDateForInput(date);
};

/**
 * Formate un statut pour l'affichage
 */
export const formatStatus = (status) => {
  const statuses = {
    en_attente: 'En attente',
    validee: 'Validée',
    refusee: 'Refusée',
  };
  return statuses[status] || status;
};

/**
 * Retourne la couleur badge pour un statut
 */
export const getStatusColor = (status) => {
  const colors = {
    en_attente: 'bg-yellow-100 text-yellow-800',
    validee: 'bg-green-100 text-green-800',
    refusee: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};
