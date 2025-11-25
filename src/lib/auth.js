import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
    const token = cookieStore.get('token')?.value;

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
  if (!authenticated || user.type !== 'RH') {
    return { authorized: false, user: null };
  }
  return { authorized: true, user };
}
