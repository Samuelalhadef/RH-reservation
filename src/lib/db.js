import { createClient } from '@libsql/client';

let _db = null;
let _initialized = false;
let _initPromise = null;
let _migrationVersion = 7; // Incrémenter pour forcer re-migration
let _lastMigrationVersion = 0;

export function getDb() {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _db;
}

async function ensureInitialized() {
  if (_initialized && _lastMigrationVersion >= _migrationVersion) return;
  if (_initPromise) return _initPromise;
  _initPromise = runMigrations().then(() => {
    _initialized = true;
    _lastMigrationVersion = _migrationVersion;
  }).catch((err) => {
    console.error('Auto-init failed:', err);
    _initPromise = null;
  });
  return _initPromise;
}

async function runMigrations() {
  const client = getDb();
  const migrations = [
    { table: 'users', column: 'type_contrat', type: 'TEXT' },
    { table: 'users', column: 'date_debut_contrat', type: 'DATE' },
    { table: 'users', column: 'date_fin_contrat', type: 'DATE' },
    { table: 'users', column: 'service', type: 'TEXT' },
    { table: 'users', column: 'poste', type: 'TEXT' },
    { table: 'users', column: 'photo_profil', type: 'TEXT' },
    { table: 'users', column: 'date_entree_mairie', type: 'DATE' },
    { table: 'soldes_conges', column: 'jours_fractionnement', type: 'REAL DEFAULT 0' },
    { table: 'soldes_conges', column: 'jours_compensateurs', type: 'REAL DEFAULT 0' },
    { table: 'users', column: 'quotite_travail', type: 'REAL DEFAULT 100' },
    { table: 'users', column: 'responsable_id', type: 'INTEGER' },
    { table: 'users', column: 'niveau_validation', type: 'INTEGER DEFAULT 0' },
    { table: 'demandes_conges', column: 'statut_niveau_1', type: 'TEXT DEFAULT NULL' },
    { table: 'demandes_conges', column: 'validateur_niveau_1_id', type: 'INTEGER' },
    { table: 'demandes_conges', column: 'date_validation_niveau_1', type: 'DATETIME' },
    { table: 'demandes_conges', column: 'statut_niveau_2', type: 'TEXT DEFAULT NULL' },
    { table: 'demandes_conges', column: 'validateur_niveau_2_id', type: 'INTEGER' },
    { table: 'demandes_conges', column: 'date_validation_niveau_2', type: 'DATETIME' },
  ];
  for (const migration of migrations) {
    try {
      await client.execute(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.type}`);
      console.log(`Column ${migration.column} added to ${migration.table}`);
    } catch (error) {
      // Column already exists, ignore
    }
  }

  // Migration: Rendre email nullable dans users (migration déjà appliquée, ne plus ré-exécuter)

  // Migration: Recréer demandes_conges pour ajouter 'annulee' dans la contrainte CHECK du statut
  try {
    const schemaResult = await client.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name='demandes_conges'`);
    const schemaSql = schemaResult.rows[0]?.sql || '';
    if (schemaSql && !schemaSql.includes('annulee')) {
      console.log('Migration: Ajout du statut annulee à demandes_conges...');

      // Supprimer la table temporaire si elle existe d'une migration échouée précédente
      try { await client.execute(`DROP TABLE IF EXISTS demandes_conges_backup`); } catch (e) {}

      await client.execute(`ALTER TABLE demandes_conges RENAME TO demandes_conges_backup`);

      await client.execute(`CREATE TABLE demandes_conges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date_debut DATE NOT NULL,
        date_fin DATE NOT NULL,
        nombre_jours_ouvres REAL NOT NULL,
        type_debut TEXT DEFAULT 'journee_complete',
        type_fin TEXT DEFAULT 'journee_complete',
        motif TEXT,
        statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'validee', 'refusee', 'annulee')),
        date_demande DATETIME DEFAULT CURRENT_TIMESTAMP,
        date_validation DATETIME,
        validateur_id INTEGER,
        commentaire_rh TEXT,
        statut_niveau_1 TEXT,
        validateur_niveau_1_id INTEGER,
        date_validation_niveau_1 DATETIME,
        statut_niveau_2 TEXT,
        validateur_niveau_2_id INTEGER,
        date_validation_niveau_2 DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (validateur_id) REFERENCES users(id)
      )`);

      // Extraire les noms de colonnes depuis le SQL du schema original
      const allNewCols = ['id','user_id','date_debut','date_fin','nombre_jours_ouvres','type_debut','type_fin','motif','statut','date_demande','date_validation','validateur_id','commentaire_rh','statut_niveau_1','validateur_niveau_1_id','date_validation_niveau_1','statut_niveau_2','validateur_niveau_2_id','date_validation_niveau_2'];
      const existingCols = allNewCols.filter(c => schemaSql.includes(c));
      const colList = existingCols.join(', ');

      await client.execute(`INSERT INTO demandes_conges (${colList}) SELECT ${colList} FROM demandes_conges_backup`);
      await client.execute(`DROP TABLE demandes_conges_backup`);
      console.log('Migration: statut annulee ajouté avec succès');
    }
  } catch (migrationError) {
    console.error('Migration demandes_conges annulee failed:', migrationError);
  }

  // Create cet table if not exists
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS cet (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        solde REAL DEFAULT 0,
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } catch (error) { /* already exists */ }

  // Create cet_historique table if not exists
  try {
    await client.execute(`
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
  } catch (error) { /* already exists */ }

  // Create demandes_cet table if not exists
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS demandes_cet (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
        jours REAL NOT NULL,
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
  } catch (error) { /* already exists */ }

  // Create push_subscriptions table if not exists
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } catch (error) { /* already exists */ }

  // Create jours_cours table for alternants school days
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS jours_cours (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL,
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, date)
      )
    `);
  } catch (error) { /* already exists */ }

  // Create demandes_recuperation table if not exists
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS demandes_recuperation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date_travail DATE NOT NULL,
        nombre_heures REAL NOT NULL,
        raison TEXT NOT NULL,
        type_compensation TEXT NOT NULL CHECK(type_compensation IN ('remuneration', 'recuperation')),
        signature TEXT,
        document_data TEXT,
        statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'validee', 'refusee')),
        date_demande DATETIME DEFAULT CURRENT_TIMESTAMP,
        date_validation DATETIME,
        validateur_id INTEGER,
        commentaire TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (validateur_id) REFERENCES users(id)
      )
    `);
  } catch (error) { /* already exists */ }

  // Create soldes_recuperation table if not exists
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS soldes_recuperation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        heures_acquises REAL DEFAULT 0,
        date_maj DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } catch (error) { /* already exists */ }

  // Create demandes_utilisation_recup table if not exists
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS demandes_utilisation_recup (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date_debut DATE NOT NULL,
        date_fin DATE NOT NULL,
        nombre_heures REAL NOT NULL,
        raison TEXT,
        statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'validee', 'refusee')),
        date_demande DATETIME DEFAULT CURRENT_TIMESTAMP,
        date_validation DATETIME,
        validateur_id INTEGER,
        commentaire TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (validateur_id) REFERENCES users(id)
      )
    `);
  } catch (e) { /* table already exists */ }

  // Performance indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_demandes_user_id ON demandes_conges(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_demandes_statut ON demandes_conges(statut)',
    'CREATE INDEX IF NOT EXISTS idx_demandes_date_debut ON demandes_conges(date_debut)',
    'CREATE INDEX IF NOT EXISTS idx_soldes_user_annee ON soldes_conges(user_id, annee)',
    'CREATE INDEX IF NOT EXISTS idx_jours_feries_date ON jours_feries(date)',
    'CREATE INDEX IF NOT EXISTS idx_jours_cours_user_date ON jours_cours(user_id, date)',
    'CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_cet_hist_user ON cet_historique(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_demandes_cet_user ON demandes_cet(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_demandes_recup_user ON demandes_recuperation(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_demandes_recup_statut ON demandes_recuperation(statut)',
    'CREATE INDEX IF NOT EXISTS idx_soldes_recup_user ON soldes_recuperation(user_id)',
  ];
  for (const idx of indexes) {
    try { await client.execute(idx); } catch (e) { /* ignore */ }
  }
}

// Backward-compatible named export using lazy proxy with auto-init
export const db = new Proxy({}, {
  get(_, prop) {
    const client = getDb();
    if (prop === 'execute') {
      const originalExecute = client.execute.bind(client);
      return async (...args) => {
        await ensureInitialized();
        return originalExecute(...args);
      };
    }
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
        email TEXT UNIQUE,
        mot_de_passe TEXT NOT NULL,
        type_utilisateur TEXT NOT NULL,
        mot_de_passe_temporaire INTEGER DEFAULT 0,
        date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
        actif INTEGER DEFAULT 1,
        type_contrat TEXT,
        date_debut_contrat DATE,
        date_fin_contrat DATE,
        service TEXT,
        poste TEXT,
        quotite_travail REAL DEFAULT 100,
        responsable_id INTEGER,
        niveau_validation INTEGER DEFAULT 0
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
      { table: 'soldes_conges', column: 'jours_compensateurs', type: 'REAL DEFAULT 0' },
      { table: 'users', column: 'type_contrat', type: 'TEXT' },
      { table: 'users', column: 'date_debut_contrat', type: 'DATE' },
      { table: 'users', column: 'date_fin_contrat', type: 'DATE' },
      { table: 'users', column: 'service', type: 'TEXT' },
      { table: 'users', column: 'poste', type: 'TEXT' },
      { table: 'users', column: 'photo_profil', type: 'TEXT' },
      { table: 'users', column: 'date_entree_mairie', type: 'DATE' }
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
        statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'validee', 'refusee', 'annulee')),
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

    // Table demandes CET
    await db.execute(`
      CREATE TABLE IF NOT EXISTS demandes_cet (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
        jours REAL NOT NULL,
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

    // Table demandes_recuperation
    await db.execute(`
      CREATE TABLE IF NOT EXISTS demandes_recuperation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date_travail DATE NOT NULL,
        nombre_heures REAL NOT NULL,
        raison TEXT NOT NULL,
        type_compensation TEXT NOT NULL CHECK(type_compensation IN ('remuneration', 'recuperation')),
        signature TEXT,
        document_data TEXT,
        statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'validee', 'refusee')),
        date_demande DATETIME DEFAULT CURRENT_TIMESTAMP,
        date_validation DATETIME,
        validateur_id INTEGER,
        commentaire TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (validateur_id) REFERENCES users(id)
      )
    `);

    // Table soldes_recuperation
    await db.execute(`
      CREATE TABLE IF NOT EXISTS soldes_recuperation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        heures_acquises REAL DEFAULT 0,
        date_maj DATETIME DEFAULT CURRENT_TIMESTAMP,
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
