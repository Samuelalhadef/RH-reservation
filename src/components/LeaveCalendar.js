'use client';

import { useState, useEffect } from 'react';
import { formatDateFR } from '@/lib/clientDateUtils';
import toast from 'react-hot-toast';

const LeaveCalendar = ({ onLeaveCreated }) => {
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateInfo, setDateInfo] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // États pour la sélection de plage
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const dayNames = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [leavesRes, holidaysRes] = await Promise.all([
        fetch('/api/leaves/calendar').then(r => r.json()),
        fetch('/api/holidays/all').then(r => r.json()),
      ]);

      setLeaves(leavesRes.events || []);
      setHolidays(holidaysRes.holidays || []);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    }
  };

  const formatDateToYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Lundi = 0, Dimanche = 6

    const days = [];

    // Jours du mois précédent
    for (let i = 0; i < startDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month, -startDayOfWeek + i + 1);
      days.push({ date: prevMonthDay, isCurrentMonth: false });
    }

    // Jours du mois actuel
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Jours du mois suivant pour compléter la grille
    const remainingDays = 42 - days.length; // 6 semaines * 7 jours
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 = Dimanche, 6 = Samedi
  };

  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const isLessThan7DaysAhead = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    const diffTime = checkDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays < 7;
  };

  const isDateSelectable = (date) => {
    const dateStr = formatDateToYYYYMMDD(date);

    // Les jours passés ne sont pas sélectionnables
    if (isPastDate(date)) {
      return false;
    }

    // Les demandes doivent être faites au moins 7 jours à l'avance
    if (isLessThan7DaysAhead(date)) {
      return false;
    }

    // Les week-ends ne sont pas sélectionnables
    if (isWeekend(date)) {
      return false;
    }

    // Les jours fériés ne sont pas sélectionnables
    const isHoliday = holidays.some(h => h.date === dateStr);
    if (isHoliday) {
      return false;
    }

    // Seules les dates avec des congés VALIDÉS ne sont pas sélectionnables
    // Les dates en attente peuvent être sélectionnées (elles seront remplacées)
    const hasValidatedLeave = leaves.some(leave => {
      if (leave.statut !== 'validee') return false;
      const startStr = leave.date_debut.split('T')[0];
      const endStr = leave.date_fin.split('T')[0];
      return dateStr >= startStr && dateStr <= endStr;
    });

    if (hasValidatedLeave) {
      return false;
    }

    return true;
  };

  const getDayClassName = (date, isCurrentMonth) => {
    const dateStr = formatDateToYYYYMMDD(date);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
    const isPast = isPastDate(date);
    const isTooSoon = isLessThan7DaysAhead(date);

    // Vérifier si la date fait partie de la plage sélectionnée
    const isInRange = startDate && endDate && date >= startDate && date <= endDate;
    const isStartDate = startDate && date.getTime() === startDate.getTime();
    const isEndDate = endDate && date.getTime() === endDate.getTime();

    let classes = 'w-full aspect-square flex items-center justify-center rounded-xl cursor-pointer transition-all font-medium text-lg ';

    // Vérifier si un congé existe pour cette date (pour toutes les dates du mois en cours)
    const leaveOnDate = isCurrentMonth ? leaves.find(leave => {
      const startStr = leave.date_debut.split('T')[0];
      const endStr = leave.date_fin.split('T')[0];
      return dateStr >= startStr && dateStr <= endStr;
    }) : null;

    if (!isCurrentMonth) {
      classes += 'text-gray-300 ';
    } else if (isPast || isTooSoon) {
      // Jours passés ou dans les 7 prochains jours
      if (leaveOnDate && leaveOnDate.statut === 'validee') {
        // Congé validé sur un jour passé/trop proche -> vert grisé
        classes += 'bg-green-200 text-green-600 border-2 border-green-200 font-semibold cursor-not-allowed opacity-60 ';
      } else if (leaveOnDate && leaveOnDate.statut === 'en_attente') {
        // Congé en attente sur un jour passé/trop proche -> orange grisé
        classes += 'bg-orange-200 text-orange-600 border-2 border-orange-200 font-semibold cursor-not-allowed opacity-60 ';
      } else {
        // Pas de congé -> gris normal
        classes += 'bg-gray-100 text-gray-400 cursor-not-allowed ';
      }
    } else if (isWeekend(date)) {
      // Griser les week-ends
      classes += 'bg-gray-100 text-gray-400 cursor-not-allowed ';
    } else {
      const isHoliday = holidays.some(h => h.date === dateStr);
      if (isHoliday) {
        classes += 'bg-purple-100 text-purple-800 font-semibold border-2 border-purple-300 cursor-not-allowed ';
      } else if (leaveOnDate) {
        // Colorier selon le statut
        if (leaveOnDate.statut === 'validee') {
          // Les congés validés ne sont pas modifiables
          classes += 'bg-green-100 text-green-800 border-2 border-green-300 font-semibold cursor-not-allowed ';
        } else if (leaveOnDate.statut === 'en_attente') {
          // Les congés en attente peuvent être modifiés (cliquables)
          classes += 'bg-orange-100 text-orange-800 border-2 border-orange-300 font-semibold cursor-pointer hover:bg-orange-200 ';
        } else {
          // refusée ou autre statut
          classes += 'bg-gray-100 text-gray-500 border-2 border-gray-300 cursor-not-allowed ';
        }
      } else if (isInRange) {
        classes += 'bg-blue-100 text-blue-800 ';
      } else {
        classes += 'text-gray-700 hover:bg-gray-100 ';
      }
    }

    if (isToday && isCurrentMonth) {
      classes += 'ring-2 ring-blue-500 ';
    }

    if (isStartDate || isEndDate) {
      classes += '!bg-blue-500 !text-white font-bold ';
    }

    return classes;
  };

  const handleDateClick = (date) => {
    // Vérifier si la date est sélectionnable
    if (!isDateSelectable(date)) {
      return;
    }

    // Logique de sélection de plage
    if (!startDate || (startDate && endDate)) {
      // Premier clic ou recommencer la sélection
      setStartDate(date);
      setEndDate(null);
    } else {
      // Deuxième clic - définir la date de fin
      if (date >= startDate) {
        setEndDate(date);
      } else {
        // Si la date de fin est avant la date de début, inverser
        setEndDate(startDate);
        setStartDate(date);
      }
    }
  };

  const handleCancel = () => {
    setStartDate(null);
    setEndDate(null);
    setReason('');
  };

  const handleContinue = () => {
    if (startDate && endDate) {
      setShowModal(true);
    }
  };

  const handleSubmitRequest = async () => {
    try {
      console.log('Envoi de la demande:', {
        date_debut: formatDateToYYYYMMDD(startDate),
        date_fin: formatDateToYYYYMMDD(endDate),
        motif: reason,
      });

      const response = await fetch('/api/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date_debut: formatDateToYYYYMMDD(startDate),
          date_fin: formatDateToYYYYMMDD(endDate),
          motif: reason,
        }),
      });

      const data = await response.json();
      console.log('Réponse de l\'API:', data);

      if (response.ok && data.success) {
        // Réinitialiser et fermer la modale
        setShowModal(false);
        setStartDate(null);
        setEndDate(null);
        setReason('');
        // Recharger les données
        fetchData();
        toast.success(data.message || `Demande de congé envoyée avec succès! (${data.businessDays} jour(s) ouvrés)`);
        // Appeler le callback si fourni
        if (onLeaveCreated) {
          onLeaveCreated();
        }
      } else {
        console.error('Erreur API:', data);
        toast.error(data.message || 'Erreur lors de l\'envoi de la demande');
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast.error('Erreur lors de l\'envoi de la demande: ' + error.message);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const days = getDaysInMonth(currentMonth);
  const currentYear = currentMonth.getFullYear();
  const currentMonthName = monthNames[currentMonth.getMonth()];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Jours de congés {currentYear}</h2>
          <p className="text-sm text-gray-500">{currentMonthName}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Légende */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs font-semibold text-gray-700 mb-2">Légende :</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
            <span className="text-gray-600">Validé</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-orange-100 border-2 border-orange-300 rounded"></div>
            <span className="text-gray-600">En attente</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-purple-100 border-2 border-purple-300 rounded"></div>
            <span className="text-gray-600">Jour férié</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-100 rounded"></div>
            <span className="text-gray-600">Non disponible (week-end / passé / délai 7j)</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        {/* En-têtes des jours */}
        <div className="grid grid-cols-7 mb-4">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-bold text-gray-600 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Grille des jours */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            const dayClasses = getDayClassName(day.date, day.isCurrentMonth);

            return (
              <div key={index} className="relative">
                <button
                  onClick={() => handleDateClick(day.date)}
                  disabled={!isDateSelectable(day.date) || !day.isCurrentMonth}
                  className={dayClasses}
                >
                  {day.date.getDate()}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Boutons Annuler et Continuer */}
      {startDate && endDate && (
        <div className="mt-4 flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">
              Du {formatDateFR(startDate)} au {formatDateFR(endDate)}
            </p>
            <p className="text-xs text-gray-600">
              {Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1} jour(s)
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            Annuler
          </button>
          <button
            onClick={handleContinue}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
          >
            Continuer
          </button>
        </div>
      )}

      {/* Modale de demande */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Demande de congé
            </h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Période sélectionnée:</p>
              <p className="text-base font-semibold text-gray-800">
                Du {formatDateFR(startDate)} au {formatDateFR(endDate)}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1} jour(s)
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Raison (optionnel)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows="4"
                placeholder="Indiquez la raison de votre demande de congé..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitRequest}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
              >
                Envoyer la demande
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveCalendar;
