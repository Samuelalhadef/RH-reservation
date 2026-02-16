/**
 * Calcul automatique des jours fériés français pour n'importe quelle année.
 * Inclut les fêtes fixes et les fêtes mobiles (basées sur Pâques).
 */

// Algorithme de Computus (calcul de la date de Pâques - méthode de Meeus)
function getEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retourne tous les jours fériés français pour une année donnée.
 * @param {number} year
 * @returns {Array<{date: string, nom: string, annee: number}>}
 */
export function getFrenchHolidays(year) {
  const easter = getEasterDate(year);

  return [
    { date: `${year}-01-01`, nom: "Jour de l'An", annee: year },
    { date: formatDate(addDays(easter, 1)), nom: 'Lundi de Pâques', annee: year },
    { date: `${year}-05-01`, nom: 'Fête du Travail', annee: year },
    { date: `${year}-05-08`, nom: 'Victoire 1945', annee: year },
    { date: formatDate(addDays(easter, 39)), nom: 'Ascension', annee: year },
    { date: formatDate(addDays(easter, 50)), nom: 'Lundi de Pentecôte', annee: year },
    { date: `${year}-07-14`, nom: 'Fête Nationale', annee: year },
    { date: `${year}-08-15`, nom: 'Assomption', annee: year },
    { date: `${year}-11-01`, nom: 'Toussaint', annee: year },
    { date: `${year}-11-11`, nom: 'Armistice 1918', annee: year },
    { date: `${year}-12-25`, nom: 'Noël', annee: year },
  ];
}

/**
 * Retourne les jours fériés pour plusieurs années.
 * @param {number} startYear
 * @param {number} endYear
 * @returns {Array<{date: string, nom: string, annee: number}>}
 */
export function getFrenchHolidaysRange(startYear, endYear) {
  const holidays = [];
  for (let y = startYear; y <= endYear; y++) {
    holidays.push(...getFrenchHolidays(y));
  }
  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}
