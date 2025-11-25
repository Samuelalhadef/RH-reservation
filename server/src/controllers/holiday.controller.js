import { db } from '../config/database.js';

/**
 * Jours fériés français 2024-2026
 */
const FRENCH_HOLIDAYS = [
  // 2024
  { date: '2024-01-01', nom: 'Jour de l\'An', annee: 2024 },
  { date: '2024-04-01', nom: 'Lundi de Pâques', annee: 2024 },
  { date: '2024-05-01', nom: 'Fête du Travail', annee: 2024 },
  { date: '2024-05-08', nom: 'Victoire 1945', annee: 2024 },
  { date: '2024-05-09', nom: 'Ascension', annee: 2024 },
  { date: '2024-05-20', nom: 'Lundi de Pentecôte', annee: 2024 },
  { date: '2024-07-14', nom: 'Fête Nationale', annee: 2024 },
  { date: '2024-08-15', nom: 'Assomption', annee: 2024 },
  { date: '2024-11-01', nom: 'Toussaint', annee: 2024 },
  { date: '2024-11-11', nom: 'Armistice 1918', annee: 2024 },
  { date: '2024-12-25', nom: 'Noël', annee: 2024 },

  // 2025
  { date: '2025-01-01', nom: 'Jour de l\'An', annee: 2025 },
  { date: '2025-04-21', nom: 'Lundi de Pâques', annee: 2025 },
  { date: '2025-05-01', nom: 'Fête du Travail', annee: 2025 },
  { date: '2025-05-08', nom: 'Victoire 1945', annee: 2025 },
  { date: '2025-05-29', nom: 'Ascension', annee: 2025 },
  { date: '2025-06-09', nom: 'Lundi de Pentecôte', annee: 2025 },
  { date: '2025-07-14', nom: 'Fête Nationale', annee: 2025 },
  { date: '2025-08-15', nom: 'Assomption', annee: 2025 },
  { date: '2025-11-01', nom: 'Toussaint', annee: 2025 },
  { date: '2025-11-11', nom: 'Armistice 1918', annee: 2025 },
  { date: '2025-12-25', nom: 'Noël', annee: 2025 },

  // 2026
  { date: '2026-01-01', nom: 'Jour de l\'An', annee: 2026 },
  { date: '2026-04-06', nom: 'Lundi de Pâques', annee: 2026 },
  { date: '2026-05-01', nom: 'Fête du Travail', annee: 2026 },
  { date: '2026-05-08', nom: 'Victoire 1945', annee: 2026 },
  { date: '2026-05-14', nom: 'Ascension', annee: 2026 },
  { date: '2026-05-25', nom: 'Lundi de Pentecôte', annee: 2026 },
  { date: '2026-07-14', nom: 'Fête Nationale', annee: 2026 },
  { date: '2026-08-15', nom: 'Assomption', annee: 2026 },
  { date: '2026-11-01', nom: 'Toussaint', annee: 2026 },
  { date: '2026-11-11', nom: 'Armistice 1918', annee: 2026 },
  { date: '2026-12-25', nom: 'Noël', annee: 2026 },
];

/**
 * Initialise les jours fériés dans la base de données
 */
export const initHolidays = async (req, res) => {
  try {
    // Vérifier si des jours fériés existent déjà
    const existingResult = await db.execute('SELECT COUNT(*) as count FROM jours_feries');

    if (existingResult.rows[0].count > 0) {
      return res.json({
        success: true,
        message: 'Les jours fériés sont déjà initialisés',
        count: existingResult.rows[0].count
      });
    }

    // Insérer tous les jours fériés
    for (const holiday of FRENCH_HOLIDAYS) {
      await db.execute({
        sql: 'INSERT INTO jours_feries (date, nom, annee) VALUES (?, ?, ?)',
        args: [holiday.date, holiday.nom, holiday.annee]
      });
    }

    res.json({
      success: true,
      message: 'Jours fériés initialisés avec succès',
      count: FRENCH_HOLIDAYS.length
    });
  } catch (error) {
    console.error('Error initializing holidays:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'initialisation des jours fériés'
    });
  }
};

/**
 * Récupère les jours fériés d'une année
 */
export const getHolidays = async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();

    const result = await db.execute({
      sql: 'SELECT * FROM jours_feries WHERE annee = ? ORDER BY date',
      args: [currentYear]
    });

    res.json({
      success: true,
      holidays: result.rows
    });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des jours fériés'
    });
  }
};

/**
 * Récupère tous les jours fériés (toutes années)
 */
export const getAllHolidays = async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM jours_feries ORDER BY date');

    res.json({
      success: true,
      holidays: result.rows
    });
  } catch (error) {
    console.error('Error fetching all holidays:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des jours fériés'
    });
  }
};
