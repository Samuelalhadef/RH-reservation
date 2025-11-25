'use client';

import { useState, useEffect } from 'react';
import { getMinimumStartDate, calculateBusinessDays, isAtLeast7DaysInAdvance } from '@/lib/clientDateUtils';
import toast from 'react-hot-toast';

const LeaveRequestForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    date_debut: '',
    date_fin: '',
    motif: '',
    type_debut: 'journee_complete',
    type_fin: 'journee_complete',
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
      let days = calculateBusinessDays(formData.date_debut, formData.date_fin, holidays_dates);

      // Ajuster pour les demi-journées
      const isSameDay = formData.date_debut === formData.date_fin;

      if (isSameDay) {
        // Si c'est le même jour
        if (formData.type_debut === 'matin' && formData.type_fin === 'apres_midi') {
          // Matin + après-midi = journée complète
          days = 1;
        } else if (formData.type_debut === 'matin' || formData.type_debut === 'apres_midi') {
          // Seulement matin ou après-midi = 0.5 jour
          days = 0.5;
        }
      } else {
        // Ajuster le premier jour si demi-journée
        if (formData.type_debut === 'apres_midi') {
          days -= 0.5;
        }
        // Ajuster le dernier jour si demi-journée
        if (formData.type_fin === 'matin') {
          days -= 0.5;
        }
      }

      // Soustraire 0.5 pour chaque mercredi dans la période (seulement l'après-midi)
      const startDate = new Date(formData.date_debut);
      const endDate = new Date(formData.date_fin);
      let currentDate = new Date(startDate);
      let wednesdayAdjustment = 0;

      while (currentDate <= endDate) {
        if (currentDate.getDay() === 3) { // 3 = Mercredi
          wednesdayAdjustment += 0.5;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      days -= wednesdayAdjustment;

      setBusinessDays(Math.max(0, days));
    } else {
      setBusinessDays(0);
    }
  }, [formData.date_debut, formData.date_fin, formData.type_debut, formData.type_fin, holidays]);

  const fetchHolidays = async () => {
    try {
      const response = await fetch('/api/holidays/all');
      const data = await response.json();
      setHolidays(data.holidays);
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
      const response = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la création de la demande');
      }

      toast.success('Demande de congés créée avec succès!');
      setFormData({
        date_debut: '',
        date_fin: '',
        motif: '',
        type_debut: 'journee_complete',
        type_fin: 'journee_complete'
      });
      setBusinessDays(0);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const [leaveType, setLeaveType] = useState('Congés payés');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-6">
        Nouvelle demande de congés
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de congé
          </label>
          <div className="relative">
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
            >
              <option value="Congés payés">Congés payés</option>
              <option value="Maladie">Maladie</option>
              <option value="Urgence">Urgence</option>
              <option value="Personnel">Personnel</option>
            </select>
            <svg className="absolute right-3 top-3.5 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date de début
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={formData.date_debut}
              onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
              min={getMinimumStartDate()}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <select
              value={formData.type_debut}
              onChange={(e) => setFormData({ ...formData, type_debut: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="journee_complete">Journée complète</option>
              <option value="matin">Matin uniquement</option>
              <option value="apres_midi">Après-midi uniquement</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date de fin
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={formData.date_fin}
              onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
              min={formData.date_debut || getMinimumStartDate()}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <select
              value={formData.type_fin}
              onChange={(e) => setFormData({ ...formData, type_fin: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="journee_complete">Journée complète</option>
              <option value="matin">Matin uniquement</option>
              <option value="apres_midi">Après-midi uniquement</option>
            </select>
          </div>
        </div>

        {businessDays > 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-blue-800">
                Nombre de jours ouvrés : <span className="font-bold">{businessDays}</span> jour(s)
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Motif
          </label>
          <textarea
            value={formData.motif}
            onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
            rows={4}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Précisez le motif de votre demande..."
          />
        </div>

        <button
          type="submit"
          disabled={loading || businessDays === 0}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold shadow-sm"
        >
          {loading ? 'Envoi en cours...' : 'Soumettre la demande'}
        </button>
      </form>
    </div>
  );
};

export default LeaveRequestForm;
