import { useState, useEffect } from 'react';
import { leaveAPI } from '../services/api';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import toast from 'react-hot-toast';

const COLORS = {
  primary: '#2563eb',
  success: '#16a34a',
  warning: '#eab308',
  danger: '#dc2626',
  purple: '#9333ea',
  orange: '#f97316',
  teal: '#14b8a6',
  pink: '#ec4899'
};

const MONTH_NAMES = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
];

const DashboardRH = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchStats();
  }, [selectedYear]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await leaveAPI.getDashboardStats({ year: selectedYear });
      setStats(response.data.stats);
    } catch (error) {
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des statistiques...</p>
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

  // Préparer les données pour les graphiques
  const monthlyData = MONTH_NAMES.map((month, index) => {
    const monthNum = (index + 1).toString().padStart(2, '0');
    const data = stats.monthly.find(m => m.mois === monthNum);
    return {
      mois: month,
      validees: data?.validees || 0,
      refusees: data?.refusees || 0,
      en_attente: data?.en_attente || 0,
      total: data?.total || 0
    };
  });

  const statusData = [
    { name: 'Validées', value: stats.global.validee || 0, color: COLORS.success },
    { name: 'En attente', value: stats.global.en_attente || 0, color: COLORS.warning },
    { name: 'Refusées', value: stats.global.refusee || 0, color: COLORS.danger }
  ];

  const userTypeData = stats.byUserType.map(item => ({
    type: item.type_utilisateur,
    demandes: item.total_demandes,
    validees: item.validees,
    jours: item.jours_pris
  }));

  const balanceData = stats.balanceDistribution.map(item => ({
    tranche: item.tranche,
    employes: item.nombre_employes
  }));

  const approvalRateData = MONTH_NAMES.map((month, index) => {
    const monthNum = (index + 1).toString().padStart(2, '0');
    const data = stats.approvalRate.find(m => m.mois === monthNum);
    return {
      mois: month,
      taux: data?.taux_approbation || 0
    };
  }).filter(item => item.taux > 0);

  return (
    <div className="space-y-6">
      {/* Header avec sélecteur d'année */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Tableau de bord RH</h2>
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

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total demandes"
          value={stats.global.total || 0}
          icon="📊"
          color="blue"
        />
        <StatCard
          title="Demandes validées"
          value={stats.global.validee || 0}
          icon="✅"
          color="green"
        />
        <StatCard
          title="En attente"
          value={stats.global.en_attente || 0}
          icon="⏳"
          color="yellow"
        />
        <StatCard
          title="Jours validés"
          value={stats.global.total_jours_valides || 0}
          icon="📅"
          color="purple"
        />
      </div>

      {/* Statistiques de soldes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total employés"
          value={stats.balances.total_users || 0}
          icon="👥"
          color="blue"
          small
        />
        <StatCard
          title="Jours acquis"
          value={stats.balances.total_acquis || 0}
          icon="➕"
          color="green"
          small
        />
        <StatCard
          title="Jours pris"
          value={stats.balances.total_pris || 0}
          icon="✈️"
          color="orange"
          small
        />
        <StatCard
          title="Jours restants"
          value={stats.balances.total_restants || 0}
          icon="📌"
          color="purple"
          small
        />
      </div>

      {/* Graphiques en grille */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Statut des demandes (Pie Chart) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Répartition des demandes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Demandes par mois (Bar Chart) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Demandes par mois</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mois" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="validees" fill={COLORS.success} name="Validées" />
              <Bar dataKey="en_attente" fill={COLORS.warning} name="En attente" />
              <Bar dataKey="refusees" fill={COLORS.danger} name="Refusées" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Demandes par type d'utilisateur */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Demandes par type d'utilisateur</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={userTypeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="type" type="category" width={120} />
              <Tooltip />
              <Legend />
              <Bar dataKey="validees" fill={COLORS.success} name="Validées" />
              <Bar dataKey="demandes" fill={COLORS.primary} name="Total" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution des soldes restants */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribution des soldes restants</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={balanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tranche" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="employes" fill={COLORS.purple} name="Nombre d'employés" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Taux d'approbation par mois */}
      {approvalRateData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Taux d'approbation par mois (%)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={approvalRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mois" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Area type="monotone" dataKey="taux" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.3} name="Taux %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Jours pris par type d'utilisateur */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Jours de congés pris par type d'utilisateur</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={userTypeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="type" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="jours" fill={COLORS.orange} name="Jours pris" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top 10 employés */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 10 des employés - Congés pris</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Demandes</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jours pris</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jours restants</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.topUsers.map((user, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`font-bold ${index < 3 ? 'text-xl' : ''}`}>
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      {index >= 3 && `${index + 1}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{user.prenom} {user.nom}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{user.type_utilisateur}</td>
                  <td className="px-4 py-3 text-center">{user.nombre_demandes}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-orange-600">{user.jours_pris}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${
                      user.jours_restants > 15 ? 'text-green-600' :
                      user.jours_restants > 5 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {user.jours_restants || 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color, small }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium text-gray-600 ${small ? 'text-xs' : ''}`}>{title}</p>
          <p className={`font-bold text-gray-900 ${small ? 'text-2xl' : 'text-3xl'} mt-1`}>{value}</p>
        </div>
        <div className={`${colorClasses[color]} p-3 rounded-full ${small ? 'text-2xl' : 'text-3xl'}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default DashboardRH;
