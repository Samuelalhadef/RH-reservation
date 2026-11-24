/**
 * Exécuté une seule fois au démarrage du serveur Next.js.
 *
 * On initialise la base (vérification du schéma + connexion Turso) et on
 * précharge la liste des comptes AVANT la première visite : sans ça, le premier
 * agent qui ouvre l'écran de connexion après un redémarrage attendait que tout
 * ce travail soit fait.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Pas d'await : le serveur commence à répondre sans attendre le préchauffage.
  import('@/lib/loginUsers')
    .then(({ getLoginUsers }) => getLoginUsers())
    .catch((err) => console.error('Préchauffage base de données échoué :', err));
}
