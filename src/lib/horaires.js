// Helpers partagés pour l'emploi du temps hebdomadaire (horaires matin / après-midi par jour)

export const JOURS_SEMAINE = [
  { key: 'lundi', label: 'Lundi' },
  { key: 'mardi', label: 'Mardi' },
  { key: 'mercredi', label: 'Mercredi' },
  { key: 'jeudi', label: 'Jeudi' },
  { key: 'vendredi', label: 'Vendredi' },
];

export const emptySchedule = () =>
  JOURS_SEMAINE.reduce((acc, j) => {
    acc[j.key] = { m_debut: '', m_fin: '', a_debut: '', a_fin: '' };
    return acc;
  }, {});

// Parse une valeur stockée (chaîne JSON ou objet) vers un objet horaires complet
export const parseSchedule = (value) => {
  const base = emptySchedule();
  if (!value) return base;
  try {
    const obj = typeof value === 'string' ? JSON.parse(value) : value;
    if (obj && typeof obj === 'object') {
      for (const j of JOURS_SEMAINE) {
        if (obj[j.key]) base[j.key] = { ...base[j.key], ...obj[j.key] };
      }
    }
  } catch (e) {
    // valeur illisible → horaires vides
  }
  return base;
};

// Vrai si au moins un créneau est renseigné
export const scheduleHasData = (schedule) =>
  JOURS_SEMAINE.some((j) => {
    const d = schedule[j.key] || {};
    return d.m_debut || d.m_fin || d.a_debut || d.a_fin;
  });

// Heures entre deux "HH:MM" (0 si invalide/négatif)
export const diffHeures = (debut, fin) => {
  if (!debut || !fin) return 0;
  const [h1, m1] = debut.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  if ([h1, m1, h2, m2].some((n) => Number.isNaN(n))) return 0;
  const mins = h2 * 60 + m2 - (h1 * 60 + m1);
  return mins > 0 ? mins / 60 : 0;
};

export const heuresJour = (d) =>
  d ? diffHeures(d.m_debut, d.m_fin) + diffHeures(d.a_debut, d.a_fin) : 0;

export const heuresSemaine = (schedule) =>
  JOURS_SEMAINE.reduce((s, j) => s + heuresJour(schedule[j.key]), 0);
