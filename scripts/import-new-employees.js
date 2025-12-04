import { db } from '../src/lib/db.js';
import bcrypt from 'bcrypt';

const employees = [
  // ADMIN. GÉNÉRALE (Virginie DE MELO sera créée séparément comme compte RH)
  { service: 'ADMIN. GÉNÉRALE', nom: 'CRANTZ', prenom: 'Laura', poste: 'Resp. Urbanisme', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'ADMIN. GÉNÉRALE', nom: 'GONOD', prenom: 'Nadine', poste: 'Resp. Finances', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'ADMIN. GÉNÉRALE', nom: 'MIRGUET', prenom: 'Valérie', poste: 'Resp. Social', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'ADMIN. GÉNÉRALE', nom: 'NOYELLE', prenom: 'Claudine', poste: 'DGS', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'ADMIN. GÉNÉRALE', nom: 'ROUX', prenom: 'Ingrid', poste: 'Facturation', type_contrat: 'CDI', heures: '17h50', date_debut: null, date_fin: null },

  // C.L.S.H.
  { service: 'C.L.S.H.', nom: 'AMIM', prenom: 'Margarida', poste: 'Adj. Tech. Territ.', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'C.L.S.H.', nom: 'BACHELIN', prenom: 'Stéphanie', poste: 'Resp. adj. ACM', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'C.L.S.H.', nom: 'BISANTI', prenom: 'Géraldine', poste: 'Animatrice', type_contrat: 'CDI', heures: '30h00', date_debut: null, date_fin: null },
  { service: 'C.L.S.H.', nom: 'BLONDEL', prenom: 'Laura', poste: 'Adj. Anim. (ATSEM)', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'C.L.S.H.', nom: 'DI STEFANO', prenom: 'Carmen', poste: 'Dir. Vie Locale', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'C.L.S.H.', nom: 'KOUALOU MAKOSSO', prenom: 'Marie', poste: "Agent d'entretien", type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'C.L.S.H.', nom: 'MARQUES', prenom: 'Alexine', poste: 'Resp. Centre Loisirs', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'C.L.S.H.', nom: 'PELISSIER', prenom: 'Mathieu', poste: 'Animateur', type_contrat: 'CDD', heures: '30h00', date_debut: '2025-12-01', date_fin: '2026-05-31' },
  { service: 'C.L.S.H.', nom: 'EVENOU', prenom: 'Louna', poste: "Adj. d'animation", type_contrat: 'CDD', heures: '24h00', date_debut: '2025-12-01', date_fin: '2026-05-31' },
  { service: 'C.L.S.H.', nom: 'LIBERGE', prenom: 'Amandine', poste: 'Animatrice', type_contrat: 'CDD', heures: '30h00', date_debut: '2025-06-01', date_fin: '2026-05-31' },
  { service: 'C.L.S.H.', nom: 'MADO', prenom: 'Enora', poste: 'Animatrice', type_contrat: 'CDD', heures: '35h00', date_debut: '2025-03-01', date_fin: '2026-02-28' },
  { service: 'C.L.S.H.', nom: 'ROUX', prenom: 'Julie', poste: 'Adj. Anim. (ATSEM)', type_contrat: 'CDD', heures: '35h00', date_debut: '2025-03-01', date_fin: '2026-02-28' },

  // ÉCOLE ÉLÉM.
  { service: 'ÉCOLE ÉLÉM.', nom: 'CANTEIRO F.', prenom: 'Alvina', poste: 'Adj. Tech. Territ.', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'ÉCOLE ÉLÉM.', nom: 'FREGUIN', prenom: 'Peggy', poste: 'Adj. Tech. Territ.', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },

  // ÉCOLE MAT.
  { service: 'ÉCOLE MAT.', nom: 'DE ALMEIDA', prenom: 'Cécile', poste: 'Adj. Anim. (ATSEM)', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },

  // EMC
  { service: 'EMC', nom: 'CONIN', prenom: 'Guillaume', poste: 'Animateur Culturel', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },

  // RESTAURATION
  { service: 'RESTAURATION', nom: 'GOFFAUX', prenom: 'Stéphanie', poste: 'Responsable RMS', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },

  // SÉCURITÉ
  { service: 'SÉCURITÉ', nom: 'MESSMER', prenom: 'Frédéric', poste: 'Policier Municipal', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },

  // SERVICES TECH.
  { service: 'SERVICES TECH.', nom: 'FUZEAU', prenom: 'Franck', poste: 'Agent technique', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'SERVICES TECH.', nom: 'LEPINAY', prenom: 'Raphaël', poste: 'Chef éq. Esp. Verts', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'SERVICES TECH.', nom: 'LEROI', prenom: 'Dominique', poste: 'Resp. Services Tech', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'SERVICES TECH.', nom: 'RIVIERE', prenom: 'Jordan', poste: 'Agent technique', type_contrat: 'CDI', heures: '35h00', date_debut: null, date_fin: null },
  { service: 'SERVICES TECH.', nom: 'LESTOILLE', prenom: 'Damien', poste: 'Agent technique', type_contrat: 'CDD', heures: '35h00', date_debut: '2025-12-01', date_fin: '2026-02-28' },
  { service: 'SERVICES TECH.', nom: 'MALUMANDSOKO', prenom: 'Glodi', poste: 'Agent technique', type_contrat: 'CDD', heures: '35h00', date_debut: '2025-10-08', date_fin: '2026-01-31' },
  { service: 'SERVICES TECH.', nom: 'SARAIVA', prenom: 'Antoine', poste: 'Adjoint Technique', type_contrat: 'CDD', heures: '35h00', date_debut: '2025-05-01', date_fin: '2026-04-30' },
  { service: 'SERVICES TECH.', nom: 'TEYSSIER', prenom: 'Thomas', poste: 'Agent technique', type_contrat: 'CDD', heures: '35h00', date_debut: '2025-10-13', date_fin: '2026-01-31' }
];

function calculateCDDLeaveBalance(dateDebut, dateFin, annee) {
  if (!dateDebut || !dateFin) {
    return 0;
  }

  const debut = new Date(dateDebut);
  const fin = new Date(dateFin);
  const currentYear = annee || new Date().getFullYear();

  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31);

  const effectiveStart = debut > yearStart ? debut : yearStart;
  const effectiveEnd = fin < yearEnd ? fin : yearEnd;

  if (effectiveStart > yearEnd || effectiveEnd < yearStart) {
    return 0;
  }

  const diffInMs = effectiveEnd - effectiveStart + (1000 * 60 * 60 * 24);
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

  let monthsWorked;
  if (diffInDays >= 365) {
    monthsWorked = 12;
  } else {
    monthsWorked = diffInDays / 30.44;
  }

  let joursAcquis = monthsWorked * 2.08;

  if (joursAcquis > 25 || monthsWorked >= 12) {
    joursAcquis = 25;
  }

  return Math.round(joursAcquis * 100) / 100;
}

async function importEmployees() {
  try {
    console.log('🔄 Début de l\'importation des employés...\n');

    // 1. Supprimer toutes les anciennes données
    console.log('🗑️  Suppression des anciennes données...');
    await db.execute('DELETE FROM demandes_conges');
    await db.execute('DELETE FROM soldes_conges');
    await db.execute('DELETE FROM users');
    console.log('✅ Anciennes données supprimées\n');

    // 2. Créer un compte RH par défaut
    const hashedPassword = await bcrypt.hash('password123', 10);

    console.log('👤 Création du compte RH : Virginie DE MELO');
    await db.execute({
      sql: `
        INSERT INTO users (nom, prenom, email, mot_de_passe, type_utilisateur, actif, type_contrat, mot_de_passe_temporaire)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `,
      args: ['DE MELO', 'Virginie', 'virginie.demelo@chartrettes.fr', hashedPassword, 'RH', 1, 'CDI']
    });
    console.log('✅ Compte RH créé\n');

    // 3. Importer tous les employés
    const currentYear = new Date().getFullYear();
    let count = 0;

    for (const emp of employees) {
      count++;

      // Générer l'email
      const email = `${emp.prenom.toLowerCase()}.${emp.nom.toLowerCase().replace(/\s+/g, '')}@chartrettes.fr`;

      // Type d'utilisateur basé sur le poste
      let typeUtilisateur = 'Employé';
      if (emp.poste.includes('Resp.') || emp.poste.includes('Dir.') || emp.poste.includes('DGS')) {
        typeUtilisateur = 'DG';
      } else if (emp.poste.includes('RH')) {
        typeUtilisateur = 'RH';
      } else if (emp.service === 'SERVICES TECH.') {
        typeUtilisateur = 'Service Technique';
      }

      console.log(`${count}. Création de ${emp.prenom} ${emp.nom} (${emp.service}) - ${emp.type_contrat}`);

      // Insérer l'utilisateur
      const result = await db.execute({
        sql: `
          INSERT INTO users (nom, prenom, email, mot_de_passe, type_utilisateur, actif, type_contrat, date_debut_contrat, date_fin_contrat, mot_de_passe_temporaire)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `,
        args: [
          emp.nom,
          emp.prenom,
          email,
          hashedPassword,
          typeUtilisateur,
          1,
          emp.type_contrat,
          emp.date_debut,
          emp.date_fin
        ]
      });

      const userId = Number(result.lastInsertRowid);

      // Calculer les jours de congés
      let joursAcquis = 25; // CDI par défaut
      if (emp.type_contrat === 'CDD' && emp.date_debut && emp.date_fin) {
        joursAcquis = calculateCDDLeaveBalance(emp.date_debut, emp.date_fin, currentYear);
      }

      // Créer le solde de congés
      await db.execute({
        sql: `
          INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants, jours_reportes, jours_fractionnement)
          VALUES (?, ?, ?, 0, ?, 0, 0)
        `,
        args: [userId, currentYear, joursAcquis, joursAcquis]
      });

      console.log(`   ✅ ${joursAcquis} jours de congés acquis`);
    }

    console.log('\n═══════════════════════════════════════');
    console.log(`✅ ${count} employés importés avec succès !`);
    console.log('═══════════════════════════════════════\n');

    console.log('📋 Comptes créés :');
    console.log('   Email: virginie.demelo@chartrettes.fr');
    console.log('   Email: [prenom].[nom]@chartrettes.fr');
    console.log('   Mot de passe pour tous : password123');
    console.log('\n⚠️  N\'oubliez pas de changer les mots de passe !');

  } catch (error) {
    console.error('❌ Erreur lors de l\'importation :', error);
    console.error(error);
    process.exit(1);
  }
}

importEmployees().then(() => process.exit(0));
