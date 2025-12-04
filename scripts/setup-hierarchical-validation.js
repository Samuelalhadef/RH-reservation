import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '../src/lib/db.js';

const setupHierarchy = async () => {
  try {
    console.log('🏗️  Configuration du système de validation hiérarchique...\n');

    // Étape 1: Ajouter les colonnes nécessaires à la table users
    console.log('1️⃣ Ajout des colonnes responsable_id et niveau_validation...');

    try {
      await db.execute('ALTER TABLE users ADD COLUMN responsable_id INTEGER');
      console.log('   ✅ Colonne responsable_id ajoutée');
    } catch (e) {
      console.log('   ℹ️  Colonne responsable_id existe déjà');
    }

    try {
      await db.execute('ALTER TABLE users ADD COLUMN niveau_validation INTEGER DEFAULT 0');
      console.log('   ✅ Colonne niveau_validation ajoutée');
    } catch (e) {
      console.log('   ℹ️  Colonne niveau_validation existe déjà');
    }

    // Étape 2: Modifier la table demandes_conges pour gérer plusieurs niveaux
    console.log('\n2️⃣ Modification de la table demandes_conges...');

    try {
      await db.execute('ALTER TABLE demandes_conges ADD COLUMN statut_niveau_1 TEXT DEFAULT NULL');
      console.log('   ✅ Colonne statut_niveau_1 ajoutée');
    } catch (e) {
      console.log('   ℹ️  Colonne statut_niveau_1 existe déjà');
    }

    try {
      await db.execute('ALTER TABLE demandes_conges ADD COLUMN validateur_niveau_1_id INTEGER');
      console.log('   ✅ Colonne validateur_niveau_1_id ajoutée');
    } catch (e) {
      console.log('   ℹ️  Colonne validateur_niveau_1_id existe déjà');
    }

    try {
      await db.execute('ALTER TABLE demandes_conges ADD COLUMN date_validation_niveau_1 DATETIME');
      console.log('   ✅ Colonne date_validation_niveau_1 ajoutée');
    } catch (e) {
      console.log('   ℹ️  Colonne date_validation_niveau_1 existe déjà');
    }

    try {
      await db.execute('ALTER TABLE demandes_conges ADD COLUMN statut_niveau_2 TEXT DEFAULT NULL');
      console.log('   ✅ Colonne statut_niveau_2 ajoutée');
    } catch (e) {
      console.log('   ℹ️  Colonne statut_niveau_2 existe déjà');
    }

    try {
      await db.execute('ALTER TABLE demandes_conges ADD COLUMN validateur_niveau_2_id INTEGER');
      console.log('   ✅ Colonne validateur_niveau_2_id ajoutée');
    } catch (e) {
      console.log('   ℹ️  Colonne validateur_niveau_2_id existe déjà');
    }

    try {
      await db.execute('ALTER TABLE demandes_conges ADD COLUMN date_validation_niveau_2 DATETIME');
      console.log('   ✅ Colonne date_validation_niveau_2 ajoutée');
    } catch (e) {
      console.log('   ℹ️  Colonne date_validation_niveau_2 existe déjà');
    }

    // Étape 3: Mettre à jour les statuts et hiérarchie
    console.log('\n3️⃣ Configuration de la hiérarchie...\n');

    // Trouver les IDs des responsables
    const dominique = await db.execute('SELECT id FROM users WHERE nom = \'LEROI\' AND prenom = \'Dominique\'');
    const alexine = await db.execute('SELECT id FROM users WHERE nom = \'MARQUES\' AND prenom = \'Alexine\'');
    const carmen = await db.execute('SELECT id FROM users WHERE nom = \'DI STEFANO\' AND prenom = \'Carmen\'');

    if (dominique.rows.length === 0 || alexine.rows.length === 0 || carmen.rows.length === 0) {
      console.error('❌ Impossible de trouver tous les responsables');
      process.exit(1);
    }

    const dominiqueId = dominique.rows[0].id;
    const alexineId = alexine.rows[0].id;
    const carmenId = carmen.rows[0].id;

    console.log(`   📋 Dominique LEROI (ID: ${dominiqueId})`);
    console.log(`   📋 Alexine MARQUES (ID: ${alexineId})`);
    console.log(`   📋 Carmen DI STEFANO (ID: ${carmenId})`);

    // Mettre à jour Dominique LEROI
    await db.execute({
      sql: 'UPDATE users SET type_utilisateur = ?, niveau_validation = 1 WHERE id = ?',
      args: ['Responsable Serv. Tech.', dominiqueId]
    });
    console.log('\n   ✅ Dominique LEROI → Responsable Serv. Tech. (Niveau 1)');

    // Mettre à jour Alexine MARQUES
    await db.execute({
      sql: 'UPDATE users SET type_utilisateur = ?, niveau_validation = 1, responsable_id = ? WHERE id = ?',
      args: ['Responsable Anim.', carmenId, alexineId]
    });
    console.log('   ✅ Alexine MARQUES → Responsable Anim. (Niveau 1, rapporte à Carmen)');

    // Mettre à jour Carmen DI STEFANO
    await db.execute({
      sql: 'UPDATE users SET niveau_validation = 2 WHERE id = ?',
      args: [carmenId]
    });
    console.log('   ✅ Carmen DI STEFANO → Direction (Niveau 2)');

    // Attribuer Dominique comme responsable de tous les agents techniques
    const techAgents = await db.execute('SELECT id, nom, prenom FROM users WHERE type_utilisateur = \'Service Technique\'');
    console.log(`\n   📌 Attribution de Dominique à ${techAgents.rows.length} agent(s) technique(s):`);

    for (const agent of techAgents.rows) {
      await db.execute({
        sql: 'UPDATE users SET responsable_id = ? WHERE id = ?',
        args: [dominiqueId, agent.id]
      });
      console.log(`      → ${agent.prenom} ${agent.nom}`);
    }

    // Attribuer Alexine comme responsable de tous les animateurs
    const animateurs = await db.execute('SELECT id, nom, prenom FROM users WHERE type_utilisateur = \'Animateur\'');
    console.log(`\n   📌 Attribution d'Alexine à ${animateurs.rows.length} animateur(s):`);

    for (const agent of animateurs.rows) {
      await db.execute({
        sql: 'UPDATE users SET responsable_id = ? WHERE id = ?',
        args: [alexineId, agent.id]
      });
      console.log(`      → ${agent.prenom} ${agent.nom}`);
    }

    // Attribuer Carmen comme responsable d'Alexine (si pas déjà fait)
    console.log('\n   📌 Hiérarchie complète:');
    console.log('      Agents Techniques → Dominique → RH');
    console.log('      Animateurs → Alexine → Carmen → RH');

    console.log('\n✨ Configuration terminée avec succès !');

    // Afficher un résumé
    const summary = await db.execute(`
      SELECT
        u.nom,
        u.prenom,
        u.type_utilisateur,
        u.niveau_validation,
        r.nom as resp_nom,
        r.prenom as resp_prenom
      FROM users u
      LEFT JOIN users r ON u.responsable_id = r.id
      WHERE u.responsable_id IS NOT NULL OR u.niveau_validation > 0
      ORDER BY u.niveau_validation DESC, u.nom
    `);

    console.log('\n📋 Récapitulatif de la hiérarchie:\n');
    for (const row of summary.rows) {
      const niveau = row.niveau_validation > 0 ? ` [Niveau ${row.niveau_validation}]` : '';
      const responsable = row.resp_nom ? ` → Responsable: ${row.resp_prenom} ${row.resp_nom}` : '';
      console.log(`   ${row.prenom} ${row.nom} (${row.type_utilisateur})${niveau}${responsable}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error);
    console.error('Détails:', error.message);
    process.exit(1);
  }
};

setupHierarchy();
