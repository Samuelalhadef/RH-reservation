'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { formatDateFR, formatStatus, getStatusColor } from '@/lib/clientDateUtils';
import toast from 'react-hot-toast';

export default function RHPage() {
  const { isRH, isAuthenticated } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [commentaire, setCommentaire] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else if (!isRH()) {
      router.push('/dashboard');
    } else {
      fetchData();
    }
  }, [activeTab, isAuthenticated, isRH, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pending') {
        const response = await fetch('/api/leaves?status=en_attente');
        const data = await response.json();
        setPendingLeaves(data.leaves);
      } else if (activeTab === 'all') {
        const response = await fetch('/api/leaves');
        const data = await response.json();
        setAllLeaves(data.leaves);
      } else if (activeTab === 'users') {
        const response = await fetch('/api/users/all');
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (leaveId, status) => {
    try {
      const response = await fetch(`/api/leaves/${leaveId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: status, commentaire_rh: commentaire }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      toast.success(`Demande ${status === 'validee' ? 'validée' : 'refusée'} avec succès`);
      setSelectedLeave(null);
      setCommentaire('');
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleResetPassword = async (userId) => {
    if (!window.confirm('Réinitialiser le mot de passe de cet utilisateur ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      toast.success('Mot de passe réinitialisé. Nouveau mot de passe: ' + data.tempPassword);
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Interface RH
        </h1>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'pending'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Demandes en attente
              {pendingLeaves.length > 0 && (
                <span className="ml-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs">
                  {pendingLeaves.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'all'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Toutes les demandes
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'users'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Gestion des utilisateurs
            </button>
          </div>
        </div>

        {activeTab === 'pending' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Demandes en attente de validation
            </h2>

            {pendingLeaves.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Aucune demande en attente
              </p>
            ) : (
              <div className="space-y-4">
                {pendingLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-lg text-gray-800">
                          {leave.prenom} {leave.nom}
                        </p>
                        <p className="text-sm text-gray-600">
                          {leave.type_utilisateur} • {leave.email}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                        En attente
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-500">Période</p>
                        <p className="font-medium">
                          {formatDateFR(leave.date_debut)} - {formatDateFR(leave.date_fin)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Jours ouvrés</p>
                        <p className="font-medium">{leave.nombre_jours_ouvres}</p>
                      </div>
                    </div>

                    {leave.motif && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500">Motif</p>
                        <p className="text-sm">{leave.motif}</p>
                      </div>
                    )}

                    <div className="mb-3">
                      <label className="block text-xs text-gray-500 mb-1">
                        Commentaire RH (optionnel)
                      </label>
                      <textarea
                        value={selectedLeave === leave.id ? commentaire : ''}
                        onChange={(e) => {
                          setSelectedLeave(leave.id);
                          setCommentaire(e.target.value);
                        }}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        placeholder="Ajouter un commentaire..."
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleValidate(leave.id, 'validee')}
                        className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition font-medium"
                      >
                        ✓ Valider
                      </button>
                      <button
                        onClick={() => handleValidate(leave.id, 'refusee')}
                        className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 transition font-medium"
                      >
                        ✗ Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'all' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Toutes les demandes
            </h2>

            {allLeaves.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Aucune demande
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jours</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date demande</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {allLeaves.map((leave) => (
                      <tr key={leave.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium">{leave.prenom} {leave.nom}</p>
                          <p className="text-xs text-gray-500">{leave.type_utilisateur}</p>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {formatDateFR(leave.date_debut)} - {formatDateFR(leave.date_fin)}
                        </td>
                        <td className="px-4 py-3">{leave.nombre_jours_ouvres}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(leave.statut)}`}>
                            {formatStatus(leave.statut)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDateFR(leave.date_demande)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Gestion des utilisateurs
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jours restants</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {user.prenom} {user.nom}
                      </td>
                      <td className="px-4 py-3 text-sm">{user.email}</td>
                      <td className="px-4 py-3 text-sm">{user.type_utilisateur}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">{user.jours_restants || 25}</span> / {user.jours_acquis || 25}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleResetPassword(user.id)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Réinitialiser mot de passe
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
