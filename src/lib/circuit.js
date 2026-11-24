/**
 * Calcul du parcours de validation — logique PURE (aucun accès base),
 * partagée entre le serveur (src/lib/hierarchy.js) et l'aperçu en direct
 * de l'interface d'administration de la hiérarchie (/rh/hierarchie).
 *
 * Règles :
 *  - on remonte la chaîne des responsables (users.responsable_id) ;
 *  - un responsable RH / Direction / DG arrête la remontée : c'est la validation finale ;
 *  - un responsable inactif est sauté ;
 *  - un responsable rangé dans un échelon dont « valide » est désactivé est sauté
 *    (il reste dans la hiérarchie mais ne fait plus partie du parcours) ;
 *  - un responsable sans échelon valide (comportement historique) ;
 *  - le nombre d'étapes intermédiaires n'est pas limité ; la RH est toujours la dernière.
 */

export const RH_TYPES = ['RH', 'Direction', 'DG'];

export function isRHType(type) {
  return RH_TYPES.includes(type);
}

/**
 * Construit le contexte de calcul à partir de listes brutes.
 * @param {Array} users - { id, nom, prenom, type_utilisateur, responsable_id, echelon_id, actif, ... }
 * @param {Array} echelons - { id, nom, ordre, valide }
 */
export function buildHierarchyContext(users, echelons = []) {
  const usersMap = new Map();
  for (const u of users) {
    usersMap.set(Number(u.id), {
      ...u,
      id: Number(u.id),
      responsable_id: u.responsable_id == null || u.responsable_id === '' ? null : Number(u.responsable_id),
      echelon_id: u.echelon_id == null || u.echelon_id === '' ? null : u.echelon_id,
      actif: u.actif === undefined || u.actif === null ? 1 : Number(u.actif),
    });
  }
  const echelonsMap = new Map();
  for (const e of echelons) {
    echelonsMap.set(e.id, { ...e, valide: e.valide === undefined ? true : Boolean(Number(e.valide)) });
  }
  return { users: usersMap, echelons: echelonsMap };
}

/**
 * Circuit de validation d'un agent.
 * @returns {{ niveaux: Array, requiresRH: true }} — la dernière entrée est toujours { type: 'rh', isFinal: true }
 */
export function computeCircuit(userId, ctx) {
  const user = ctx.users.get(Number(userId));
  if (!user) throw new Error('Utilisateur non trouvé');

  const niveaux = [];
  const seen = new Set([user.id]);
  let currentId = user.responsable_id;

  while (currentId != null && !seen.has(currentId)) {
    seen.add(currentId);
    const resp = ctx.users.get(currentId);
    if (!resp) break;
    if (isRHType(resp.type_utilisateur)) break; // la RH/DGS valide en dernier

    const echelon = resp.echelon_id != null ? ctx.echelons.get(resp.echelon_id) : null;
    const participe = resp.actif !== 0 && (!echelon || echelon.valide);

    if (participe) {
      niveaux.push({
        niveau: niveaux.length + 1,
        validateur_id: resp.id,
        validateur_nom: resp.nom,
        validateur_prenom: resp.prenom,
        echelon_id: echelon ? echelon.id : null,
        echelon_nom: echelon ? echelon.nom : null,
        type: niveaux.length === 0 ? 'responsable_direct' : 'responsable_hierarchique',
      });
    }
    currentId = resp.responsable_id;
  }

  niveaux.push({ niveau: niveaux.length + 1, type: 'rh', isFinal: true });
  return { niveaux, requiresRH: true };
}

/** Étapes intermédiaires (hors RH) du circuit d'un agent. */
export function computeIntermediateSteps(userId, ctx) {
  return computeCircuit(userId, ctx).niveaux.filter((n) => n.type !== 'rh');
}

/**
 * Vrai si `ancestorId` se trouve au-dessus de `userId` dans la chaîne des responsables.
 * Sert à empêcher les boucles (A responsable de B responsable de A).
 */
export function isAncestor(ancestorId, userId, ctx) {
  const seen = new Set();
  let current = ctx.users.get(Number(userId))?.responsable_id ?? null;
  while (current != null && !seen.has(current)) {
    if (current === Number(ancestorId)) return true;
    seen.add(current);
    current = ctx.users.get(current)?.responsable_id ?? null;
  }
  return false;
}
