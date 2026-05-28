'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';

const TeamCalendar = dynamic(() => import('@/components/TeamCalendar'), {
  ssr: false,
  loading: () => (
    <div className="py-16 text-center text-gray-400 text-sm">Chargement du calendrier équipe…</div>
  ),
});

export default function CalendrierPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-50">
      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* HERO cyan */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 text-white shadow-xl">
          <div className="absolute -top-16 -right-12 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-12 w-80 h-80 bg-teal-300/20 rounded-full blur-3xl"></div>
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-medium uppercase tracking-wider">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Vue équipe
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Calendrier de l&apos;équipe</h1>
                <p className="text-white/80 text-sm mt-1.5 max-w-2xl">
                  Visualisez les congés validés de tous les membres de l&apos;équipe.
                </p>
              </div>
              <button
                onClick={() => router.push('/organigramme')}
                className="group inline-flex items-center gap-2 px-4 py-2.5 bg-white text-cyan-700 rounded-xl text-sm font-semibold shadow-lg shadow-black/10 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Organigramme
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-cyan-50 to-teal-50 border border-cyan-100 rounded-2xl">
          <div className="p-2 bg-cyan-600 text-white rounded-lg flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-cyan-900">Congés validés uniquement</p>
            <p className="text-cyan-700 text-xs mt-0.5">
              Survolez une date pour voir les détails des personnes en congé.
            </p>
          </div>
        </div>

        {/* Calendrier */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-4 sm:p-6">
          <TeamCalendar />
        </div>
      </div>
    </div>
  );
}
