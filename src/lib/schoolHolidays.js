/**
 * Vacances scolaires Zone C (Créteil, Paris, Versailles, Montpellier, Toulouse)
 * Sources : education.gouv.fr, service-public.gouv.fr
 * 2027-2028 et 2028-2029 : estimations (non publiées officiellement)
 */

const SCHOOL_HOLIDAYS_ZONE_C = [
  // ===== 2025-2026 (officiel) =====
  { debut: '2025-10-18', fin: '2025-11-02', nom: 'Toussaint' },
  { debut: '2025-12-20', fin: '2026-01-04', nom: 'Noël' },
  { debut: '2026-02-21', fin: '2026-03-08', nom: 'Hiver' },
  { debut: '2026-04-18', fin: '2026-05-03', nom: 'Printemps' },

  // ===== 2026-2027 (officiel) =====
  { debut: '2026-10-17', fin: '2026-11-01', nom: 'Toussaint' },
  { debut: '2026-12-19', fin: '2027-01-03', nom: 'Noël' },
  { debut: '2027-02-06', fin: '2027-02-21', nom: 'Hiver' },
  { debut: '2027-04-03', fin: '2027-04-18', nom: 'Printemps' },

  // ===== 2027-2028 (estimations) =====
  { debut: '2027-10-23', fin: '2027-11-07', nom: 'Toussaint' },
  { debut: '2027-12-18', fin: '2028-01-02', nom: 'Noël' },
  { debut: '2028-02-12', fin: '2028-02-27', nom: 'Hiver' },
  { debut: '2028-04-15', fin: '2028-05-01', nom: 'Printemps' },

  // ===== 2028-2029 (estimations) =====
  { debut: '2028-10-21', fin: '2028-11-05', nom: 'Toussaint' },
  { debut: '2028-12-23', fin: '2029-01-07', nom: 'Noël' },
  { debut: '2029-02-10', fin: '2029-02-25', nom: 'Hiver' },
  { debut: '2029-04-07', fin: '2029-04-22', nom: 'Printemps' },
];

/**
 * Vérifie si une date (format YYYY-MM-DD) tombe dans une période de vacances scolaires.
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @returns {{ nom: string, debut: string, fin: string } | null}
 */
export function getSchoolHoliday(dateStr) {
  for (const period of SCHOOL_HOLIDAYS_ZONE_C) {
    if (dateStr >= period.debut && dateStr <= period.fin) {
      return period;
    }
  }
  return null;
}

/**
 * Retourne toutes les périodes de vacances scolaires.
 */
export function getAllSchoolHolidays() {
  return SCHOOL_HOLIDAYS_ZONE_C;
}
