'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import LeaveCalendar from '@/components/LeaveCalendar';
import { formatDateFR, formatStatus, getStatusColor } from '@/lib/clientDateUtils';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user, refreshProfile, isAuthenticated } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [myLeaves, setMyLeaves] = useState([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else {
      fetchData();
      if (user?.requirePasswordChange) {
        setShowPasswordModal(true);
        toast.error('Vous devez changer votre mot de passe');
      }
    }
  }, [isAuthenticated, user, router]);

  const fetchData = async () => {
    try {
      const [profileRes, leavesRes] = await Promise.all([
        fetch('/api/users/profile').then(r => r.json()),
        fetch('/api/leaves/my-leaves').then(r => r.json()),
      ]);

      setProfile(profileRes.user || null);
      setMyLeaves(leavesRes.leaves || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erreur lors du chargement des données');
      setProfile(null);
      setMyLeaves([]);
    } finally {
      setLoading(false);
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

      <div className="container mx-auto px-6 py-6">
        {user?.requirePasswordChange && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold">Changement de mot de passe requis</p>
                <p className="text-sm">
                  Vous devez changer votre mot de passe temporaire.{' '}
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="underline font-semibold hover:text-red-800"
                  >
                    Cliquez ici
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Panneau latéral gauche */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Mon solde</h2>
              <div className="space-y-3">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Jours restants</p>
                  <p className="text-3xl font-bold text-blue-600">{profile?.jours_restants || 25}</p>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Jours pris</span>
                  <span className="font-bold text-gray-800">{profile?.jours_pris || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Jours reportés</span>
                  <span className="font-bold text-gray-800">{profile?.jours_reportes || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-sm text-green-700">Fractionnement</span>
                  <span className="font-bold text-green-700">{profile?.jours_fractionnement || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
                  <span className="text-sm text-indigo-700">Compensateurs</span>
                  <span className="font-bold text-indigo-700">{profile?.jours_compensateurs || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-gray-800 mb-3">Mes prochains congés</h3>
              {!myLeaves || myLeaves.filter(l => new Date(l.date_debut) >= new Date()).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Aucun congé prévu</p>
              ) : (
                <div className="space-y-2">
                  {myLeaves
                    .filter(l => new Date(l.date_debut) >= new Date())
                    .slice(0, 5)
                    .map((leave) => (
                      <div key={leave.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getStatusColor(leave.statut)}`}>
                            {formatStatus(leave.statut)}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">
                          {formatDateFR(leave.date_debut)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {leave.nombre_jours_ouvres} jour(s)
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Grand calendrier */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Calendrier des congés</h2>
                <p className="text-sm text-gray-600">
                  Cliquez sur les dates pour créer une nouvelle demande de congés
                </p>
              </div>
              <LeaveCalendar onLeaveCreated={fetchData} />
            </div>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}
