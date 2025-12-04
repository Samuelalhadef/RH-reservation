import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '../src/lib/db.js';

const cleanupDuplicates = async () => {
  try {
    console.log('🧹 Nettoyage des doublons dans la base de données...\n');

    // Récupérer tous les utilisateurs
    const allUsers = await db.execute('SELECT id, nom, prenom, email, service, poste FROM users ORDER BY id');

    console.log(`Total utilisateurs trouvés : ${allUsers.rows.length}\n`);

    // Grouper par nom/prénom pour détecter les doublons
    const userGroups = {};

    for (const user of allUsers.rows) {
      const key = `${user.nom.toLowerCase()}_${user.prenom.toLowerCase()}`;
      if (!userGroups[key]) {
        userGroups[key] = [];
      }
      userGroups[key].push(user);
    }

    let deletedCount = 0;
    let keptCount = 0;

    // Pour chaque groupe, garder celui avec le plus d'informations
    for (const [key, users] of Object.entries(userGroups)) {
      if (users.length > 1) {
        console.log(`\n📋 Doublon détecté pour ${users[0].prenom} ${users[0].nom}:`);

        // Trier : priorité aux utilisateurs avec service et poste
        users.sort((a, b) => {
          const scoreA = (a.service ? 2 : 0) + (a.poste ? 2 : 0) + (a.email.includes('mairie-chartrettes') ? 1 : 0);
          const scoreB = (b.service ? 2 : 0) + (b.poste ? 2 : 0) + (b.email.includes('mairie-chartrettes') ? 1 : 0);
          return scoreB - scoreA;
        });

        const userToKeep = users[0];
        const usersToDelete = users.slice(1);

        console.log(`  ✅ Garder : ID ${userToKeep.id} - ${userToKeep.email} - ${userToKeep.poste || 'sans poste'} (${userToKeep.service || 'sans service'})`);

        for (const user of usersToDelete) {
          console.log(`  ❌ Supprimer : ID ${user.id} - ${user.email} - ${user.poste || 'sans poste'} (${user.service || 'sans service'})`);

          // D'abord, transférer les demandes de congés créées par cet utilisateur
          await db.execute({
            sql: 'UPDATE demandes_conges SET user_id = ? WHERE user_id = ?',
            args: [userToKeep.id, user.id]
          });

          // Transférer les demandes validées par cet utilisateur
          await db.execute({
            sql: 'UPDATE demandes_conges SET validateur_id = ? WHERE validateur_id = ?',
            args: [userToKeep.id, user.id]
          });

          // Supprimer les soldes de congés de l'ancien utilisateur
          await db.execute({
            sql: 'DELETE FROM soldes_conges WHERE user_id = ?',
            args: [user.id]
          });

          // Supprimer l'utilisateur
          await db.execute({
            sql: 'DELETE FROM users WHERE id = ?',
            args: [user.id]
          });

          deletedCount++;
        }

        keptCount++;
      } else {
        keptCount++;
      }
    }

    console.log('\n\n✨ Nettoyage terminé !');
    console.log(`📊 Statistiques :`);
    console.log(`   - ${keptCount} utilisateur(s) conservé(s)`);
    console.log(`   - ${deletedCount} doublon(s) supprimé(s)`);

    // Afficher la liste finale
    const finalUsers = await db.execute('SELECT id, nom, prenom, email, service, poste, type_contrat FROM users ORDER BY service, nom, prenom');

    console.log(`\n📋 Liste finale : ${finalUsers.rows.length} utilisateurs\n`);

    let currentService = '';
    for (const user of finalUsers.rows) {
      if (user.service !== currentService) {
        currentService = user.service;
        console.log(`\n--- ${currentService || 'Sans service'} ---`);
      }
      console.log(`  ${user.prenom} ${user.nom} - ${user.poste || 'sans poste'} (${user.type_contrat || 'CDI'})`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    process.exit(1);
  }
};

cleanupDuplicates();
