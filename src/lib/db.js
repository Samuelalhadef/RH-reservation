import { createClient } from '@libsql/client';

let _db = null;

export function getDb() {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _db;
}

// Backward-compatible named export using lazy proxy
export const db = new Proxy({}, {
  get(_, prop) {
    const client = getDb();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
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
        type_utilisateur TEXT NOT NULL,
        mot_de_passe_temporaire INTEGER DEFAULT 0,
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
        actif INTEGER DEFAULT 1,
        type_contrat TEXT,
        date_debut_contrat DATE,
        date_fin_contrat DATE,
        service TEXT,
        poste TEXT
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

    // Migrations: Ajouter les colonnes manquantes si elles n'existent pas
    const migrations = [
      { table: 'soldes_conges', column: 'jours_fractionnement', type: 'REAL DEFAULT 0' },
      { table: 'users', column: 'type_contrat', type: 'TEXT' },
      { table: 'users', column: 'date_debut_contrat', type: 'DATE' },
      { table: 'users', column: 'date_fin_contrat', type: 'DATE' },
      { table: 'users', column: 'service', type: 'TEXT' },
      { table: 'users', column: 'poste', type: 'TEXT' },
      { table: 'users', column: 'photo_profil', type: 'TEXT' }
    ];

    for (const migration of migrations) {
      try {
        await db.execute(`
          ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.type}
        `);
        console.log(`✅ Column ${migration.column} added to ${migration.table}`);
      } catch (error) {
        if (!error.message.includes('duplicate column')) {
          console.log(`ℹ️  Column ${migration.column} already exists in ${migration.table}`);
        }
      }
    }

    // Table demandes_conges
    await db.execute(`
      CREATE TABLE IF NOT EXISTS demandes_conges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date_debut DATE NOT NULL,
        date_fin DATE NOT NULL,
        nombre_jours_ouvres REAL NOT NULL,
        type_debut TEXT DEFAULT 'journee_complete' CHECK(type_debut IN ('journee_complete', 'matin', 'apres_midi')),
        type_fin TEXT DEFAULT 'journee_complete' CHECK(type_fin IN ('journee_complete', 'matin', 'apres_midi')),
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

    // Table CET (Compte Épargne Temps)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS cet (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        solde REAL DEFAULT 0,
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Table historique CET
    await db.execute(`
      CREATE TABLE IF NOT EXISTS cet_historique (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
        jours REAL NOT NULL,
        motif TEXT,
        date_operation DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Database tables initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};
