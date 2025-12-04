import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '../src/lib/db.js';

const updateUserTypes = async () => {
  try {
    console.log('🔄 Mise à jour des types d\'utilisateurs basés sur les postes...\n');

    // Récupérer tous les utilisateurs
    const allUsers = await db.execute('SELECT id, nom, prenom, poste, service, type_utilisateur FROM users');

    console.log(`Total utilisateurs : ${allUsers.rows.length}\n`);

    let updatedCount = 0;

    for (const user of allUsers.rows) {
      let newType = user.type_utilisateur; // Type actuel par défaut
      const poste = user.poste?.toLowerCase() || '';
      const service = user.service?.toLowerCase() || '';

      // Déterminer le nouveau type en fonction du poste et du service
      if (poste.includes('dgs') || poste.includes('dir. vie locale')) {
        newType = 'Direction';
      } else if (poste.includes('resp. rh') || poste === 'rh') {
        newType = 'RH';
      } else if (poste.includes('policier')) {
        newType = 'Police Municipale';
      } else if (poste.includes('animateur') || poste.includes('animatrice')) {
        newType = 'Animateur';
      } else if (service.includes('services tech')) {
        newType = 'Service Technique';
      } else if (poste.includes('atsem') || poste.includes('adj. anim')) {
        newType = 'ATSEM/Animation';
      } else if (poste.includes('agent technique') || poste.includes('adjoint technique') || poste.includes('chef')) {
        newType = 'Technique';
      } else if (poste.includes('resp.') || poste.includes('responsable')) {
        newType = 'Responsable';
      } else if (poste.includes('agent d\'entretien')) {
        newType = 'Entretien';
      } else if (service.includes('admin')) {
        newType = 'Administratif';
      } else {
        newType = 'Employé';
      }

      // Mettre à jour si le type a changé
      if (newType !== user.type_utilisateur) {
        await db.execute({
          sql: 'UPDATE users SET type_utilisateur = ? WHERE id = ?',
          args: [newType, user.id]
        });

        console.log(`✅ ${user.prenom} ${user.nom} : "${user.type_utilisateur}" → "${newType}" (${user.poste})`);
        updatedCount++;
      } else {
        console.log(`⏭️  ${user.prenom} ${user.nom} : "${newType}" (inchangé)`);
      }
    }

    console.log('\n✨ Mise à jour terminée !');
    console.log(`📊 ${updatedCount} utilisateur(s) mis à jour`);

    // Afficher un résumé par type
    const summary = await db.execute('SELECT type_utilisateur, COUNT(*) as count FROM users GROUP BY type_utilisateur ORDER BY count DESC');

    console.log('\n📋 Répartition par type :');
    for (const row of summary.rows) {
      console.log(`   - ${row.type_utilisateur}: ${row.count} personne(s)`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error);
    process.exit(1);
  }
};

updateUserTypes();
