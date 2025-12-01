import { useState, useEffect } from 'react';
import { userAPI, leaveAPI } from '../services/api';
import Navbar from '../components/Navbar';
import DashboardRH from '../components/DashboardRH';
import { formatDateFR, formatStatus, getStatusColor } from '../utils/dateUtils';
import toast from 'react-hot-toast';

const RHPage = () => {
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, pending, all, users
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUserForm, setShowUserForm] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [commentaire, setCommentaire] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    if (activeTab === 'dashboard') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'pending') {
        const response = await leaveAPI.getAllLeaves({ status: 'en_attente' });
        setPendingLeaves(response.data.leaves);
      } else if (activeTab === 'all') {
        const response = await leaveAPI.getAllLeaves();
        setAllLeaves(response.data.leaves);
      } else if (activeTab === 'users') {
        const response = await userAPI.getAllUsersWithBalances();
        setUsers(response.data.users);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (leaveId, status) => {
    try {
      await leaveAPI.updateLeaveStatus(leaveId, status, commentaire);
      toast.success(`Demande ${status === 'validee' ? 'validée' : 'refusée'} avec succès`);
      setSelectedLeave(null);
      setCommentaire('');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la validation');
    }
  };

  const handleResetPassword = async (userId) => {
    if (!window.confirm('Réinitialiser le mot de passe de cet utilisateur ?')) {
      return;
    }

    try {
      const response = await userAPI.resetPassword(userId);
      toast.success('Mot de passe réinitialisé. Nouveau mot de passe: ' + response.data.tempPassword);
    } catch (error) {
      toast.error('Erreur lors de la réinitialisation');
    }
  };

  const handleDeleteLeave = async (leaveId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette demande de congés ? Le solde de l\'employé sera restauré si la demande était validée.')) {
      return;
    }

    try {
      await leaveAPI.deleteLeaveRequestByRH(leaveId);
      toast.success('Demande supprimée avec succès');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Interface RH
        </h1>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📊 Tableau de bord
            </button>

            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
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
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'all'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Toutes les demandes
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
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <p className="text-center">Chargement...</p>
        ) : (
          <>
            {/* Tableau de bord */}
            {activeTab === 'dashboard' && (
              <DashboardRH />
            )}

            {/* Demandes en attente */}
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

            {/* Toutes les demandes */}
            {activeTab === 'all' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  Toutes les demandes
                </h2>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Employé
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Période
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Jours
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Statut
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Validateur
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
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
                            {leave.validateur_nom ? `${leave.validateur_prenom} ${leave.validateur_nom}` : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleDeleteLeave(leave.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                              title="Supprimer cette demande"
                            >
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Gestion des utilisateurs */}
            {activeTab === 'users' && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    Gestion des utilisateurs
                  </h2>
                  <button
                    onClick={() => setShowUserForm(true)}
                    className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
                  >
                    + Nouvel utilisateur
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Nom
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Solde
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Fractionnement
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Statut
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
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
                            <span className="text-green-600 font-semibold">
                              {user.jours_restants || 25}
                            </span>
                            <span className="text-gray-400 text-sm"> / {user.jours_acquis || 25}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${
                              user.jours_fractionnement > 0 ? 'text-purple-600' : 'text-gray-400'
                            }`}>
                              {user.jours_fractionnement || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${
                              user.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {user.actif ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleResetPassword(user.id)}
                              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                            >
                              Réinitialiser MDP
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Nouvel Utilisateur */}
      {showUserForm && <UserFormModal onClose={() => setShowUserForm(false)} onSuccess={fetchData} />}
    </div>
  );
};

// Modal pour créer un utilisateur
const UserFormModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    type_utilisateur: 'Employé',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await userAPI.createUser(formData);
      const message = response.data.tempPassword
        ? `Utilisateur créé avec succès. Mot de passe temporaire: ${response.data.tempPassword}`
        : 'Utilisateur créé avec succès';
      toast.success(message, { duration: 8000 });
      onSuccess();
      onClose();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Erreur lors de la création de l\'utilisateur';
      console.error('Erreur complète:', error);
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Nouvel utilisateur</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom
            </label>
            <input
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prénom
            </label>
            <input
              type="text"
              value={formData.prenom}
              onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={formData.type_utilisateur}
              onChange={(e) => setFormData({ ...formData, type_utilisateur: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option>Employé</option>
              <option>DG</option>
              <option>Service Technique</option>
              <option>Alternant</option>
              <option>RH</option>
            </select>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-600 text-white py-2 rounded hover:bg-primary-700"
            >
              Créer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RHPage;
