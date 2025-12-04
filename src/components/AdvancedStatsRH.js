'use client';

import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale
} from 'chart.js';
import { Bar, Doughnut, PolarArea } from 'react-chartjs-2';
import toast from 'react-hot-toast';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale
);

const COLORS = {
  primary: '#2563eb',
  success: '#16a34a',
  warning: '#eab308',
  danger: '#dc2626',
  purple: '#9333ea',
  orange: '#f97316',
  teal: '#14b8a6',
  pink: '#ec4899',
  indigo: '#6366f1',
  cyan: '#06b6d4'
};

export default function AdvancedStatsRH() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchAllUsers();
  }, [selectedYear]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leaves/dashboard-stats?year=${selectedYear}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setStats(data.stats);
    } catch (error) {
      toast.error('Erreur lors du chargement des statistiques avancées');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await fetch('/api/users/all');
      const data = await response.json();
      if (data.success) {
        setAllUsers(data.users || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    }
  };

  const handleExportExcel = () => {
    if (allUsers.length === 0) {
      toast.error('Aucune donnée à exporter');
      return;
    }
    exportToExcel(allUsers, selectedYear);
    toast.success('Export Excel généré avec succès !');
  };

  const handleExportPDF = () => {
    if (allUsers.length === 0) {
      toast.error('Aucune donnée à exporter');
      return;
    }
    exportToPDF(allUsers, selectedYear);
    toast.success('Export PDF généré avec succès !');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des statistiques avancées...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Aucune statistique disponible</p>
      </div>
    );
  }

  // Données pour le graphique trimestriel
  const quarterlyData = {
    labels: stats.quarterly?.map(q => q.trimestre) || [],
    datasets: [
      {
        label: 'Demandes totales',
        data: stats.quarterly?.map(q => q.total_demandes) || [],
        backgroundColor: COLORS.primary,
      },
      {
        label: 'Jours validés',
        data: stats.quarterly?.map(q => q.jours_valides) || [],
        backgroundColor: COLORS.success,
      }
    ]
  };

  // Données pour la durée moyenne par type d'utilisateur
  const avgDurationData = {
    labels: stats.avgDuration?.map(d => d.type_utilisateur) || [],
    datasets: [{
      label: 'Durée moyenne (jours)',
      data: stats.avgDuration?.map(d => d.duree_moyenne) || [],
      backgroundColor: [
        COLORS.primary,
        COLORS.success,
        COLORS.warning,
        COLORS.purple,
        COLORS.orange,
        COLORS.teal
      ],
    }]
  };

  // Données pour les congés par jour de la semaine
  const weekdayData = {
    labels: stats.weekday?.map(w => w.jour_semaine) || [],
    datasets: [{
      label: 'Nombre de départs en congés',
      data: stats.weekday?.map(w => w.nombre_demandes) || [],
      backgroundColor: [
        COLORS.danger,
        COLORS.primary,
        COLORS.success,
        COLORS.warning,
        COLORS.orange,
        COLORS.purple,
        COLORS.teal
      ],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  // Données pour le taux d'utilisation
  const utilizationData = {
    labels: stats.utilization?.map(u => u.type_utilisateur) || [],
    datasets: [{
      label: 'Taux d\'utilisation (%)',
      data: stats.utilization?.map(u => u.taux_utilisation) || [],
      backgroundColor: [
        COLORS.success + '80',
        COLORS.primary + '80',
        COLORS.warning + '80',
        COLORS.purple + '80',
        COLORS.orange + '80'
      ],
      borderColor: [
        COLORS.success,
        COLORS.primary,
        COLORS.warning,
        COLORS.purple,
        COLORS.orange
      ],
      borderWidth: 2
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'top',
      },
    },
  };

  const polarOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'right',
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 100
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header avec sélecteur d'année et boutons d'export */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">📊 Statistiques Avancées</h2>
        <div className="flex gap-3 items-center">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export PDF
          </button>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            {[2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Délai moyen de validation</p>
              <p className="text-3xl font-bold mt-2">
                {stats.avgValidationTime?.delai_moyen_jours || 0} jours
              </p>
            </div>
            <div className="text-4xl opacity-75">⏱️</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Taux d'utilisation moyen</p>
              <p className="text-3xl font-bold mt-2">
                {stats.utilization?.length > 0
                  ? Math.round(stats.utilization.reduce((sum, u) => sum + u.taux_utilisation, 0) / stats.utilization.length)
                  : 0}%
              </p>
            </div>
            <div className="text-4xl opacity-75">📈</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Durée moyenne des congés</p>
              <p className="text-3xl font-bold mt-2">
                {stats.avgDuration?.length > 0
                  ? (stats.avgDuration.reduce((sum, d) => sum + d.duree_moyenne, 0) / stats.avgDuration.length).toFixed(1)
                  : 0} jours
              </p>
            </div>
            <div className="text-4xl opacity-75">📅</div>
          </div>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analyse trimestrielle */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Analyse Trimestrielle</h3>
          <div style={{ height: '300px', position: 'relative' }}>
            <Bar data={quarterlyData} options={chartOptions} />
          </div>
        </div>

        {/* Durée moyenne par type */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">⏳ Durée Moyenne par Type</h3>
          <div style={{ height: '300px', position: 'relative' }}>
            <Bar
              data={avgDurationData}
              options={{
                ...chartOptions,
                indexAxis: 'y',
              }}
            />
          </div>
        </div>

        {/* Jours de départ préférés */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📆 Jours de Départ Préférés</h3>
          <div className="flex justify-center" style={{ height: '300px', position: 'relative' }}>
            <Doughnut data={weekdayData} options={chartOptions} />
          </div>
        </div>

        {/* Taux d'utilisation */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🎯 Taux d'Utilisation des Congés</h3>
          <div className="flex justify-center" style={{ height: '300px', position: 'relative' }}>
            <PolarArea data={utilizationData} options={polarOptions} />
          </div>
        </div>
      </div>

      {/* Tableau détaillé */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Détails par Type d'Utilisateur</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durée Moyenne</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre de Demandes</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Taux d'Utilisation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.avgDuration?.map((item, index) => {
                const utilization = stats.utilization?.find(u => u.type_utilisateur === item.type_utilisateur);
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{item.type_utilisateur}</td>
                    <td className="px-4 py-3">{item.duree_moyenne} jours</td>
                    <td className="px-4 py-3">{item.nombre_demandes}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${utilization?.taux_utilisation || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{utilization?.taux_utilisation || 0}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
