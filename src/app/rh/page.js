'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import AdvancedStatsRH from '@/components/AdvancedStatsRH';
import { formatDateFR, formatStatus, getStatusColor } from '@/lib/clientDateUtils';
import toast from 'react-hot-toast';

export default function RHPage() {
  const { isRH, isAuthenticated } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [allLeaves, setAllLeaves] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    nom: '',
    prenom: '',
    email: '',
    type_utilisateur: 'Employé',
    service: '',
    poste: '',
    type_contrat: 'CDI',
    date_debut_contrat: '',
    date_fin_contrat: ''
  });
  const [editingUser, setEditingUser] = useState(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [rhLeaveForm, setRhLeaveForm] = useState({
    user_id: '',
    date_debut: '',
    date_fin: '',
    motif: ''
  });
  const [rhLeaveLoading, setRhLeaveLoading] = useState(false);

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
    if (activeTab === 'stats') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'all') {
        const response = await fetch('/api/leaves');
        const data = await response.json();
        setAllLeaves(data.leaves || []);
      } else if (activeTab === 'users') {
        const response = await fetch('/api/users/all');
        const data = await response.json();
        console.log('Users data:', data);
        setUsers(data.users || []);
      } else if (activeTab === 'create-leave') {
        const response = await fetch('/api/users/all');
        const data = await response.json();
        setAllUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
      if (activeTab === 'all') setAllLeaves([]);
      if (activeTab === 'users') setUsers([]);
      if (activeTab === 'create-leave') setAllUsers([]);
    } finally {
      setLoading(false);
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
      setNewUser({ nom: '', prenom: '', email: '', type_utilisateur: 'Employé', service: '', poste: '', type_contrat: 'CDI', date_debut_contrat: '', date_fin_contrat: '' });
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
          <div className="flex border-b overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'all'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Toutes les demandes
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'stats'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📊 Statistiques avancées
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'users'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Gestion des utilisateurs
            </button>

            <button
              onClick={() => setActiveTab('create-leave')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'create-leave'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Créer un congé
            </button>
          </div>
        </div>

        {activeTab === 'stats' && (
          <div>
            <AdvancedStatsRH />
          </div>
        )}

        {activeTab === 'all' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Toutes les demandes - Suivi de validation
            </h2>

            {/* Légende */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">Légende du circuit de validation :</p>
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <span className="text-gray-600">En attente</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <span className="text-gray-600">Bloqué ici</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Validé</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600">Refusé</span>
                </div>
              </div>
            </div>

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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Circuit de validation</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut final</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date demande</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {allLeaves.map((leave) => {
                      // Déterminer où en est la validation
                      const hasN1 = leave.responsable_id != null;
                      const hasN2 = leave.responsable_n2_nom != null;

                      const n1Validated = leave.statut_niveau_1 === 'validee';
                      const n2Validated = leave.statut_niveau_2 === 'validee';
                      const isFinalValidated = leave.statut === 'validee';
                      const isRefused = leave.statut === 'refusee';

                      // Où est-ce que ça bloque ?
                      let blockingAt = null;
                      if (!isRefused && !isFinalValidated) {
                        if (hasN1 && !n1Validated) {
                          blockingAt = 'n1';
                        } else if (hasN2 && !n2Validated) {
                          blockingAt = 'n2';
                        } else {
                          blockingAt = 'rh';
                        }
                      }

                      return (
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
                            <div className="flex items-center gap-2">
                              {/* Niveau 1 - Responsable direct */}
                              {hasN1 && (
                                <div className="flex flex-col items-center">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                      isRefused && !n1Validated ? 'bg-red-500' :
                                      n1Validated ? 'bg-green-500' :
                                      blockingAt === 'n1' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-300'
                                    }`}
                                    title={`N1: ${leave.responsable_prenom} ${leave.responsable_nom}`}
                                  >
                                    N1
                                  </div>
                                  <span className="text-xs text-gray-500 mt-1 max-w-[60px] truncate" title={`${leave.responsable_prenom} ${leave.responsable_nom}`}>
                                    {leave.responsable_prenom?.charAt(0)}. {leave.responsable_nom}
                                  </span>
                                  {n1Validated && leave.validateur_n1_nom && (
                                    <span className="text-xs text-green-600">✓</span>
                                  )}
                                </div>
                              )}

                              {hasN1 && (
                                <div className={`w-6 h-0.5 ${n1Validated ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                              )}

                              {/* Niveau 2 - Responsable hiérarchique */}
                              {hasN2 && (
                                <>
                                  <div className="flex flex-col items-center">
                                    <div
                                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                        isRefused && n1Validated && !n2Validated ? 'bg-red-500' :
                                        n2Validated ? 'bg-green-500' :
                                        blockingAt === 'n2' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-300'
                                      }`}
                                      title={`N2: ${leave.responsable_n2_prenom} ${leave.responsable_n2_nom}`}
                                    >
                                      N2
                                    </div>
                                    <span className="text-xs text-gray-500 mt-1 max-w-[60px] truncate" title={`${leave.responsable_n2_prenom} ${leave.responsable_n2_nom}`}>
                                      {leave.responsable_n2_prenom?.charAt(0)}. {leave.responsable_n2_nom}
                                    </span>
                                    {n2Validated && leave.validateur_n2_nom && (
                                      <span className="text-xs text-green-600">✓</span>
                                    )}
                                  </div>
                                  <div className={`w-6 h-0.5 ${n2Validated ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                </>
                              )}

                              {/* RH - Validation finale */}
                              <div className="flex flex-col items-center">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                    isRefused && ((!hasN1) || (hasN1 && n1Validated && (!hasN2 || n2Validated))) ? 'bg-red-500' :
                                    isFinalValidated ? 'bg-green-500' :
                                    blockingAt === 'rh' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-300'
                                  }`}
                                  title="Validation RH"
                                >
                                  RH
                                </div>
                                <span className="text-xs text-gray-500 mt-1">Final</span>
                                {isFinalValidated && leave.validateur_nom && (
                                  <span className="text-xs text-green-600">✓</span>
                                )}
                              </div>
                            </div>

                            {/* Info sur le blocage */}
                            {blockingAt && (
                              <p className="text-xs text-yellow-600 mt-2 font-medium">
                                ⏳ En attente : {
                                  blockingAt === 'n1' ? `${leave.responsable_prenom} ${leave.responsable_nom}` :
                                  blockingAt === 'n2' ? `${leave.responsable_n2_prenom} ${leave.responsable_n2_nom}` :
                                  'Validation RH'
                                }
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(leave.statut)}`}>
                              {formatStatus(leave.statut)}
                            </span>
                            {leave.validateur_nom && leave.statut !== 'en_attente' && (
                              <p className="text-xs text-gray-500 mt-1">
                                par {leave.validateur_prenom} {leave.validateur_nom}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDateFR(leave.date_demande)}
                          </td>
                        </tr>
                      );
                    })}
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Poste</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
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
                        <td className="px-4 py-3 text-sm">
                          <span className="font-medium text-gray-900">{user.poste || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="text-gray-600">{user.service || '-'}</span>
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

        {activeTab === 'create-leave' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Créer un congé (validation directe)
            </h2>

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Ce formulaire permet de créer un congé directement validé, sans passer par le circuit de validation
                et sans la contrainte des 7 jours à l'avance.
              </p>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!rhLeaveForm.user_id || !rhLeaveForm.date_debut || !rhLeaveForm.date_fin) {
                toast.error('Veuillez remplir tous les champs obligatoires');
                return;
              }
              if (new Date(rhLeaveForm.date_debut) > new Date(rhLeaveForm.date_fin)) {
                toast.error('La date de début doit être avant la date de fin');
                return;
              }
              setRhLeaveLoading(true);
              try {
                const response = await fetch('/api/leaves/rh-create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(rhLeaveForm),
                });
                const data = await response.json();
                if (!response.ok) {
                  throw new Error(data.message);
                }
                toast.success(`Congé créé et validé avec succès (${data.businessDays} jour(s) ouvrés)`);
                setRhLeaveForm({ user_id: '', date_debut: '', date_fin: '', motif: '' });
              } catch (error) {
                toast.error(error.message);
              } finally {
                setRhLeaveLoading(false);
              }
            }} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employé *
                </label>
                <select
                  value={rhLeaveForm.user_id}
                  onChange={(e) => setRhLeaveForm({ ...rhLeaveForm, user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Sélectionner un employé</option>
                  {allUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.prenom} {user.nom} ({user.type_utilisateur}) - {user.jours_restants || 0} jours restants
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    value={rhLeaveForm.date_debut}
                    onChange={(e) => setRhLeaveForm({ ...rhLeaveForm, date_debut: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de fin *
                  </label>
                  <input
                    type="date"
                    value={rhLeaveForm.date_fin}
                    onChange={(e) => setRhLeaveForm({ ...rhLeaveForm, date_fin: e.target.value })}
                    min={rhLeaveForm.date_debut}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motif (optionnel)
                </label>
                <textarea
                  value={rhLeaveForm.motif}
                  onChange={(e) => setRhLeaveForm({ ...rhLeaveForm, motif: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Motif du congé..."
                />
              </div>

              <button
                type="submit"
                disabled={rhLeaveLoading}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
              >
                {rhLeaveLoading ? 'Création en cours...' : 'Créer et valider le congé'}
              </button>
            </form>
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
                  Service
                </label>
                <input
                  type="text"
                  value={newUser.service}
                  onChange={(e) => setNewUser({ ...newUser, service: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: ADMIN. GÉNÉRALE, C.L.S.H., SERVICES TECH."
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Poste
                </label>
                <input
                  type="text"
                  value={newUser.poste}
                  onChange={(e) => setNewUser({ ...newUser, poste: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Resp. RH, Agent technique, DGS"
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
                  <option value="Direction">Direction</option>
                  <option value="RH">RH</option>
                  <option value="Responsable">Responsable</option>
                  <option value="Administratif">Administratif</option>
                  <option value="Service Technique">Service Technique</option>
                  <option value="Animateur">Animateur</option>
                  <option value="ATSEM/Animation">ATSEM/Animation</option>
                  <option value="Police Municipale">Police Municipale</option>
                  <option value="Entretien">Entretien</option>
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
                    setNewUser({ nom: '', prenom: '', email: '', type_utilisateur: 'Employé', service: '', poste: '', type_contrat: 'CDI', date_debut_contrat: '', date_fin_contrat: '' });
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
                  Service
                </label>
                <input
                  type="text"
                  value={editingUser.service || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, service: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: ADMIN. GÉNÉRALE, C.L.S.H., SERVICES TECH."
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Poste
                </label>
                <input
                  type="text"
                  value={editingUser.poste || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, poste: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Resp. RH, Agent technique, DGS"
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
                  <option value="Direction">Direction</option>
                  <option value="RH">RH</option>
                  <option value="Responsable">Responsable</option>
                  <option value="Administratif">Administratif</option>
                  <option value="Service Technique">Service Technique</option>
                  <option value="Animateur">Animateur</option>
                  <option value="ATSEM/Animation">ATSEM/Animation</option>
                  <option value="Police Municipale">Police Municipale</option>
                  <option value="Entretien">Entretien</option>
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
