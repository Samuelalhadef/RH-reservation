// Jours fériés métropole (valeurs officielles) sans appel à l'API gouv
const DATA = {
  2025: ['2025-01-01','2025-04-21','2025-05-01','2025-05-08','2025-05-29','2025-06-09','2025-07-14','2025-08-15','2025-11-01','2025-11-11','2025-12-25'],
  2026: ['2026-01-01','2026-04-06','2026-05-01','2026-05-08','2026-05-14','2026-05-25','2026-07-14','2026-08-15','2026-11-01','2026-11-11','2026-12-25'],
  2027: ['2027-01-01','2027-03-29','2027-05-01','2027-05-06','2027-05-08','2027-05-17','2027-07-14','2027-08-15','2027-11-01','2027-11-11','2027-12-25'],
};
export async function getFrenchHolidays(year) {
  return (DATA[year] || []).map(date => ({ date, nom: 'Férié', annee: year }));
}
export async function getFrenchHolidaysRange(a, b) {
  const out = [];
  for (let y = a; y <= b; y++) out.push(...await getFrenchHolidays(y));
  return out.sort((x, y) => x.date.localeCompare(y.date));
}
