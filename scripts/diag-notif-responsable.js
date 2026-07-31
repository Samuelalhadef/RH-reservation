import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  // Tous les agents actifs avec leur responsable et l'état push du responsable
  const res = await db.execute(`
    SELECT u.id, u.prenom, u.nom, u.type_utilisateur, u.actif,
           u.responsable_id,
           r.prenom AS resp_prenom, r.nom AS resp_nom, r.type_utilisateur AS resp_type,
           (SELECT COUNT(*) FROM push_subscriptions ps WHERE ps.user_id = u.responsable_id) AS resp_push,
           (SELECT COUNT(*) FROM push_subscriptions ps WHERE ps.user_id = u.id) AS self_push
    FROM users u
    LEFT JOIN users r ON u.responsable_id = r.id
    WHERE u.actif = 1
    ORDER BY u.nom, u.prenom
  `);

  console.log(`\n${res.rows.length} agents actifs\n`);
  console.log('AGENT'.padEnd(28), 'RESP_ID', 'RESPONSABLE'.padEnd(24), 'RESP_PUSH', 'SELF_PUSH');
  console.log('-'.repeat(95));

  let sansResp = 0, respSansPush = 0;
  for (const u of res.rows) {
    const agent = `${u.prenom} ${u.nom}`.padEnd(28);
    const resp = u.responsable_id
      ? `${u.resp_prenom} ${u.resp_nom} (${u.resp_type})`.padEnd(24)
      : '--- AUCUN ---'.padEnd(24);
    const respId = String(u.responsable_id ?? '∅').padEnd(7);
    console.log(agent, respId, resp, String(u.resp_push).padStart(6), String(u.self_push).padStart(8));

    if (!u.responsable_id) sansResp++;
    else if (u.resp_push === 0) respSansPush++;
  }

  console.log('\n=== RÉSUMÉ ===');
  console.log(`Agents SANS responsable_id (notif part vers RH, pas vers un responsable): ${sansResp}`);
  console.log(`Agents AVEC responsable mais dont le responsable n'a AUCUN abonnement push: ${respSansPush}`);
  console.log(`=> Ces deux cas expliquent qu'un responsable ne reçoive pas de push.`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
