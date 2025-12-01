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
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    nom: '',
    prenom: '',
    email: '',
    type_utilisateur: 'Employé',
    type_contrat: 'CDI',
    date_debut_contrat: '',
    date_fin_contrat: ''
  });
  const [editingUser, setEditingUser] = useState(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);

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
        setPendingLeaves(data.leaves || []);
      } else if (activeTab === 'all') {
        const response = await fetch('/api/leaves');
        const data = await response.json();
        setAllLeaves(data.leaves || []);
      } else if (activeTab === 'users') {
        const response = await fetch('/api/users/all');
        const data = await response.json();
        console.log('Users data:', data);
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
      // Initialiser avec des tableaux vides en cas d'erreur
      if (activeTab === 'pending') setPendingLeaves([]);
      if (activeTab === 'all') setAllLeaves([]);
      if (activeTab === 'users') setUsers([]);
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

  const handleCreateUser = async (e) => {
    e.preventDefault();

    if (!newUser.nom || !newUser.prenom || !newUser.email) {
      toast.error('Tous les champs sont requis');
      return;
    }

    if (newUser.type_contrat === 'CDD' && (!newUser.date_debut_contrat || !newUser.date_fin_contrat)) {
      toast.error('Les dates de début et fin sont requises pour un CDD');
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      toast.success(`Utilisateur créé avec succès ! Mot de passe temporaire: ${data.tempPassword}`, { duration: 8000 });
      setShowCreateUserModal(false);
      setNewUser({ nom: '', prenom: '', email: '', type_utilisateur: 'Employé', type_contrat: 'CDI', date_debut_contrat: '', date_fin_contrat: '' });
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();

    if (!editingUser.nom || !editingUser.prenom || !editingUser.email) {
      toast.error('Tous les champs sont requis');
      return;
    }

    if (editingUser.type_contrat === 'CDD' && (!editingUser.date_debut_contrat || !editingUser.date_fin_contrat)) {
      toast.error('Les dates de début et fin sont requises pour un CDD');
      return;
    }

    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      toast.success('Utilisateur modifié avec succès');
      setShowEditUserModal(false);
      setEditingUser(null);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${userName} ? Cette action est irréversible et supprimera également toutes ses demandes de congés.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      toast.success('Utilisateur supprimé avec succès');
      fetchData();
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                Gestion des utilisateurs
              </h2>
              <button
                onClick={() => setShowCreateUserModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Créer un utilisateur
              </button>
            </div>

            {users && users.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Aucun utilisateur trouvé
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contrat</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jours restants</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users && users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          {user.prenom} {user.nom}
                        </td>
                        <td className="px-4 py-3 text-sm">{user.email}</td>
                        <td className="px-4 py-3 text-sm">{user.type_utilisateur}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            user.type_contrat === 'CDD' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {user.type_contrat || 'CDI'}
                          </span>
                          {user.type_contrat === 'CDD' && user.date_fin_contrat && (
                            <div className="text-xs text-gray-500 mt-1">
                              Fin: {new Date(user.date_fin_contrat).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold">{user.jours_restants || 0}</span> / {user.jours_acquis || 0}
                          {user.type_contrat === 'CDD' && (
                            <div className="text-xs text-gray-500 mt-1">
                              (2,08 j/mois)
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setShowEditUserModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                              title="Modifier"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleResetPassword(user.id)}
                              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                              title="Réinitialiser le mot de passe"
                            >
                              MDP
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, `${user.prenom} ${user.nom}`)}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                              title="Supprimer"
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de création d'utilisateur */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Créer un nouvel utilisateur
            </h3>

            <form onSubmit={handleCreateUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  value={newUser.nom}
                  onChange={(e) => setNewUser({ ...newUser, nom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prénom *
                </label>
                <input
                  type="text"
                  value={newUser.prenom}
                  onChange={(e) => setNewUser({ ...newUser, prenom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type d'utilisateur *
                </label>
                <select
                  value={newUser.type_utilisateur}
                  onChange={(e) => setNewUser({ ...newUser, type_utilisateur: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Employé">Employé</option>
                  <option value="RH">RH</option>
                  <option value="DG">DG</option>
                  <option value="Service Technique">Service Technique</option>
                  <option value="Alternant">Alternant</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de contrat *
                </label>
                <select
                  value={newUser.type_contrat}
                  onChange={(e) => setNewUser({ ...newUser, type_contrat: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                </select>
              </div>

              {newUser.type_contrat === 'CDD' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de début du contrat *
                    </label>
                    <input
                      type="date"
                      value={newUser.date_debut_contrat}
                      onChange={(e) => setNewUser({ ...newUser, date_debut_contrat: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de fin du contrat *
                    </label>
                    <input
                      type="date"
                      value={newUser.date_fin_contrat}
                      onChange={(e) => setNewUser({ ...newUser, date_fin_contrat: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateUserModal(false);
                    setNewUser({ nom: '', prenom: '', email: '', type_utilisateur: 'Employé', type_contrat: 'CDI', date_debut_contrat: '', date_fin_contrat: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de modification d'utilisateur */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Modifier l'utilisateur
            </h3>

            <form onSubmit={handleEditUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  value={editingUser.nom}
                  onChange={(e) => setEditingUser({ ...editingUser, nom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prénom *
                </label>
                <input
                  type="text"
                  value={editingUser.prenom}
                  onChange={(e) => setEditingUser({ ...editingUser, prenom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type d'utilisateur *
                </label>
                <select
                  value={editingUser.type_utilisateur}
                  onChange={(e) => setEditingUser({ ...editingUser, type_utilisateur: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Employé">Employé</option>
                  <option value="RH">RH</option>
                  <option value="DG">DG</option>
                  <option value="Service Technique">Service Technique</option>
                  <option value="Alternant">Alternant</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de contrat *
                </label>
                <select
                  value={editingUser.type_contrat || 'CDI'}
                  onChange={(e) => setEditingUser({ ...editingUser, type_contrat: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                </select>
              </div>

              {editingUser.type_contrat === 'CDD' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de début du contrat *
                    </label>
                    <input
                      type="date"
                      value={editingUser.date_debut_contrat || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, date_debut_contrat: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de fin du contrat *
                    </label>
                    <input
                      type="date"
                      value={editingUser.date_fin_contrat || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, date_fin_contrat: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </>
              )}

              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingUser.actif !== 0}
                    onChange={(e) => setEditingUser({ ...editingUser, actif: e.target.checked ? 1 : 0 })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Utilisateur actif</span>
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Modifier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
