'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    } else {
      fetchUsers();
    }
  }, [isAuthenticated, router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/auth/users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des utilisateurs');
      setUsers([]);
    }
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setPassword('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(selectedUser.id, password);
      router.push('/dashboard');
    } catch (error) {
      // Error is handled in AuthContext
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full overflow-hidden">
        <div className="bg-primary-600 text-white p-6">
          <div className="flex items-center justify-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-white shadow">
              <img src="/images/logo.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center">Mon Portail Agent</h1>
          <p className="text-center text-primary-100 mt-1">Chartrettes</p>
        </div>

        <div className="p-8">
          {!selectedUser ? (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Sélectionnez votre nom
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition text-left"
                  >
                    <p className="font-semibold text-gray-800">
                      {user.prenom} {user.nom}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-primary-600 hover:text-primary-700 mb-4 flex items-center gap-2"
              >
                ← Retour à la liste
              </button>

              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Connexion
              </h2>
              <p className="text-gray-600 mb-6">
                Bienvenue {selectedUser.prenom} {selectedUser.nom}
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Entrez votre mot de passe"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition font-semibold"
                >
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
