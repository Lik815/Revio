import { useState } from 'react';
import { addDays, startOfDay, startOfWeek } from '../utils/app-utils';

// Owns the Termine-tab's view-mode (Liste/Kalender) plus every piece of date
// navigation state that goes with it — the week strip's visible week, the
// day timeline's selected day, and the month calendar's visible month.
export function useTherapistCalendarView() {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => startOfWeek(new Date()));
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [visibleMonth, setVisibleMonth] = useState(() => ({
    year: startOfDay(new Date()).getFullYear(),
    month: startOfDay(new Date()).getMonth(),
  }));

  const handleOpenCalendar = () => {
    setVisibleMonth({ year: selectedDate.getFullYear(), month: selectedDate.getMonth() });
    setViewMode('calendar');
  };

  const handleShowList = () => setViewMode('list');

  const handleSelectCalendarDate = (date) => {
    setSelectedDate(startOfDay(date));
    setVisibleWeekStart(startOfWeek(date));
  };

  const handlePrevWeek = () => setVisibleWeekStart((prev) => addDays(prev, -7));
  const handleNextWeek = () => setVisibleWeekStart((prev) => addDays(prev, 7));

  const handlePrevMonth = () => {
    setVisibleMonth((prev) => {
      const d = new Date(prev.year, prev.month - 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const handleNextMonth = () => {
    setVisibleMonth((prev) => {
      const d = new Date(prev.year, prev.month + 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const handleGoToToday = () => {
    const today = startOfDay(new Date());
    setSelectedDate(today);
    setVisibleWeekStart(startOfWeek(today));
    setVisibleMonth({ year: today.getFullYear(), month: today.getMonth() });
  };

  return {
    selectedDate,
    setSelectedDate,
    visibleWeekStart,
    viewMode,
    visibleMonth,
    handleOpenCalendar,
    handleShowList,
    handleSelectCalendarDate,
    handlePrevWeek,
    handleNextWeek,
    handlePrevMonth,
    handleNextMonth,
    handleGoToToday,
  };
}
