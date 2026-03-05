import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { db } from '../src/lib/db.js';

const setupGuillaumeHierarchy = async () => {
  try {
    console.log('Configuration de la hierarchie pour Guillaume CONIN...\n');

    // Trouver Guillaume CONIN
    const guillaume = await db.execute("SELECT id, nom, prenom, type_utilisateur FROM users WHERE nom = 'CONIN' AND prenom = 'Guillaume'");
    if (guillaume.rows.length === 0) {
      console.error('Guillaume CONIN non trouve');
      process.exit(1);
    }
    const guillaumeId = guillaume.rows[0].id;
    console.log(`Guillaume CONIN (ID: ${guillaumeId}, type actuel: ${guillaume.rows[0].type_utilisateur})`);

    // Trouver Carmen DI STEFANO
    const carmen = await db.execute("SELECT id, nom, prenom, type_utilisateur, niveau_validation FROM users WHERE nom = 'DI STEFANO' AND prenom = 'Carmen'");
    if (carmen.rows.length === 0) {
      console.error('Carmen DI STEFANO non trouvee');
      process.exit(1);
    }
    const carmenId = carmen.rows[0].id;
    console.log(`Carmen DI STEFANO (ID: ${carmenId}, type actuel: ${carmen.rows[0].type_utilisateur})`);

    // Trouver la DGS (Directrice Generale des Services)
    const dgs = await db.execute("SELECT id, nom, prenom, type_utilisateur FROM users WHERE type_utilisateur IN ('Direction', 'DG') OR poste LIKE '%DGS%' OR poste LIKE '%Directr%'");
    if (dgs.rows.length === 0) {
      console.error('DGS non trouvee');
      process.exit(1);
    }
    const dgsId = dgs.rows[0].id;
    console.log(`DGS: ${dgs.rows[0].prenom} ${dgs.rows[0].nom} (ID: ${dgsId})`);

    // 1. Mettre a jour Guillaume : type = Animateur Culturel, responsable = Carmen
    await db.execute({
      sql: 'UPDATE users SET type_utilisateur = ?, responsable_id = ? WHERE id = ?',
      args: ['Animateur Culturel', carmenId, guillaumeId]
    });
    console.log('\nGuillaume CONIN -> Animateur Culturel (responsable: Carmen)');

    // 2. Mettre a jour Carmen : type = Responsable Vie Locale, niveau_validation = 1, responsable = DGS
    await db.execute({
      sql: 'UPDATE users SET type_utilisateur = ?, niveau_validation = 1, responsable_id = ? WHERE id = ?',
      args: ['Responsable Vie Locale', dgsId, carmenId]
    });
    console.log('Carmen DI STEFANO -> Responsable Vie Locale (niveau 1, responsable: DGS)');

    // 3. S'assurer que la DGS a le bon niveau de validation (niveau 2)
    await db.execute({
      sql: 'UPDATE users SET niveau_validation = CASE WHEN niveau_validation < 2 THEN 2 ELSE niveau_validation END WHERE id = ?',
      args: [dgsId]
    });
    console.log(`${dgs.rows[0].prenom} ${dgs.rows[0].nom} -> niveau_validation = 2`);

    // Afficher le circuit de validation
    console.log('\nCircuit de validation pour Guillaume:');
    console.log('  Guillaume CONIN (Animateur Culturel)');
    console.log('    -> Carmen DI STEFANO (Responsable Vie Locale) [Niveau 1]');
    console.log(`    -> ${dgs.rows[0].prenom} ${dgs.rows[0].nom} (DGS) [Niveau 2]`);
    console.log('    -> RH [Validation finale]');

    // Afficher le resume complet
    const summary = await db.execute(`
      SELECT
        u.nom, u.prenom, u.type_utilisateur, u.niveau_validation,
        r.nom as resp_nom, r.prenom as resp_prenom
      FROM users u
      LEFT JOIN users r ON u.responsable_id = r.id
      WHERE u.responsable_id IS NOT NULL OR u.niveau_validation > 0
      ORDER BY u.niveau_validation DESC, u.nom
    `);

    console.log('\nRecapitulatif complet de la hierarchie:\n');
    for (const row of summary.rows) {
      const niveau = row.niveau_validation > 0 ? ` [Niveau ${row.niveau_validation}]` : '';
      const responsable = row.resp_nom ? ` -> ${row.resp_prenom} ${row.resp_nom}` : '';
      console.log(`  ${row.prenom} ${row.nom} (${row.type_utilisateur})${niveau}${responsable}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Erreur:', error.message);
    process.exit(1);
  }
};

setupGuillaumeHierarchy();
