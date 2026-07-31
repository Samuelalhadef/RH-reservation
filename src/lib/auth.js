import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET;

// Ne jamais démarrer avec un secret par défaut : un secret connu permettrait
// à n'importe qui de forger des tokens valides et d'usurper un compte RH.
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET manquant ou trop court (>= 32 caractères requis). ' +
    'Définissez une valeur aléatoire forte dans les variables d\'environnement.'
  );
}

/**
 * Génère un token JWT
 */
export function generateToken(userId, type) {
  return jwt.sign(
    { userId, type },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Vérifie et décode un token JWT
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Récupère l'utilisateur depuis le token dans les cookies
 */
export async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return null;
    }

    const decoded = verifyToken(token);
    return decoded;
  } catch (error) {
    console.error('Error getting user from token:', error);
    return null;
  }
}

/**
 * Vérifie si l'utilisateur est authentifié
 */
export async function requireAuth() {
  const user = await getUserFromToken();
  if (!user) {
    return { authenticated: false, user: null };
  }
  return { authenticated: true, user };
}

/**
 * Vérifie si l'utilisateur est RH
 */
export async function requireRH() {
  const { authenticated, user } = await requireAuth();
  if (!authenticated || (user.type !== 'RH' && user.type !== 'Direction' && user.type !== 'DG')) {
    return { authorized: false, user: null };
  }
  return { authorized: true, user };
}

/**
 * Indique si un type d'utilisateur a les droits RH/Direction/DG.
 */
export function isRHType(type) {
  return type === 'RH' || type === 'Direction' || type === 'DG';
}

/**
 * Authentifie une requête à partir du cookie qu'elle porte (pour les routes
 * qui n'utilisent pas le helper basé sur next/headers cookies()).
 * @returns {{authenticated: boolean, user: object|null}}
 */
/**
 * Génère un mot de passe temporaire aléatoire (fort, lisible).
 * Remplace l'ancien mot de passe fixe « Chartrettes » identique pour tous,
 * qui permettait de se connecter à tout compte fraîchement créé/réinitialisé.
 */
export function generateTempPassword() {
  // Évite les caractères ambigus (0/O, 1/l/I) pour une saisie manuelle fiable.
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  let pwd = '';
  for (let i = 0; i < 12; i++) {
    pwd += charset[bytes[i] % charset.length];
  }
  // Garantit au moins un chiffre et une majuscule.
  return 'M' + pwd + '7';
}

export function getUserFromRequest(request) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return { authenticated: false, user: null };
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return { authenticated: false, user: null };
  }
  return { authenticated: true, user: decoded };
}
