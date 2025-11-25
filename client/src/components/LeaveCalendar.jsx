import { useState, useEffect } from 'react';
import { leaveAPI, holidayAPI } from '../services/api';
import { formatDateFR } from '../utils/dateUtils';

const LeaveCalendar = () => {
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateInfo, setDateInfo] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [leavesRes, holidaysRes] = await Promise.all([
        leaveAPI.getCalendar(),
        holidayAPI.getAllHolidays(),
      ]);

      setLeaves(leavesRes.data.events);
      setHolidays(holidaysRes.data.holidays);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    }
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

  const formatDateToYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDayClassName = (date, isCurrentMonth) => {
    const dateStr = formatDateToYYYYMMDD(date);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
    const isSelected = selectedDate &&
                       date.getDate() === selectedDate.getDate() &&
                       date.getMonth() === selectedDate.getMonth() &&
                       date.getFullYear() === selectedDate.getFullYear();

    let classes = 'h-10 w-10 flex items-center justify-center rounded-full cursor-pointer transition-colors ';

    if (!isCurrentMonth) {
      classes += 'text-gray-300 ';
    } else {
      // Vérifier si c'est un jour férié
      const isHoliday = holidays.some(h => h.date === dateStr);
      if (isHoliday) {
        classes += 'bg-purple-100 text-purple-800 font-semibold ';
      } else {
        // Vérifier si quelqu'un est en congé
        const hasLeave = leaves.some(leave => {
          const startStr = leave.date_debut.split('T')[0];
          const endStr = leave.date_fin.split('T')[0];
          return dateStr >= startStr && dateStr <= endStr;
        });

        if (hasLeave) {
          classes += 'bg-orange-100 text-orange-800 ';
        } else {
          classes += 'text-gray-700 hover:bg-gray-100 ';
        }
      }
    }

    if (isToday && isCurrentMonth) {
      classes += 'ring-2 ring-blue-500 ';
    }

    if (isSelected) {
      classes += 'bg-blue-500 text-white hover:bg-blue-600 ';
    }

    return classes;
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    const dateStr = formatDateToYYYYMMDD(date);

    // Trouver les congés pour cette date
    const leavesOnDate = leaves.filter(leave => {
      const startStr = leave.date_debut.split('T')[0];
      const endStr = leave.date_fin.split('T')[0];
      return dateStr >= startStr && dateStr <= endStr;
    });

    // Trouver le jour férié
    const holiday = holidays.find(h => h.date === dateStr);

    setDateInfo({
      date: formatDateFR(date),
      leaves: leavesOnDate,
      holiday,
    });
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
    handleDateClick(today);
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Calendrier des absences
      </h2>

      {/* Navigation du calendrier */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Mois précédent"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex flex-col items-center">
            <h3 className="text-lg font-semibold text-gray-800">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            <button
              onClick={goToToday}
              className="text-sm text-blue-600 hover:text-blue-800 mt-1"
            >
              Aujourd'hui
            </button>
          </div>

          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Mois suivant"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Grille du calendrier */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* En-têtes des jours */}
          <div className="grid grid-cols-7 bg-gray-50">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center py-2 text-sm font-semibold text-gray-600 border-b border-gray-200"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Jours du mois */}
          <div className="grid grid-cols-7">
            {days.map((day, index) => (
              <div
                key={index}
                className="border-b border-r border-gray-100 p-1 min-h-[3rem] flex items-center justify-center"
              >
                <button
                  onClick={() => handleDateClick(day.date)}
                  className={getDayClassName(day.date, day.isCurrentMonth)}
                >
                  {day.date.getDate()}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Légende */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
          <span className="text-sm text-gray-600">Jour férié</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
          <span className="text-sm text-gray-600">Absence(s)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className="text-sm text-gray-600">Date sélectionnée</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
          <span className="text-sm text-gray-600">Aujourd'hui</span>
        </div>
      </div>

      {/* Informations de la date sélectionnée */}
      {dateInfo && (
        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-800 mb-2">
            {dateInfo.date}
          </h3>

          {dateInfo.holiday && (
            <div className="bg-purple-50 border border-purple-200 rounded p-2 mb-2">
              <p className="text-sm font-medium text-purple-800">
                🎉 {dateInfo.holiday.nom}
              </p>
            </div>
          )}

          {dateInfo.leaves.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                Personnes absentes :
              </p>
              {dateInfo.leaves.map((leave) => (
                <div
                  key={leave.id}
                  className="bg-orange-50 border border-orange-200 rounded p-2"
                >
                  <p className="text-sm font-medium text-gray-800">
                    {leave.prenom} {leave.nom}
                  </p>
                  <p className="text-xs text-gray-600">
                    {leave.type_utilisateur} • Du {formatDateFR(leave.date_debut)} au {formatDateFR(leave.date_fin)}
                  </p>
                </div>
              ))}
            </div>
          ) : !dateInfo.holiday && (
            <p className="text-sm text-gray-500">Aucune absence ce jour</p>
          )}
        </div>
      )}
    </div>
  );
};

export default LeaveCalendar;
