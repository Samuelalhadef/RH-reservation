import { createClient } from '@libsql/client';

let _db = null;
let _initialized = false;
let _initPromise = null;
let _migrationVersion = 12; // Incrémenter pour forcer re-migration
let _lastMigrationVersion = 0;

// Tables du parcours de validation (partagées entre runMigrations et initDatabase)
const ECHELONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS echelons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    ordre INTEGER NOT NULL DEFAULT 0,
    valide INTEGER NOT NULL DEFAULT 1,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;
const VALIDATIONS_ETAPES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS validations_etapes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    demande_table TEXT NOT NULL,
    demande_id INTEGER NOT NULL,
    niveau INTEGER NOT NULL,
    validateur_id INTEGER,
    date_validation DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

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
    { table: 'soldes_conges', column: 'jours_cet', type: 'REAL DEFAULT 0' },
    { table: 'users', column: 'quotite_travail', type: 'REAL DEFAULT 100' },
    { table: 'users', column: 'horaires_travail', type: 'TEXT' },
    { table: 'users', column: 'responsable_id', type: 'INTEGER' },
    { table: 'users', column: 'niveau_validation', type: 'INTEGER DEFAULT 0' },
    { table: 'demandes_conges', column: 'statut_niveau_1', type: 'TEXT DEFAULT NULL' },
    { table: 'demandes_conges', column: 'validateur_niveau_1_id', type: 'INTEGER' },
    { table: 'demandes_conges', column: 'date_validation_niveau_1', type: 'DATETIME' },
    { table: 'demandes_conges', column: 'statut_niveau_2', type: 'TEXT DEFAULT NULL' },
    { table: 'demandes_conges', column: 'validateur_niveau_2_id', type: 'INTEGER' },
    { table: 'demandes_conges', column: 'date_validation_niveau_2', type: 'DATETIME' },
    // Validation hiérarchique pour demandes_recuperation (déclaration d'heures sup)
    { table: 'demandes_recuperation', column: 'statut_niveau_1', type: 'TEXT DEFAULT NULL' },
    { table: 'demandes_recuperation', column: 'validateur_niveau_1_id', type: 'INTEGER' },
    { table: 'demandes_recuperation', column: 'date_validation_niveau_1', type: 'DATETIME' },
    { table: 'demandes_recuperation', column: 'statut_niveau_2', type: 'TEXT DEFAULT NULL' },
    { table: 'demandes_recuperation', column: 'validateur_niveau_2_id', type: 'INTEGER' },
    { table: 'demandes_recuperation', column: 'date_validation_niveau_2', type: 'DATETIME' },
    // Validation hiérarchique pour demandes_utilisation_recup
    { table: 'demandes_utilisation_recup', column: 'statut_niveau_1', type: 'TEXT DEFAULT NULL' },
    { table: 'demandes_utilisation_recup', column: 'validateur_niveau_1_id', type: 'INTEGER' },
    { table: 'demandes_utilisation_recup', column: 'date_validation_niveau_1', type: 'DATETIME' },
    { table: 'demandes_utilisation_recup', column: 'statut_niveau_2', type: 'TEXT DEFAULT NULL' },
    { table: 'demandes_utilisation_recup', column: 'validateur_niveau_2_id', type: 'INTEGER' },
    { table: 'demandes_utilisation_recup', column: 'date_validation_niveau_2', type: 'DATETIME' },
    // Congé enfant malade (demi-journées + prénom de l'enfant)
    { table: 'demandes_parentalite', column: 'type_debut', type: "TEXT DEFAULT 'journee_complete'" },
    { table: 'demandes_parentalite', column: 'type_fin', type: "TEXT DEFAULT 'journee_complete'" },
    { table: 'demandes_parentalite', column: 'enfant_prenom', type: 'TEXT' },
    // Parcours de validation à N étapes (pyramide /rh/hierarchie)
    { table: 'users', column: 'echelon_id', type: 'INTEGER' },
    { table: 'demandes_conges', column: 'niveau_valide', type: 'INTEGER DEFAULT 0' },
    { table: 'demandes_recuperation', column: 'niveau_valide', type: 'INTEGER DEFAULT 0' },
    { table: 'demandes_utilisation_recup', column: 'niveau_valide', type: 'INTEGER DEFAULT 0' },
  ];
  // Lecture unique du schéma : au lieu d'envoyer ~55 requêtes séquentielles à
  // Turso à chaque démarrage (ce qui bloquait la 1re requête, typiquement la
  // liste des comptes sur l'écran de connexion), on ne lance que ce qui manque.
  const schema = await client.execute(`SELECT type, name, sql FROM sqlite_master WHERE type IN ('table', 'index')`);
  const tableSql = new Map();
  const existingIndexes = new Set();
  for (const row of schema.rows) {
    if (row.type === 'table') tableSql.set(row.name, row.sql || '');
    else existingIndexes.add(row.name);
  }
  const hasColumn = (table, column) =>
    new RegExp(`\\b${column}\\b`).test(tableSql.get(table) || '');

  const addMissingColumns = async (onlyMissingTables) => {
    for (const migration of migrations) {
      const tableExisted = tableSql.has(migration.table);
      if (onlyMissingTables ? tableExisted : !tableExisted) continue;
      if (tableExisted && hasColumn(migration.table, migration.column)) continue;
      try {
        await client.execute(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.type}`);
        console.log(`Column ${migration.column} added to ${migration.table}`);
      } catch (error) {
        // Column already exists, ignore
      }
    }
  };

  // Colonnes des tables déjà existantes (les tables absentes sont traitées après leur création)
  await addMissingColumns(false);

  // Migration: Rendre email nullable dans users (migration déjà appliquée, ne plus ré-exécuter)

  // Migration: Recréer demandes_conges pour ajouter 'annulee' dans la contrainte CHECK du statut
  try {
    const schemaSql = tableSql.get('demandes_conges') || '';
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
        niveau_valide INTEGER DEFAULT 0,
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
  if (!tableSql.has('cet')) try {
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
  if (!tableSql.has('cet_historique')) try {
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
  if (!tableSql.has('demandes_cet')) try {
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
  if (!tableSql.has('push_subscriptions')) try {
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
  if (!tableSql.has('jours_cours')) try {
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
  if (!tableSql.has('demandes_recuperation')) try {
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
  if (!tableSql.has('soldes_recuperation')) try {
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
  if (!tableSql.has('demandes_utilisation_recup')) try {
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

  // Create demandes_parentalite table if not exists (congés maternité / paternité)
  if (!tableSql.has('demandes_parentalite')) try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS demandes_parentalite (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('maternite', 'paternite', 'adoption', 'enfant_malade')),
        date_debut DATE NOT NULL,
        date_fin DATE NOT NULL,
        nombre_jours REAL,
        motif TEXT,
        document_data TEXT,
        statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'validee', 'refusee', 'annulee')),
        date_demande DATETIME DEFAULT CURRENT_TIMESTAMP,
        date_validation DATETIME,
        validateur_id INTEGER,
        commentaire_rh TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (validateur_id) REFERENCES users(id)
      )
    `);
  } catch (e) { /* table already exists */ }

  // Migration : autoriser le type 'enfant_malade' dans demandes_parentalite
  // (contrainte CHECK non modifiable en SQLite → recréation de la table, dans une transaction)
  try {
    const parentSql = tableSql.get('demandes_parentalite') || '';
    if (parentSql && !parentSql.includes('enfant_malade')) {
      console.log("Migration: ajout du type enfant_malade à demandes_parentalite...");
      const baseCols = ['id', 'user_id', 'type', 'date_debut', 'date_fin', 'nombre_jours', 'motif', 'document_data', 'statut', 'date_demande', 'date_validation', 'validateur_id', 'commentaire_rh', 'type_debut', 'type_fin', 'enfant_prenom'];
      const colList = baseCols.filter((c) => hasColumn('demandes_parentalite', c)).join(', ');
      await client.batch([
        'DROP TABLE IF EXISTS demandes_parentalite_backup',
        'ALTER TABLE demandes_parentalite RENAME TO demandes_parentalite_backup',
        `CREATE TABLE demandes_parentalite (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('maternite', 'paternite', 'adoption', 'enfant_malade')),
          date_debut DATE NOT NULL,
          date_fin DATE NOT NULL,
          nombre_jours REAL,
          motif TEXT,
          document_data TEXT,
          statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'validee', 'refusee', 'annulee')),
          date_demande DATETIME DEFAULT CURRENT_TIMESTAMP,
          date_validation DATETIME,
          validateur_id INTEGER,
          commentaire_rh TEXT,
          type_debut TEXT DEFAULT 'journee_complete',
          type_fin TEXT DEFAULT 'journee_complete',
          enfant_prenom TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (validateur_id) REFERENCES users(id)
        )`,
        `INSERT INTO demandes_parentalite (${colList}) SELECT ${colList} FROM demandes_parentalite_backup`,
        'DROP TABLE demandes_parentalite_backup',
      ], 'write');
      console.log('Migration: type enfant_malade ajouté avec succès');
    }
  } catch (migrationError) {
    console.error('Migration demandes_parentalite enfant_malade failed:', migrationError);
  }

  // Échelons de la pyramide hiérarchique (ordre 1 = juste sous la RH/DGS)
  if (!tableSql.has('echelons')) try {
    await client.execute(ECHELONS_TABLE_SQL);
  } catch (e) { /* table already exists */ }

  // Historique des étapes intermédiaires validées (niveau 1, 2, 3, …)
  if (!tableSql.has('validations_etapes')) try {
    await client.execute(VALIDATIONS_ETAPES_TABLE_SQL);
  } catch (e) { /* table already exists */ }

  // Colonnes des tables qui viennent d'être créées ci-dessus
  await addMissingColumns(true);

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
    'CREATE INDEX IF NOT EXISTS idx_demandes_parentalite_user ON demandes_parentalite(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_demandes_parentalite_statut ON demandes_parentalite(statut)',
    'CREATE INDEX IF NOT EXISTS idx_validations_etapes_demande ON validations_etapes(demande_table, demande_id)',
  ];
  for (const idx of indexes) {
    const name = idx.match(/IF NOT EXISTS (\w+)/)[1];
    if (existingIndexes.has(name)) continue;
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
        horaires_travail TEXT,
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
        jours_cet REAL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, annee)
      )
    `);

    // Migrations: Ajouter les colonnes manquantes si elles n'existent pas
    const migrations = [
      { table: 'soldes_conges', column: 'jours_fractionnement', type: 'REAL DEFAULT 0' },
      { table: 'soldes_conges', column: 'jours_compensateurs', type: 'REAL DEFAULT 0' },
      { table: 'soldes_conges', column: 'jours_cet', type: 'REAL DEFAULT 0' },
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

    // Pyramide hiérarchique + historique des étapes de validation
    await db.execute(ECHELONS_TABLE_SQL);
    await db.execute(VALIDATIONS_ETAPES_TABLE_SQL);

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

    // Table demandes_parentalite (congés maternité / paternité / adoption)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS demandes_parentalite (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('maternite', 'paternite', 'adoption', 'enfant_malade')),
        date_debut DATE NOT NULL,
        date_fin DATE NOT NULL,
        nombre_jours REAL,
        motif TEXT,
        document_data TEXT,
        statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'validee', 'refusee', 'annulee')),
        date_demande DATETIME DEFAULT CURRENT_TIMESTAMP,
        date_validation DATETIME,
        validateur_id INTEGER,
        commentaire_rh TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (validateur_id) REFERENCES users(id)
      )
    `);

    console.log('✅ Database tables initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};
