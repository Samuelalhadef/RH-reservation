/**
 * Vacances scolaires de Chartrettes (77) : académie de Créteil, Zone C.
 *
 * Source : calendrier officiel de l'Éducation nationale
 * (data.education.gouv.fr, jeu « fr-en-calendrier-scolaire », location = Créteil),
 * vérifié le 24/11/2026.
 *
 * Convention : `debut` = premier jour sans classe (samedi en général),
 * `fin` = dernier jour sans classe (veille de la reprise).
 * `estimation: true` = dates non encore publiées par le ministère.
 */

const SCHOOL_HOLIDAYS_ZONE_C = [
  // ===== 2025-2026 (officiel) =====
  { debut: '2025-10-18', fin: '2025-11-02', nom: 'Toussaint' },
  { debut: '2025-12-20', fin: '2026-01-04', nom: 'Noël' },
  { debut: '2026-02-21', fin: '2026-03-08', nom: 'Hiver' },
  { debut: '2026-04-18', fin: '2026-05-03', nom: 'Printemps' },
  { debut: '2026-05-14', fin: '2026-05-17', nom: "Pont de l'Ascension" },
  { debut: '2026-07-04', fin: '2026-08-31', nom: 'Été' },

  // ===== 2026-2027 (officiel) =====
  { debut: '2026-10-17', fin: '2026-11-01', nom: 'Toussaint' },
  { debut: '2026-12-19', fin: '2027-01-03', nom: 'Noël' },
  { debut: '2027-02-06', fin: '2027-02-21', nom: 'Hiver' },
  { debut: '2027-04-03', fin: '2027-04-18', nom: 'Printemps' },
  { debut: '2027-05-06', fin: '2027-05-09', nom: "Pont de l'Ascension" },
  { debut: '2027-07-03', fin: '2027-09-01', nom: 'Été' },

  // ===== 2027-2028 (officiel, sauf la fin de l'été) =====
  { debut: '2027-10-23', fin: '2027-11-07', nom: 'Toussaint' },
  { debut: '2027-12-18', fin: '2028-01-02', nom: 'Noël' },
  { debut: '2028-02-12', fin: '2028-02-27', nom: 'Hiver' },
  { debut: '2028-04-15', fin: '2028-05-01', nom: 'Printemps' },
  { debut: '2028-05-25', fin: '2028-05-28', nom: "Pont de l'Ascension" },
  { debut: '2028-07-04', fin: '2028-08-31', nom: 'Été', estimation: true },

  // ===== 2028-2029 (estimations, non publiées) =====
  { debut: '2028-10-21', fin: '2028-11-05', nom: 'Toussaint', estimation: true },
  { debut: '2028-12-23', fin: '2029-01-07', nom: 'Noël', estimation: true },
  { debut: '2029-02-10', fin: '2029-02-25', nom: 'Hiver', estimation: true },
  { debut: '2029-04-07', fin: '2029-04-22', nom: 'Printemps', estimation: true },
  { debut: '2029-05-10', fin: '2029-05-13', nom: "Pont de l'Ascension", estimation: true },
  { debut: '2029-07-07', fin: '2029-08-31', nom: 'Été', estimation: true },
];

/**
 * Vérifie si une date (format YYYY-MM-DD) tombe dans une période de vacances scolaires.
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @returns {{ nom: string, debut: string, fin: string, estimation?: boolean } | null}
 */
export function getSchoolHoliday(dateStr) {
  return findSchoolHoliday(SCHOOL_HOLIDAYS_ZONE_C, dateStr);
}

/**
 * Retourne toutes les périodes de vacances scolaires.
 */
export function getAllSchoolHolidays() {
  return SCHOOL_HOLIDAYS_ZONE_C;
}

/**
 * Cherche la période contenant `dateStr` dans une liste (utilisable côté client
 * avec la liste renvoyée par /api/school-holidays).
 */
export function findSchoolHoliday(periods, dateStr) {
  for (const period of periods || []) {
    if (dateStr >= period.debut && dateStr <= period.fin) return period;
  }
  return null;
}

/**
 * Périodes qui touchent le mois donné (month = 0-11).
 */
export function getSchoolHolidaysInMonth(periods, year, month) {
  const mm = String(month + 1).padStart(2, '0');
  const first = `${year}-${mm}-01`;
  const last = `${year}-${mm}-${String(new Date(Date.UTC(year, month + 1, 0)).getUTCDate()).padStart(2, '0')}`;
  return (periods || []).filter(p => p.debut <= last && p.fin >= first);
}
