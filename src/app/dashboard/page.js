'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { formatDateFR, formatStatus, getStatusColor } from '@/lib/clientDateUtils';
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

  const upcomingLeaves = (myLeaves || []).filter(l => new Date(l.date_debut) >= new Date());
  const validatedCount = (myLeaves || []).filter(l => l.statut === 'validee').length;
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Panneau latéral gauche */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-b from-blue-50/50 to-transparent">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  Mon solde
                </h2>
              </div>
              <div className="p-5 space-y-2.5">
                <div className="relative overflow-hidden p-4 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                  <p className="relative text-xs uppercase tracking-wider text-white/80 mb-1">Jours restants</p>
                  <p className="relative text-3xl font-bold">{profile?.jours_restants || 25}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SoldeMini label="Pris" value={profile?.jours_pris || 0} color="gray" />
                  <SoldeMini label="Reportés" value={profile?.jours_reportes || 0} color="amber" />
                  <SoldeMini label="Fract." value={profile?.jours_fractionnement || 0} color="emerald" />
                  <SoldeMini label="Comp." value={profile?.jours_compensateurs || 0} color="indigo" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-b from-emerald-50/50 to-transparent">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Mes prochains congés
                </h3>
              </div>
              <div className="p-5">
                {upcomingLeaves.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Aucun congé prévu</p>
                ) : (
                  <div className="space-y-2">
                    {upcomingLeaves.slice(0, 5).map((leave) => (
                      <div key={leave.id} className="p-3 rounded-xl ring-1 ring-gray-100 hover:ring-blue-200 hover:bg-blue-50/30 transition">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${getStatusColor(leave.statut)}`}>
                            {formatStatus(leave.statut)}
                          </span>
                          <span className="text-xs font-bold text-gray-700">{leave.nombre_jours_ouvres}j</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{formatDateFR(leave.date_debut)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Grand calendrier */}
          <div className="lg:col-span-3">
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

function SoldeMini({ label, value, color }) {
  const colors = {
    gray: 'bg-gray-50 text-gray-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  };
  return (
    <div className={`${colors[color]} rounded-lg px-2.5 py-2`}>
      <p className="text-[10px] uppercase tracking-wider font-medium opacity-80">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
