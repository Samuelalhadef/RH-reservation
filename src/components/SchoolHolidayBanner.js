'use client';

import { getSchoolHolidaysInMonth } from '@/lib/schoolHolidays';

const LIBELLES = {
  'Toussaint': 'Vacances de la Toussaint',
  'Noël': 'Vacances de Noël',
  'Hiver': "Vacances d'hiver",
  'Printemps': 'Vacances de printemps',
  'Été': "Vacances d'été",
};

const fmt =(iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
};

/**
 * Bandeau affiché au-dessus du calendrier quand le mois affiché contient
 * des vacances scolaires (Zone C — Chartrettes).
 */
export default function SchoolHolidayBanner({ periods, month }) {
  const list = getSchoolHolidaysInMonth(periods, month.getFullYear(), month.getMonth());
  if (list.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2">
      {list.map((p) => (
        <p key={p.debut} className="text-sm text-amber-900">
          <span className="font-semibold">
            {LIBELLES[p.nom] || p.nom}
          </span>
          {' '}: du {fmt(p.debut)} au {fmt(p.fin)}
          {p.estimation && <span className="text-amber-700 italic"> (dates prévisionnelles)</span>}
        </p>
      ))}
      <p className="text-xs text-amber-700 mt-0.5">Vacances scolaires Zone C (académie de Créteil)</p>
    </div>
  );
}
