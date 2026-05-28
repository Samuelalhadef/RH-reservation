'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';

const LeaveCalendar = dynamic(() => import('@/components/LeaveCalendar'), {
  ssr: false,
  loading: () => (
    <div className="py-16 text-center text-gray-400 text-sm">Chargement du calendrier…</div>
  ),
});

const ChangePasswordModal = dynamic(() => import('@/components/ChangePasswordModal'), {
  ssr: false,
});

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

  const pendingCount = (myLeaves || []).filter(l => l.statut === 'en_attente').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
        {user?.requirePasswordChange && (
          <div className="relative overflow-hidden bg-gradient-to-br from-red-500 to-rose-600 text-white rounded-2xl shadow-lg">
            <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative p-5 flex items-start gap-4">
              <div className="p-2.5 bg-white/15 rounded-xl flex-shrink-0">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold">Changement de mot de passe requis</p>
                <p className="text-sm text-white/80">
                  Vous devez changer votre mot de passe temporaire.{' '}
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="underline font-semibold hover:text-white"
                  >
                    Cliquez ici
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* HERO */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xl">
          <div className="absolute -top-16 -right-12 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-12 w-80 h-80 bg-indigo-300/20 rounded-full blur-3xl"></div>
          <div className="relative p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-medium uppercase tracking-wider">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Tableau de bord
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Bonjour {user?.prenom || ''} 👋</h1>
            <p className="text-white/80 text-sm mt-1.5 max-w-2xl">
              Voici un aperçu de vos congés, soldes et prochaines périodes d&apos;absence.
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
              <DashStat label="Jours restants" value={profile?.jours_restants || 25} icon="balance" />
              <DashStat label="Jours pris" value={profile?.jours_pris || 0} icon="check" />
              <DashStat label="En attente" value={pendingCount} icon="clock" highlight={pendingCount > 0} />
              <DashStat label="Récup. acquises" value={`${profile?.heures_recuperation || 0}h`} icon="hourglass" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-b from-blue-50/50 to-transparent">
            <h2 className="text-xl font-bold text-gray-900">Calendrier des congés</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Cliquez sur les dates pour créer une nouvelle demande
            </p>
          </div>
          <div className="p-4 sm:p-6">
            <LeaveCalendar onLeaveCreated={fetchData} />
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}

function DashStat({ label, value, icon, highlight }) {
  const icons = {
    balance: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />,
    check: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
    clock: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
    hourglass: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
  };
  return (
    <div className={`relative bg-white/15 backdrop-blur-sm rounded-xl p-3 border ${highlight ? 'border-white/40 ring-2 ring-white/30' : 'border-white/20'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <svg className="w-3.5 h-3.5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icons[icon] || icons.check}
        </svg>
        <p className="text-[10px] uppercase tracking-wider text-white/70 font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

