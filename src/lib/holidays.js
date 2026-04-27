/**
 * Récupère les jours fériés français via l'API officielle du gouvernement :
 * https://calendrier.api.gouv.fr/jours-feries/metropole/{year}.json
 *
 * Les noms renvoyés par l'API sont remappés vers la convention interne.
 */

const API_BASE = 'https://calendrier.api.gouv.fr/jours-feries/metropole';

const NAME_MAP = {
  '1er janvier': "Jour de l'An",
  'Lundi de Pâques': 'Lundi de Pâques',
  '1er mai': 'Fête du Travail',
  '8 mai': 'Victoire 1945',
  '8 mai 1945': 'Victoire 1945',
  'Ascension': 'Ascension',
  'Lundi de Pentecôte': 'Lundi de Pentecôte',
  '14 juillet': 'Fête Nationale',
  'Assomption': 'Assomption',
  'Toussaint': 'Toussaint',
  '11 novembre': 'Armistice 1918',
  'Jour de Noël': 'Noël',
};

const cache = new Map();

async function fetchHolidaysFromApi(year) {
  const res = await fetch(`${API_BASE}/${year}.json`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    throw new Error(`API jours fériés: HTTP ${res.status}`);
  }
  const data = await res.json();
  return Object.entries(data)
    .map(([date, rawName]) => ({
      date,
      nom: NAME_MAP[rawName] || rawName,
      annee: year,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getFrenchHolidays(year) {
  if (cache.has(year)) return [...cache.get(year)];
  try {
    const holidays = await fetchHolidaysFromApi(year);
    cache.set(year, holidays);
    return [...holidays];
  } catch (err) {
    console.error(`Échec récupération jours fériés ${year}:`, err);
    return [];
  }
}

export async function getFrenchHolidaysRange(startYear, endYear) {
  const years = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);
  const results = await Promise.all(years.map((y) => getFrenchHolidays(y)));
  return results.flat().sort((a, b) => a.date.localeCompare(b.date));
}
