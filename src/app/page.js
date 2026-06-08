'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [search, setSearch] = useState('');
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
      // Error handled in AuthContext
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = search.trim()
    ? users.filter(u =>
        `${u.prenom} ${u.nom}`.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden flex items-center justify-center p-4">
      {/* Décorations floues */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 -right-20 w-[28rem] h-[28rem] bg-indigo-500/20 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl"></div>

      <div className="relative w-full max-w-5xl">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl ring-1 ring-white/20 overflow-hidden">
          {/* Hero */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white p-6 sm:p-8">
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-16 -left-12 w-72 h-72 bg-indigo-300/20 rounded-full blur-3xl"></div>

            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-white shadow-xl ring-4 ring-white/20 flex-shrink-0">
                <Image
                  src="/images/logo.png"
                  alt="Logo"
                  width={64}
                  height={64}
                  priority
                  sizes="64px"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-[11px] font-medium uppercase tracking-wider mb-1.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                  Mairie de Chartrettes
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mon Portail Agent</h1>
                <p className="text-white/80 text-sm mt-0.5">Gestion des congés et récupérations</p>
              </div>
            </div>
          </div>

          {/* Corps */}
          <div className="p-6 sm:p-8">
            {!selectedUser ? (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Sélectionnez votre nom</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{users.length} agent{users.length > 1 ? 's' : ''} référencé{users.length > 1 ? 's' : ''}</p>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher votre nom…"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[400px] overflow-y-auto pr-1">
                  {filteredUsers.length === 0 ? (
                    <p className="col-span-full text-center text-sm text-gray-400 py-10">Aucun agent trouvé</p>
                  ) : (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleUserSelect(user)}
                        className="group flex items-center gap-3 p-3.5 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 ring-2 ring-white shadow-sm">
                          {user.prenom?.[0]}{user.nom?.[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 text-sm truncate">{user.prenom} {user.nom}</p>
                          <p className="text-xs text-gray-500 truncate">{user.type_utilisateur || 'Agent'}</p>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium mb-5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Retour à la liste
                </button>

                <div className="flex items-center gap-4 mb-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg ring-4 ring-white shadow-md">
                    {selectedUser.prenom?.[0]}{selectedUser.nom?.[0]}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-blue-700 font-semibold">Bienvenue</p>
                    <h2 className="text-xl font-bold text-gray-900">{selectedUser.prenom} {selectedUser.nom}</h2>
                    {selectedUser.type_utilisateur && (
                      <p className="text-xs text-gray-500">{selectedUser.type_utilisateur}</p>
                    )}
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                    <div className="relative">
                      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        placeholder="Entrez votre mot de passe"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {loading ? (
                      'Connexion...'
                    ) : (
                      <>
                        Se connecter
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-white/60 text-xs mt-6">
          © {new Date().getFullYear()} Mairie de Chartrettes — Tous droits réservés
        </p>
        <div className="flex items-center justify-center gap-4 mt-2 text-white/50 text-xs">
          <a href="/confidentialite" className="hover:text-white/80 transition">Confidentialité</a>
          <span>·</span>
          <a href="/mentions-legales" className="hover:text-white/80 transition">Mentions légales</a>
        </div>
      </div>
    </div>
  );
}
