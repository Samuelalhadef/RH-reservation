'use client';

import { useState, useEffect } from 'react';
import { formatDateFR } from '@/lib/clientDateUtils';
import toast from 'react-hot-toast';

const LeaveCalendar = ({ onLeaveCreated }) => {
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Sélection par demi-journée
  const [startDate, setStartDate] = useState(null);
  const [startPeriod, setStartPeriod] = useState(null); // 'matin' ou 'apres_midi'
  const [endDate, setEndDate] = useState(null);
  const [endPeriod, setEndPeriod] = useState(null);
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
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month, -startDayOfWeek + i + 1);
      days.push({ date: prevMonthDay, isCurrentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
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

  // Détermine le statut d'une demi-journée par rapport aux congés existants
  const getHalfDayLeaveStatus = (date, period) => {
    const dateStr = formatDateToYYYYMMDD(date);

    for (const leave of leaves) {
      const startStr = leave.date_debut.split('T')[0];
      const endStr = leave.date_fin.split('T')[0];

      if (dateStr < startStr || dateStr > endStr) continue;

      const typeDebut = leave.type_debut || 'journee_complete';
      const typeFin = leave.type_fin || 'journee_complete';

      if (dateStr > startStr && dateStr < endStr) {
        return { statut: leave.statut, leave };
      }

      if (dateStr === startStr && dateStr === endStr) {
        if (typeDebut === 'journee_complete' && typeFin === 'journee_complete') {
          return { statut: leave.statut, leave };
        }
        if (typeDebut === 'matin' && typeFin === 'matin') {
          if (period === 'matin') return { statut: leave.statut, leave };
          return null;
        }
        if (typeDebut === 'apres_midi' && typeFin === 'apres_midi') {
          if (period === 'apres_midi') return { statut: leave.statut, leave };
          return null;
        }
        if (typeDebut === 'matin' && typeFin === 'apres_midi') {
          return { statut: leave.statut, leave };
        }
        if (typeDebut === 'apres_midi') {
          if (period === 'apres_midi') return { statut: leave.statut, leave };
          return null;
        }
        if (typeFin === 'matin') {
          if (period === 'matin') return { statut: leave.statut, leave };
          return null;
        }
        return { statut: leave.statut, leave };
      }

      if (dateStr === startStr) {
        if (typeDebut === 'apres_midi') {
          if (period === 'apres_midi') return { statut: leave.statut, leave };
          return null;
        }
        return { statut: leave.statut, leave };
      }

      if (dateStr === endStr) {
        if (typeFin === 'matin') {
          if (period === 'matin') return { statut: leave.statut, leave };
          return null;
        }
        return { statut: leave.statut, leave };
      }
    }

    return null;
  };

  const isHalfDaySelectable = (date, period) => {
    if (isPastDate(date)) return false;
    if (isLessThan7DaysAhead(date)) return false;
    if (isWeekend(date)) return false;

    const dateStr = formatDateToYYYYMMDD(date);
    const isHoliday = holidays.some(h => h.date === dateStr);
    if (isHoliday) return false;

    const leaveStatus = getHalfDayLeaveStatus(date, period);
    if (leaveStatus && leaveStatus.statut === 'validee') return false;

    return true;
  };

  const isInSelectedRange = (date, period) => {
    if (!startDate || !startPeriod || !endDate || !endPeriod) return false;

    const dateStr = formatDateToYYYYMMDD(date);
    const startStr = formatDateToYYYYMMDD(startDate);
    const endStr = formatDateToYYYYMMDD(endDate);

    if (dateStr < startStr || dateStr > endStr) return false;

    if (dateStr === startStr && dateStr === endStr) {
      if (startPeriod === 'matin') {
        if (endPeriod === 'matin') return period === 'matin';
        return true;
      } else {
        if (endPeriod === 'apres_midi') return period === 'apres_midi';
        return true;
      }
    }

    if (dateStr === startStr) {
      if (startPeriod === 'apres_midi' && period === 'matin') return false;
      return true;
    }

    if (dateStr === endStr) {
      if (endPeriod === 'matin' && period === 'apres_midi') return false;
      return true;
    }

    return true;
  };

  const isStartSlot = (date, period) => {
    if (!startDate || !startPeriod) return false;
    return date.getTime() === startDate.getTime() && period === startPeriod;
  };

  const isEndSlot = (date, period) => {
    if (!endDate || !endPeriod) return false;
    return date.getTime() === endDate.getTime() && period === endPeriod;
  };

  const handleHalfDayClick = (date, period) => {
    if (!isHalfDaySelectable(date, period)) return;

    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setStartPeriod(period);
      setEndDate(null);
      setEndPeriod(null);
    } else {
      const clickedStr = formatDateToYYYYMMDD(date);
      const startStr = formatDateToYYYYMMDD(startDate);

      if (clickedStr > startStr || (clickedStr === startStr && (period === 'apres_midi' || startPeriod === 'matin'))) {
        setEndDate(date);
        setEndPeriod(period);
      } else if (clickedStr < startStr || (clickedStr === startStr && period === 'matin' && startPeriod === 'apres_midi')) {
        setEndDate(startDate);
        setEndPeriod(startPeriod);
        setStartDate(date);
        setStartPeriod(period);
      } else {
        setEndDate(date);
        setEndPeriod(period);
      }
    }
  };

  const handleCancel = () => {
    setStartDate(null);
    setStartPeriod(null);
    setEndDate(null);
    setEndPeriod(null);
    setReason('');
  };

  const handleContinue = () => {
    if (startDate && endDate && startPeriod && endPeriod) {
      setShowModal(true);
    }
  };

  const periodToType = (period) => {
    if (period === 'matin') return 'matin';
    if (period === 'apres_midi') return 'apres_midi';
    return 'journee_complete';
  };

  const handleSubmitRequest = async () => {
    try {
      const response = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_debut: formatDateToYYYYMMDD(startDate),
          date_fin: formatDateToYYYYMMDD(endDate),
          type_debut: periodToType(startPeriod),
          type_fin: periodToType(endPeriod),
          motif: reason,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setShowModal(false);
        setStartDate(null);
        setStartPeriod(null);
        setEndDate(null);
        setEndPeriod(null);
        setReason('');
        fetchData();
        toast.success(data.message || `Demande de congé envoyée avec succès! (${data.businessDays} jour(s) ouvrés)`);
        if (onLeaveCreated) onLeaveCreated();
      } else {
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

  const formatPeriodLabel = (period) => {
    if (period === 'matin') return 'matin';
    if (period === 'apres_midi') return 'après-midi';
    return '';
  };

  const getSelectionSummary = () => {
    if (!startDate || !endDate || !startPeriod || !endPeriod) return '';
    const startStr = formatDateFR(startDate);
    const endStr = formatDateFR(endDate);
    const startLabel = formatPeriodLabel(startPeriod);
    const endLabel = formatPeriodLabel(endPeriod);

    if (startDate.getTime() === endDate.getTime() && startPeriod === endPeriod) {
      return `${startStr} (${startLabel})`;
    }
    return `Du ${startStr} (${startLabel}) au ${endStr} (${endLabel})`;
  };

  // Classe CSS d'une demi-journée (background uniquement, pas de texte)
  const getHalfDayBg = (date, period, isCurrentMonth) => {
    if (!isCurrentMonth) return '';

    const dateStr = formatDateToYYYYMMDD(date);
    const isPast = isPastDate(date);
    const isTooSoon = isLessThan7DaysAhead(date);
    const isHoliday = holidays.some(h => h.date === dateStr);
    const leaveStatus = getHalfDayLeaveStatus(date, period);
    const inRange = isInSelectedRange(date, period);
    const isStart = isStartSlot(date, period);
    const isEnd = isEndSlot(date, period);

    if (isWeekend(date)) return 'bg-gray-100';
    if (isHoliday) return 'bg-purple-100';

    if (isPast || isTooSoon) {
      if (leaveStatus && leaveStatus.statut === 'validee') return 'bg-green-200 opacity-60';
      if (leaveStatus && leaveStatus.statut === 'en_attente') return 'bg-orange-200 opacity-60';
      return 'bg-gray-100';
    }

    if (isStart || isEnd) return 'bg-blue-500';
    if (inRange) return 'bg-blue-100';

    if (leaveStatus) {
      if (leaveStatus.statut === 'validee') return 'bg-green-100';
      if (leaveStatus.statut === 'en_attente') return 'bg-orange-100';
    }

    return '';
  };

  // Couleur du texte du numéro (basé sur les deux demi-journées combinées)
  const getDayTextClass = (date, isCurrentMonth) => {
    if (!isCurrentMonth) return 'text-gray-300';

    const dateStr = formatDateToYYYYMMDD(date);
    const isPast = isPastDate(date);
    const isTooSoon = isLessThan7DaysAhead(date);
    const isHoliday = holidays.some(h => h.date === dateStr);

    if (isWeekend(date)) return 'text-gray-400';
    if (isHoliday) return 'text-purple-800 font-semibold';

    if (isPast || isTooSoon) {
      const lsAM = getHalfDayLeaveStatus(date, 'matin');
      const lsPM = getHalfDayLeaveStatus(date, 'apres_midi');
      if ((lsAM && lsAM.statut === 'validee') || (lsPM && lsPM.statut === 'validee')) return 'text-green-600 font-semibold';
      if ((lsAM && lsAM.statut === 'en_attente') || (lsPM && lsPM.statut === 'en_attente')) return 'text-orange-600 font-semibold';
      return 'text-gray-400';
    }

    const isStartAM = isStartSlot(date, 'matin');
    const isStartPM = isStartSlot(date, 'apres_midi');
    const isEndAM = isEndSlot(date, 'matin');
    const isEndPM = isEndSlot(date, 'apres_midi');
    if ((isStartAM && isStartPM) || (isEndAM && isEndPM) || (isStartAM && isEndPM) || (isStartPM && isEndAM)) return 'text-white font-bold';
    if (isStartAM || isStartPM || isEndAM || isEndPM) return 'text-gray-800 font-bold';

    const inRangeAM = isInSelectedRange(date, 'matin');
    const inRangePM = isInSelectedRange(date, 'apres_midi');
    if (inRangeAM && inRangePM) return 'text-blue-800';

    const lsAM = getHalfDayLeaveStatus(date, 'matin');
    const lsPM = getHalfDayLeaveStatus(date, 'apres_midi');
    if (lsAM && lsAM.statut === 'validee' && lsPM && lsPM.statut === 'validee') return 'text-green-800 font-semibold';
    if (lsAM && lsAM.statut === 'en_attente' && lsPM && lsPM.statut === 'en_attente') return 'text-orange-800 font-semibold';

    return 'text-gray-700';
  };

  // Est-ce que la demi-journée est cliquable ?
  const isHalfDayClickable = (date, period, isCurrentMonth) => {
    if (!isCurrentMonth) return false;
    return isHalfDaySelectable(date, period);
  };

  const days = getDaysInMonth(currentMonth);
  const currentYear = currentMonth.getFullYear();
  const currentMonthName = monthNames[currentMonth.getMonth()];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
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
            <span className="text-gray-600">Non disponible</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded overflow-hidden flex flex-col">
              <div className="flex-1 bg-blue-200"></div>
              <div className="flex-1"></div>
            </div>
            <span className="text-gray-600">Haut = matin, Bas = après-midi</span>
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
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {days.map((day, index) => {
            const today = new Date();
            const isToday = day.date.getDate() === today.getDate() &&
                            day.date.getMonth() === today.getMonth() &&
                            day.date.getFullYear() === today.getFullYear();

            const bgAM = getHalfDayBg(day.date, 'matin', day.isCurrentMonth);
            const bgPM = getHalfDayBg(day.date, 'apres_midi', day.isCurrentMonth);
            const textClass = getDayTextClass(day.date, day.isCurrentMonth);
            const clickableAM = isHalfDayClickable(day.date, 'matin', day.isCurrentMonth);
            const clickablePM = isHalfDayClickable(day.date, 'apres_midi', day.isCurrentMonth);

            return (
              <div key={index} className="relative">
                <div className={`w-full aspect-square relative ${
                  isToday && day.isCurrentMonth ? 'ring-2 ring-blue-500 rounded-lg sm:rounded-xl' : ''
                }`}>
                  {/* Deux moitiés avec gap */}
                  <div className="absolute inset-0 flex flex-col gap-1">
                    {/* Moitié haute - Matin */}
                    <div
                      onClick={() => handleHalfDayClick(day.date, 'matin')}
                      className={`flex-1 rounded-md sm:rounded-lg transition-all ${bgAM} ${
                        clickableAM ? 'cursor-pointer hover:brightness-90' : 'cursor-default'
                      }`}
                    />
                    {/* Moitié basse - Après-midi */}
                    <div
                      onClick={() => handleHalfDayClick(day.date, 'apres_midi')}
                      className={`flex-1 rounded-md sm:rounded-lg transition-all ${bgPM} ${
                        clickablePM ? 'cursor-pointer hover:brightness-90' : 'cursor-default'
                      }`}
                    />
                  </div>
                  {/* Numéro du jour */}
                  <span className={`absolute inset-0 flex items-center justify-center z-10 pointer-events-none font-medium text-sm sm:text-lg ${textClass}`}>
                    {day.date.getDate()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sélection en cours (un seul clic) */}
      {startDate && startPeriod && !endDate && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            Début : <span className="font-semibold">{formatDateFR(startDate)} ({formatPeriodLabel(startPeriod)})</span>
          </p>
          <p className="text-xs text-blue-500 mt-1">Cliquez sur une demi-journée de fin pour compléter la sélection</p>
        </div>
      )}

      {/* Boutons Annuler et Continuer */}
      {startDate && endDate && startPeriod && endPeriod && (
        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex-1 mb-1 sm:mb-0">
            <p className="text-sm font-semibold text-gray-800">
              {getSelectionSummary()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex-1 sm:flex-none px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 sm:flex-none px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
            >
              Continuer
            </button>
          </div>
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
                {getSelectionSummary()}
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

            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-3 py-2 text-sm sm:text-base bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitRequest}
                className="flex-1 px-3 py-2 text-sm sm:text-base bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
              >
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveCalendar;
