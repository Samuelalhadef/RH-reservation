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
 * Ligne discrète au-dessus du calendrier quand le mois affiché contient des
 * vacances scolaires (Zone C — Chartrettes). Même code couleur que le ruban
 * des cases (barre ambre).
 */
export default function SchoolHolidayBanner({ periods, month }) {
  const list = getSchoolHolidaysInMonth(periods, month.getFullYear(), month.getMonth());
  if (list.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
      {list.map((p) => (
        <span key={p.debut} className="inline-flex items-center gap-2">
          <span className="w-5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          <span className="font-medium text-gray-800">{LIBELLES[p.nom] || p.nom}</span>
          <span className="text-gray-500">
            du {fmt(p.debut)} au {fmt(p.fin)}
            {p.estimation && <span className="italic"> (prévisionnel)</span>}
          </span>
        </span>
      ))}
      <span className="text-xs text-gray-400">Zone C</span>
    </div>
  );
}

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Ruban de vacances scolaires posé dans l'interstice au-dessus d'une case du
 * calendrier. Il se prolonge dans l'espace entre deux colonnes pour former une
 * bande continue sur la semaine, arrondie au début et à la fin de la période
 * (et en bout de semaine).
 * @param {{ date: Date, period: {debut: string, fin: string, nom: string}, gap: 'sm'|'md' }} props
 *   gap : 'sm' pour une grille gap-1 sm:gap-2, 'md' pour gap-2
 */
export function SchoolHolidayRibbon({ date, period, gap = 'sm' }) {
  const d = iso(date);
  const dow = date.getDay(); // 0 = dimanche, 1 = lundi
  const debut = d === period.debut || dow === 1;
  const fin = d === period.fin || dow === 0;
  const top = gap === 'md' ? '-top-[6px]' : '-top-[4px] sm:-top-[6px]';
  const extend = gap === 'md' ? '-right-2' : '-right-1 sm:-right-2';
  return (
    <span
      aria-hidden="true"
      className={`absolute ${top} left-0 ${fin ? 'right-0' : extend} h-[3px] sm:h-1 bg-amber-400 pointer-events-none z-20 ${
        debut ? 'rounded-l-full' : ''
      } ${fin ? 'rounded-r-full' : ''}`}
    />
  );
}

/**
 * Numéro du jour en ambre pendant les vacances scolaires, sauf si la case a
 * déjà une couleur de texte spécifique (congé posé, férié…).
 */
export function schoolHolidayTextClass(textClass, schoolHol) {
  if (!schoolHol || !/text-gray-(?:400|700)/.test(textClass)) return textClass;
  return textClass.replace(/text-gray-(?:400|700)/, 'text-amber-700');
}
