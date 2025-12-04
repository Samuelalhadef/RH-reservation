import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '../src/lib/db.js';
import bcrypt from 'bcrypt';

const importAllEmployees = async () => {
  try {
    console.log('📥 Importation complète des agents de la Mairie de Chartrettes...');

    const tempPassword = 'chartrettes2025';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Liste complète des agents avec tous leurs détails
    const employees = [
      // ADMIN. GÉNÉRALE
      { nom: 'CRANTZ', prenom: 'Laura', email: 'urbanisme@mairie-chartrettes.fr', type: 'Employé', service: 'ADMIN. GÉNÉRALE', poste: 'Resp. Urbanisme', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'DE MELO', prenom: 'Virginie', email: 'RH@mairie-chartrettes.fr', type: 'RH', service: 'ADMIN. GÉNÉRALE', poste: 'Resp. RH', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'GONOD', prenom: 'Nadine', email: 'finances@mairie-chartrettes.fr', type: 'Employé', service: 'ADMIN. GÉNÉRALE', poste: 'Resp. Finances', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'MIRGUET', prenom: 'Valérie', email: 'social@mairie-chartrettes.fr', type: 'Employé', service: 'ADMIN. GÉNÉRALE', poste: 'Resp. Social', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'NOYELLE', prenom: 'Claudine', email: 'dgs@mairie-chartrettes.fr', type: 'DG', service: 'ADMIN. GÉNÉRALE', poste: 'DGS', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'ROUX', prenom: 'Ingrid', email: 'finances2@mairie-chartrettes.fr', type: 'Employé', service: 'ADMIN. GÉNÉRALE', poste: 'Facturation', type_contrat: 'CDI', heures: '17h50' },

      // C.L.S.H.
      { nom: 'AMIM', prenom: 'Margarida', email: 'margarida.amim@mairie-chartrettes.fr', type: 'Employé', service: 'C.L.S.H.', poste: 'Adj. Tech. Territ.', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'BACHELIN', prenom: 'Stéphanie', email: 'stephanie.bachelin@mairie-chartrettes.fr', type: 'Employé', service: 'C.L.S.H.', poste: 'Resp. adj. ACM', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'BISANTI', prenom: 'Géraldine', email: 'geraldine.bisanti@mairie-chartrettes.fr', type: 'Employé', service: 'C.L.S.H.', poste: 'Animatrice', type_contrat: 'CDI', heures: '30h00' },
      { nom: 'BLONDEL', prenom: 'Laura', email: 'laura.blondel@mairie-chartrettes.fr', type: 'Employé', service: 'C.L.S.H.', poste: 'Adj. Anim. (ATSEM)', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'DI STEFANO', prenom: 'Carmen', email: 'vie.locale@mairie-chartrettes.fr', type: 'DG', service: 'C.L.S.H.', poste: 'Dir. Vie Locale', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'KOUALOU MAKOSSO', prenom: 'Marie', email: 'marie.koualou@mairie-chartrettes.fr', type: 'Employé', service: 'C.L.S.H.', poste: 'Agent d\'entretien', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'MARQUES', prenom: 'Alexine', email: 'centredeloisirs@mairie-chartrettes.fr', type: 'Employé', service: 'C.L.S.H.', poste: 'Resp. Centre Loisirs', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'PELISSIER', prenom: 'Mathieu', email: 'mathieu.pelissier@mairie-chartrettes.fr', type: 'Employé', service: 'C.L.S.H.', poste: 'Animateur', type_contrat: 'CDD', heures: '30h00', date_debut_contrat: '2025-12-01', date_fin_contrat: '2026-05-31' },
      { nom: 'EVENOU', prenom: 'Louna', email: 'louna.evenou@mairie-chartrettes.fr', type: 'Employé', service: 'C.L.S.H.', poste: 'Adj. d\'animation', type_contrat: 'CDD', heures: '24h00', date_debut_contrat: '2025-12-01', date_fin_contrat: '2026-05-31' },
      { nom: 'LIBERGE', prenom: 'Amandine', email: 'amandine.liberge@mairie-chartrettes.fr', type: 'Employé', service: 'C.L.S.H.', poste: 'Animatrice', type_contrat: 'CDD', heures: '30h00', date_debut_contrat: '2025-06-01', date_fin_contrat: '2026-05-31' },
      { nom: 'MADO', prenom: 'Enora', email: 'enora.mado@mairie-chartrettes.fr', type: 'Employé', service: 'C.L.S.H.', poste: 'Animatrice', type_contrat: 'CDD', heures: '35h00', date_debut_contrat: '2025-03-01', date_fin_contrat: '2026-02-28' },
      { nom: 'ROUX', prenom: 'Julie', email: 'julie.roux@mairie-chartrettes.fr', type: 'Employé', service: 'C.L.S.H.', poste: 'Adj. Anim. (ATSEM)', type_contrat: 'CDD', heures: '35h00', date_debut_contrat: '2025-03-01', date_fin_contrat: '2026-02-28' },

      // ÉCOLE ÉLÉM.
      { nom: 'CANTEIRO', prenom: 'Alvina', email: 'alvina.canteiro@mairie-chartrettes.fr', type: 'Employé', service: 'ÉCOLE ÉLÉM.', poste: 'Adj. Tech. Territ.', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'FREGUIN', prenom: 'Peggy', email: 'peggy.freguin@mairie-chartrettes.fr', type: 'Employé', service: 'ÉCOLE ÉLÉM.', poste: 'Adj. Tech. Territ.', type_contrat: 'CDI', heures: '35h00' },

      // ÉCOLE MAT.
      { nom: 'DE ALMEIDA', prenom: 'Cécile', email: 'cecile.dealmeida@mairie-chartrettes.fr', type: 'Employé', service: 'ÉCOLE MAT.', poste: 'Adj. Anim. (ATSEM)', type_contrat: 'CDI', heures: '35h00' },

      // EMC (Espace Municipal Culturel)
      { nom: 'CONIN', prenom: 'Guillaume', email: 'animateur.culturel@mairie-chartrettes.fr', type: 'Employé', service: 'EMC', poste: 'Animateur Culturel', type_contrat: 'CDI', heures: '35h00' },

      // RESTAURATION
      { nom: 'GOFFAUX', prenom: 'Stéphanie', email: 'restaurant@mairie-chartrettes.fr', type: 'Employé', service: 'RESTAURATION', poste: 'Responsable RMS', type_contrat: 'CDI', heures: '35h00' },

      // SÉCURITÉ
      { nom: 'MESSMER', prenom: 'Frédéric', email: 'police@mairie-chartrettes.fr', type: 'Employé', service: 'SÉCURITÉ', poste: 'Policier Municipal', type_contrat: 'CDI', heures: '35h00' },

      // SERVICES TECH.
      { nom: 'FUZEAU', prenom: 'Franck', email: 'franck.fuzeau@mairie-chartrettes.fr', type: 'Service Technique', service: 'SERVICES TECH.', poste: 'Agent technique', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'LEPINAY', prenom: 'Raphaël', email: 'raphael.lepinay@mairie-chartrettes.fr', type: 'Service Technique', service: 'SERVICES TECH.', poste: 'Chef éq. Esp. Verts', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'LEROI', prenom: 'Dominique', email: 'servicestechniques@mairie-chartrettes.fr', type: 'Service Technique', service: 'SERVICES TECH.', poste: 'Resp. Services Tech', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'RIVIERE', prenom: 'Jordan', email: 'jordan.riviere@mairie-chartrettes.fr', type: 'Service Technique', service: 'SERVICES TECH.', poste: 'Agent technique', type_contrat: 'CDI', heures: '35h00' },
      { nom: 'LESTOILLE', prenom: 'Damien', email: 'damien.lestoille@mairie-chartrettes.fr', type: 'Service Technique', service: 'SERVICES TECH.', poste: 'Agent technique', type_contrat: 'CDD', heures: '35h00', date_debut_contrat: '2025-12-01', date_fin_contrat: '2026-02-28' },
      { nom: 'MALUMANDSOKO', prenom: 'Glodi', email: 'glodi.malumandsoko@mairie-chartrettes.fr', type: 'Service Technique', service: 'SERVICES TECH.', poste: 'Agent technique', type_contrat: 'CDD', heures: '35h00', date_debut_contrat: '2025-10-08', date_fin_contrat: '2026-01-31' },
      { nom: 'SARAIVA', prenom: 'Antoine', email: 'antoine.saraiva@mairie-chartrettes.fr', type: 'Service Technique', service: 'SERVICES TECH.', poste: 'Adjoint Technique', type_contrat: 'CDD', heures: '35h00', date_debut_contrat: '2025-05-01', date_fin_contrat: '2026-04-30' },
      { nom: 'TEYSSIER', prenom: 'Thomas', email: 'thomas.teyssier@mairie-chartrettes.fr', type: 'Service Technique', service: 'SERVICES TECH.', poste: 'Agent technique', type_contrat: 'CDD', heures: '35h00', date_debut_contrat: '2025-10-13', date_fin_contrat: '2026-01-31' },
    ];

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const employee of employees) {
      const existing = await db.execute({
        sql: 'SELECT id FROM users WHERE email = ?',
        args: [employee.email]
      });

      if (existing.rows.length === 0) {
        // Créer le nouvel utilisateur
        const result = await db.execute({
          sql: `INSERT INTO users (nom, prenom, email, mot_de_passe, type_utilisateur, mot_de_passe_temporaire, service, poste, type_contrat, date_debut_contrat, date_fin_contrat)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
          args: [
            employee.nom,
            employee.prenom,
            employee.email,
            hashedPassword,
            employee.type,
            employee.service,
            employee.poste,
            employee.type_contrat,
            employee.date_debut_contrat || null,
            employee.date_fin_contrat || null
          ]
        });

        const userId = result.lastInsertRowid;
        const currentYear = new Date().getFullYear();

        // Calculer les jours de congés en fonction du type de contrat
        let joursAcquis = 25; // Par défaut CDI
        if (employee.type_contrat === 'CDD' && employee.date_debut_contrat && employee.date_fin_contrat) {
          // Pour les CDD, calculer au prorata
          const debut = new Date(employee.date_debut_contrat);
          const fin = new Date(employee.date_fin_contrat);
          const moisTravailles = (fin - debut) / (1000 * 60 * 60 * 24 * 30);
          joursAcquis = Math.floor((moisTravailles / 12) * 25);
        }

        // Créer le solde de congés
        await db.execute({
          sql: `INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants, jours_reportes)
                VALUES (?, ?, ?, 0, ?, 0)`,
          args: [userId, currentYear, joursAcquis, joursAcquis]
        });

        console.log(`✅ Agent créé: ${employee.prenom} ${employee.nom} - ${employee.poste} (${employee.service}) [${employee.type_contrat}${employee.heures ? ' - ' + employee.heures : ''}]`);
        addedCount++;
      } else {
        // Mettre à jour l'utilisateur existant avec les nouvelles informations
        const userId = existing.rows[0].id;

        await db.execute({
          sql: `UPDATE users
                SET service = ?, poste = ?, type_contrat = ?, date_debut_contrat = ?, date_fin_contrat = ?
                WHERE id = ?`,
          args: [
            employee.service,
            employee.poste,
            employee.type_contrat,
            employee.date_debut_contrat || null,
            employee.date_fin_contrat || null,
            userId
          ]
        });

        console.log(`🔄 Agent mis à jour: ${employee.prenom} ${employee.nom} - ${employee.poste}`);
        updatedCount++;
      }
    }

    console.log('\n✨ Importation terminée!');
    console.log(`📊 Statistiques:`);
    console.log(`   - ${addedCount} agent(s) ajouté(s)`);
    console.log(`   - ${updatedCount} agent(s) mis à jour`);
    console.log(`   - ${skippedCount} agent(s) ignoré(s)`);
    console.log(`   - Total: ${employees.length} agents dans la base`);
    console.log(`\n📝 Mot de passe par défaut: ${tempPassword}`);
    console.log(`   Les utilisateurs devront changer leur mot de passe lors de la première connexion.\n`);

    // Afficher un résumé par service
    console.log('📋 Résumé par service:');
    const serviceStats = {};
    employees.forEach(emp => {
      serviceStats[emp.service] = (serviceStats[emp.service] || 0) + 1;
    });
    Object.entries(serviceStats).forEach(([service, count]) => {
      console.log(`   - ${service}: ${count} agent(s)`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'importation:', error);
    process.exit(1);
  }
};

importAllEmployees();
