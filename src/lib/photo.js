/**
 * Photos de profil : stockées en base64 (data URL) dans users.photo_profil,
 * mais JAMAIS renvoyées telles quelles dans les réponses JSON (une photo pèse
 * souvent 1 à 2 Mo : /api/users/profile et l'organigramme devenaient énormes).
 *
 * Les API renvoient à la place une URL courte vers /api/users/:id/photo,
 * versionnée par la taille + la fin du contenu : le navigateur garde l'image
 * en cache et la recharge seulement quand la photo change.
 *
 * @param {string} alias - alias SQL de la table users (ex. 'u')
 * @returns {string} expression SQL produisant `photo_profil` (URL ou NULL)
 */
export function photoUrlSql(alias = 'u') {
  return `CASE WHEN ${alias}.photo_profil IS NOT NULL AND ${alias}.photo_profil != ''
    THEN '/api/users/' || ${alias}.id || '/photo?v=' || length(${alias}.photo_profil) || '-' || hex(substr(${alias}.photo_profil, -6))
  END AS photo_profil`;
}
