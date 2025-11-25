import { useState, useEffect } from 'react';
import { leaveAPI, holidayAPI } from '../services/api';
import { getMinimumStartDate, calculateBusinessDays, isAtLeast7DaysInAdvance } from '../utils/dateUtils';
import toast from 'react-hot-toast';

const LeaveRequestForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    date_debut: '',
    date_fin: '',
    motif: '',
  });
  const [holidays, setHolidays] = useState([]);
  const [businessDays, setBusinessDays] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHolidays();
  }, []);

  useEffect(() => {
    if (formData.date_debut && formData.date_fin) {
      const holidays_dates = holidays.map(h => h.date);
      const days = calculateBusinessDays(formData.date_debut, formData.date_fin, holidays_dates);
      setBusinessDays(days);
    } else {
      setBusinessDays(0);
    }
  }, [formData.date_debut, formData.date_fin, holidays]);

  const fetchHolidays = async () => {
    try {
      const response = await holidayAPI.getAllHolidays();
      setHolidays(response.data.holidays);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.date_debut || !formData.date_fin) {
      toast.error('Veuillez remplir toutes les dates');
      return;
    }

    if (new Date(formData.date_debut) > new Date(formData.date_fin)) {
      toast.error('La date de début doit être avant la date de fin');
      return;
    }

    if (!isAtLeast7DaysInAdvance(formData.date_debut)) {
      toast.error('Les demandes doivent être faites au moins 7 jours à l\'avance');
      return;
    }

    if (businessDays === 0) {
      toast.error('La période sélectionnée ne contient aucun jour ouvré');
      return;
    }

    setLoading(true);
    try {
      await leaveAPI.createLeaveRequest(formData);
      toast.success('Demande de congés créée avec succès!');
      setFormData({ date_debut: '', date_fin: '', motif: '' });
      setBusinessDays(0);
      if (onSuccess) onSuccess();
    } catch (error) {
      const message = error.response?.data?.message || 'Erreur lors de la création de la demande';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Nouvelle demande de congés
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de début <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.date_debut}
              onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
              min={getMinimumStartDate()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum 7 jours à l'avance
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de fin <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.date_fin}
              onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
              min={formData.date_debut || getMinimumStartDate()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
        </div>

        {businessDays > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm font-medium text-blue-800">
              Nombre de jours ouvrés : <span className="font-bold">{businessDays}</span> jour(s)
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Motif (optionnel)
          </label>
          <textarea
            value={formData.motif}
            onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Précisez le motif de votre demande..."
          />
        </div>

        <button
          type="submit"
          disabled={loading || businessDays === 0}
          className="w-full bg-primary-600 text-white py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 transition font-semibold"
        >
          {loading ? 'Envoi...' : 'Soumettre la demande'}
        </button>
      </form>
    </div>
  );
};

export default LeaveRequestForm;
