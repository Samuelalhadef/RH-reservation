import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const initDatabase = async () => {
  try {
    // Table users
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        mot_de_passe TEXT NOT NULL,
        type_utilisateur TEXT NOT NULL CHECK(type_utilisateur IN ('Employé', 'DG', 'Service Technique', 'Alternant', 'RH')),
        mot_de_passe_temporaire INTEGER DEFAULT 0,
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
        actif INTEGER DEFAULT 1
      )
    `);

    // Table soldes_conges
    await db.execute(`
      CREATE TABLE IF NOT EXISTS soldes_conges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        annee INTEGER NOT NULL,
        jours_acquis INTEGER DEFAULT 25,
        jours_pris REAL DEFAULT 0,
        jours_restants REAL DEFAULT 25,
        jours_reportes REAL DEFAULT 0,
        jours_fractionnement REAL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, annee)
      )
    `);

    // Table demandes_conges
    await db.execute(`
      CREATE TABLE IF NOT EXISTS demandes_conges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date_debut DATE NOT NULL,
        date_fin DATE NOT NULL,
        nombre_jours_ouvres REAL NOT NULL,
        motif TEXT,
        statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'validee', 'refusee')),
        date_demande DATETIME DEFAULT CURRENT_TIMESTAMP,
        date_validation DATETIME,
        validateur_id INTEGER,
        commentaire_rh TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (validateur_id) REFERENCES users(id)
      )
    `);

    // Table jours_feries
    await db.execute(`
      CREATE TABLE IF NOT EXISTS jours_feries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL UNIQUE,
        nom TEXT NOT NULL,
        annee INTEGER NOT NULL
      )
    `);

    console.log('✅ Database tables initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};
