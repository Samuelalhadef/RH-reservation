'use client';

import { useState, useEffect } from 'react';
import { formatDateFR } from '@/lib/clientDateUtils';

const TeamCalendar = () => {
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipData, setTooltipData] = useState(null);
  const [hoveredTooltip, setHoveredTooltip] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const dayNames = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const fetchData = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;

      const [leavesRes, holidaysRes] = await Promise.all([
        fetch(`/api/leaves/team-calendar?year=${year}&month=${month}`).then(r => r.json()),
        fetch('/api/holidays/all').then(r => r.json()),
      ]);

      setLeaves(leavesRes.events || []);
      setHolidays(holidaysRes.holidays || []);
    } catch (error) {
      console.error('Error fetching team calendar data:', error);
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

  // Récupérer les congés pour une demi-journée spécifique
  const getLeavesForHalfDay = (dateStr, period) => {
    const date = new Date(dateStr + 'T00:00:00');
    if (isWeekend(date)) return [];

    return leaves.filter(leave => {
      const startStr = leave.date_debut.split('T')[0];
      const endStr = leave.date_fin.split('T')[0];

      if (dateStr < startStr || dateStr > endStr) return false;

      const typeDebut = leave.type_debut || 'journee_complete';
      const typeFin = leave.type_fin || 'journee_complete';

      if (dateStr > startStr && dateStr < endStr) return true;

      if (dateStr === startStr && dateStr === endStr) {
        if (typeDebut === 'journee_complete' && typeFin === 'journee_complete') return true;
        if (typeDebut === 'matin' && typeFin === 'matin') return period === 'matin';
        if (typeDebut === 'apres_midi' && typeFin === 'apres_midi') return period === 'apres_midi';
        if (typeDebut === 'matin' && typeFin === 'apres_midi') return true;
        if (typeDebut === 'apres_midi') return period === 'apres_midi';
        if (typeFin === 'matin') return period === 'matin';
        return true;
      }

      if (dateStr === startStr) {
        if (typeDebut === 'apres_midi') return period === 'apres_midi';
        return true;
      }

      if (dateStr === endStr) {
        if (typeFin === 'matin') return period === 'matin';
        return true;
      }

      return false;
    });
  };

  const handleDateHover = (event, date, isCurrentMonth) => {
    if (!isCurrentMonth) {
      setHoveredTooltip(null);
      return;
    }

    const dateStr = formatDateToYYYYMMDD(date);
    const leavesAM = getLeavesForHalfDay(dateStr, 'matin');
    const leavesPM = getLeavesForHalfDay(dateStr, 'apres_midi');
    const isHoliday = holidays.find(h => h.date === dateStr);

    if (leavesAM.length > 0 || leavesPM.length > 0 || isHoliday) {
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
      setHoveredTooltip({
        date: date,
        leavesAM,
        leavesPM,
        holiday: isHoliday
      });
      setTooltipData({
        date: date,
        leavesAM,
        leavesPM,
        holiday: isHoliday
      });
      setShowTooltip(true);
    } else {
      setHoveredTooltip(null);
      setShowTooltip(false);
    }
  };

  const handleMouseLeave = () => {
    setHoveredTooltip(null);
  };

  const getPersonColor = (index) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-pink-500',
      'bg-purple-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-orange-500',
      'bg-teal-500',
      'bg-cyan-500',
    ];
    return colors[index % colors.length];
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
      {/* Tooltip flottant au survol */}
      {hoveredTooltip && (hoveredTooltip.leavesAM?.length > 0 || hoveredTooltip.leavesPM?.length > 0) && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-sm whitespace-nowrap">
            {hoveredTooltip.leavesAM?.length > 0 && (
              <div className="mb-1">
                <p className="text-xs text-gray-400 font-bold">Matin :</p>
                {hoveredTooltip.leavesAM.map((leave, idx) => (
                  <div key={`am-${leave.id}`} className="flex items-center gap-2 py-0.5">
                    <div className={`w-2 h-2 rounded-full ${getPersonColor(idx)}`}></div>
                    <span>{leave.prenom} {leave.nom}</span>
                  </div>
                ))}
              </div>
            )}
            {hoveredTooltip.leavesPM?.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 font-bold">Après-midi :</p>
                {hoveredTooltip.leavesPM.map((leave, idx) => (
                  <div key={`pm-${leave.id}`} className="flex items-center gap-2 py-0.5">
                    <div className={`w-2 h-2 rounded-full ${getPersonColor(idx)}`}></div>
                    <span>{leave.prenom} {leave.nom}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Calendrier de l'équipe {currentYear}</h2>
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
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-100 border-2 border-purple-300 rounded"></div>
          <span className="text-gray-600">Jour férié</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 rounded overflow-hidden flex">
            <div className="flex-1 bg-blue-500"></div>
          </div>
          <span className="text-gray-600">1 personne</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 rounded overflow-hidden flex">
            <div className="flex-1 bg-blue-500"></div>
            <div className="flex-1 bg-green-500"></div>
          </div>
          <span className="text-gray-600">2+ personnes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded overflow-hidden flex flex-col">
            <div className="flex-1 bg-blue-300"></div>
            <div className="flex-1"></div>
          </div>
          <span className="text-gray-600">Haut = matin, Bas = après-midi</span>
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
        <div className="grid grid-cols-7 gap-2 relative">
          {days.map((day, index) => {
            const dateStr = formatDateToYYYYMMDD(day.date);
            const leavesAM = getLeavesForHalfDay(dateStr, 'matin');
            const leavesPM = getLeavesForHalfDay(dateStr, 'apres_midi');
            const isHoliday = holidays.some(h => h.date === dateStr);
            const today = new Date();
            const isToday = day.date.getDate() === today.getDate() &&
                            day.date.getMonth() === today.getMonth() &&
                            day.date.getFullYear() === today.getFullYear();

            const hasAnyLeave = leavesAM.length > 0 || leavesPM.length > 0;

            return (
              <div
                key={index}
                className={`w-full aspect-square relative transition-all font-medium text-lg ${
                  isToday && day.isCurrentMonth ? 'ring-2 ring-blue-500 rounded-xl' : ''
                } ${day.isCurrentMonth ? 'cursor-pointer' : ''}`}
                onMouseEnter={(e) => handleDateHover(e, day.date, day.isCurrentMonth)}
                onMouseLeave={handleMouseLeave}
              >
                {/* Deux moitiés avec gap */}
                <div className="absolute inset-0 flex flex-col gap-1">
                  {day.isCurrentMonth && !isWeekend(day.date) && !isHoliday ? (
                    <>
                      {/* Moitié haute - Matin */}
                      <div className={`flex-1 rounded-lg overflow-hidden flex ${leavesAM.length > 0 ? '' : ''}`}>
                        {leavesAM.length > 0 ? (
                          leavesAM.map((leave, idx) => (
                            <div
                              key={leave.id}
                              className={`flex-1 ${getPersonColor(idx)}`}
                            ></div>
                          ))
                        ) : null}
                      </div>
                      {/* Moitié basse - Après-midi */}
                      <div className={`flex-1 rounded-lg overflow-hidden flex ${leavesPM.length > 0 ? '' : ''}`}>
                        {leavesPM.length > 0 ? (
                          leavesPM.map((leave, idx) => (
                            <div
                              key={leave.id}
                              className={`flex-1 ${getPersonColor(idx)}`}
                            ></div>
                          ))
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Jour férié ou weekend - deux moitiés même couleur */}
                      <div className={`flex-1 rounded-lg ${
                        day.isCurrentMonth && isHoliday ? 'bg-purple-100 border border-purple-300' :
                        day.isCurrentMonth && isWeekend(day.date) ? 'bg-gray-100' : ''
                      }`} />
                      <div className={`flex-1 rounded-lg ${
                        day.isCurrentMonth && isHoliday ? 'bg-purple-100 border border-purple-300' :
                        day.isCurrentMonth && isWeekend(day.date) ? 'bg-gray-100' : ''
                      }`} />
                    </>
                  )}
                </div>

                {/* Numéro du jour */}
                <span className={`absolute inset-0 flex items-center justify-center z-10 pointer-events-none ${
                  day.isCurrentMonth && (hasAnyLeave || isHoliday)
                    ? 'text-white font-bold drop-shadow-md'
                    : day.isCurrentMonth
                      ? isWeekend(day.date) ? 'text-gray-400' : 'text-gray-700'
                      : 'text-gray-300'
                }`}>
                  {day.date.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip détaillé en bas */}
      {showTooltip && tooltipData && (
        <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <h3 className="font-bold text-gray-800 mb-3">
            {formatDateFR(tooltipData.date)}
          </h3>

          {tooltipData.holiday && (
            <div className="mb-3 p-2 bg-purple-50 rounded border border-purple-200">
              <p className="text-sm font-semibold text-purple-800">
                {tooltipData.holiday.nom}
              </p>
            </div>
          )}

          {tooltipData.leavesAM?.length > 0 && (
            <div className="mb-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Matin - {tooltipData.leavesAM.length} personne{tooltipData.leavesAM.length > 1 ? 's' : ''} en congé :
              </p>
              <div className="space-y-2">
                {tooltipData.leavesAM.map((leave, idx) => (
                  <div key={`am-${leave.id}`} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
                    <div className={`w-4 h-4 rounded ${getPersonColor(idx)} flex-shrink-0 mt-0.5`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800">
                        {leave.prenom} {leave.nom}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Du {formatDateFR(leave.date_debut)} au {formatDateFR(leave.date_fin)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {leave.nombre_jours_ouvres} jour{leave.nombre_jours_ouvres > 1 ? 's' : ''} ouvrés
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tooltipData.leavesPM?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Après-midi - {tooltipData.leavesPM.length} personne{tooltipData.leavesPM.length > 1 ? 's' : ''} en congé :
              </p>
              <div className="space-y-2">
                {tooltipData.leavesPM.map((leave, idx) => (
                  <div key={`pm-${leave.id}`} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
                    <div className={`w-4 h-4 rounded ${getPersonColor(idx)} flex-shrink-0 mt-0.5`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800">
                        {leave.prenom} {leave.nom}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Du {formatDateFR(leave.date_debut)} au {formatDateFR(leave.date_fin)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {leave.nombre_jours_ouvres} jour{leave.nombre_jours_ouvres > 1 ? 's' : ''} ouvrés
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeamCalendar;
