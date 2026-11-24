import LoginScreen from '@/components/LoginScreen';
import { getLoginUsers } from '@/lib/loginUsers';

// Rendu à chaque requête, mais la liste vient du cache mémoire serveur
// (src/lib/loginUsers.js) : la page arrive déjà remplie, sans requête API.
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  let initialUsers = null;
  try {
    initialUsers = await getLoginUsers();
  } catch (error) {
    console.error('Erreur chargement liste des comptes :', error);
  }
  return <LoginScreen initialUsers={initialUsers} />;
}
