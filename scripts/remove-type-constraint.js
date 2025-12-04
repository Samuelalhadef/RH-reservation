import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '../src/lib/db.js';

const removeConstraint = async () => {
  try {
    console.log('🔄 Suppression de la contrainte CHECK sur type_utilisateur...\n');

    // Étape 1 : Créer une nouvelle table sans la contrainte
    console.log('1️⃣ Création de la nouvelle table users_new...');
    await db.execute(`
      CREATE TABLE users_new (
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

    // Étape 2 : Copier toutes les données
    console.log('2️⃣ Copie des données de users vers users_new...');
    await db.execute(`
      INSERT INTO users_new
      SELECT id, nom, prenom, email, mot_de_passe, type_utilisateur,
             mot_de_passe_temporaire, date_creation, actif, type_contrat,
             date_debut_contrat, date_fin_contrat, service, poste
      FROM users
    `);

    // Étape 3 : Supprimer l'ancienne table
    console.log('3️⃣ Suppression de l\'ancienne table users...');
    await db.execute('DROP TABLE users');

    // Étape 4 : Renommer la nouvelle table
    console.log('4️⃣ Renommage de users_new en users...');
    await db.execute('ALTER TABLE users_new RENAME TO users');

    console.log('\n✅ Migration terminée avec succès !');
    console.log('Le champ type_utilisateur peut maintenant accepter n\'importe quelle valeur.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    console.error('Détails:', error.message);
    process.exit(1);
  }
};

removeConstraint();
