// Double de src/lib/auth.js : l'utilisateur courant est fixé par les tests via setCurrentUser()
export function setCurrentUser(u) { globalThis.__testUser = u || null; }
const current = () => globalThis.__testUser || null;

export function generateToken() { return 'test-token'; }
export function verifyToken() { return current(); }
export async function getUserFromToken() { return current(); }
export async function requireAuth() {
  const user = current();
  return user ? { authenticated: true, user } : { authenticated: false, user: null };
}
export function isRHType(type) { return type === 'RH' || type === 'Direction' || type === 'DG'; }
export async function requireRH() {
  const user = current();
  return user && isRHType(user.type) ? { authorized: true, user } : { authorized: false, user: null };
}
export function generateTempPassword() { return 'Temp-Pass-123'; }
export function getUserFromRequest() {
  const user = current();
  return user ? { authenticated: true, user } : { authenticated: false, user: null };
}
