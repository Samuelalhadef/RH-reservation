import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { leaveAPI, userAPI } from '../services/api';
import Navbar from '../components/Navbar';
import ChangePasswordModal from '../components/ChangePasswordModal';
import LeaveRequestForm from '../components/LeaveRequestForm';
import LeaveCalendar from '../components/LeaveCalendar';
import { formatDateFR, formatStatus, getStatusColor } from '../utils/dateUtils';
import toast from 'react-hot-toast';

const DashboardPage = () => {
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [myLeaves, setMyLeaves] = useState([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    // Afficher la modal si mot de passe temporaire
    if (user?.requirePasswordChange) {
      setShowPasswordModal(true);
      toast.error('Vous devez changer votre mot de passe');
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [profileRes, leavesRes] = await Promise.all([
        userAPI.getProfile(),
        leaveAPI.getMyLeaves(),
      ]);

      setProfile(profileRes.data.user);
      setMyLeaves(leavesRes.data.leaves);
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveCreated = () => {
    fetchData();
    refreshProfile();
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
        {/* Alerte changement de mot de passe */}
        {user?.requirePasswordChange && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">⚠️ Changement de mot de passe requis</p>
            <p className="text-sm">
              Vous devez changer votre mot de passe temporaire.{' '}
              <button
                onClick={() => setShowPasswordModal(true)}
                className="underline font-semibold"
              >
                Cliquez ici
              </button>
            </p>
          </div>
        )}

        {/* Alerte jours de fractionnement */}
        {profile?.jours_fractionnement > 0 && (
          <div className="bg-purple-100 border border-purple-400 text-purple-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">📅 Rappel : Jours de fractionnement disponibles</p>
            <p className="text-sm">
              Vous avez <span className="font-bold">{profile.jours_fractionnement}</span> jour(s) de fractionnement à prendre.
              N'oubliez pas de les poser avant la fin de l'année !
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Jours acquis</p>
            <p className="text-3xl font-bold text-primary-600">
              {profile?.jours_acquis || 25}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Jours pris</p>
            <p className="text-3xl font-bold text-orange-600">
              {profile?.jours_pris || 0}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Jours restants</p>
            <p className="text-3xl font-bold text-green-600">
              {profile?.jours_restants || 25}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Jours reportés</p>
            <p className="text-3xl font-bold text-blue-600">
              {profile?.jours_reportes || 0}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Jours fractionnement</p>
            <p className="text-3xl font-bold text-purple-600">
              {profile?.jours_fractionnement || 0}
            </p>
          </div>
        </div>

        {/* Formulaire et Calendrier */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <LeaveRequestForm onSuccess={handleLeaveCreated} />
          <LeaveCalendar />
        </div>

        {/* Historique des demandes */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              Mes demandes de congés
            </h2>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Changer mon mot de passe
            </button>
          </div>

          {myLeaves.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Aucune demande de congés
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
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
                      Date demande
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Validateur
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {myLeaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {formatDateFR(leave.date_debut)} - {formatDateFR(leave.date_fin)}
                      </td>
                      <td className="px-4 py-3">
                        {leave.nombre_jours_ouvres}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(leave.statut)}`}>
                          {formatStatus(leave.statut)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDateFR(leave.date_demande)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {leave.validateur_nom ? (
                          `${leave.validateur_prenom} ${leave.validateur_nom}`
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
};

export default DashboardPage;
