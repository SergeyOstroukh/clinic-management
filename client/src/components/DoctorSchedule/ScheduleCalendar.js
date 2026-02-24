import React, { useState } from 'react';
import './ScheduleCalendar.css';
import TimeSlots from './TimeSlots';

// Утилита для форматирования даты БЕЗ timezone проблем (как в BookingCalendarV2)
const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const DAYS_OF_WEEK_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const ScheduleCalendar = ({ 
  schedules, 
  specificDates, 
  onDateClick, 
  canEdit,
  multiSelectMode,
  selectedDates,
  onDateSelect,
  doctorId  // Добавляем doctorId для TimeSlots
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayForSlots, setSelectedDayForSlots] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Проверяем, есть ли расписание на конкретную дату (несколько слотов в день поддерживаются)
  const getScheduleForDate = (date) => {
    const dayOfWeek = date.getDay();
    const dateStr = formatDateLocal(date);

    // Точечные даты (приоритет) — может быть несколько слотов в один день
    const specificForDay = specificDates.filter(d => d.work_date === dateStr);

    if (specificForDay.length > 0) {
      return {
        type: 'specific',
        times: specificForDay.map(d => `${d.start_time} - ${d.end_time}`),
        ids: specificForDay.map(d => d.id),
        items: specificForDay
      };
    }

    // Регулярное расписание
    const regularSlots = schedules.filter(s => s.day_of_week === dayOfWeek);

    if (regularSlots.length > 0) {
      return {
        type: 'regular',
        times: regularSlots.map(s => `${s.start_time} - ${s.end_time}`),
        ids: regularSlots.map(s => s.id)
      };
    }

    return null;
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isPast = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isDateSelected = (date) => {
    if (!selectedDates || !multiSelectMode) return false;
    const dateStr = formatDateLocal(date);
    return selectedDates.some(d => formatDateLocal(d) === dateStr);
  };

  const handleDayClick = (date, schedule) => {
    if (multiSelectMode && canEdit) {
      onDateSelect(date);
    } else if (canEdit) {
      onDateClick(date, schedule);
    } else if (schedule) {
      // Если нельзя редактировать, но есть расписание - показываем слоты
      setSelectedDayForSlots(date);
    }
  };

  const handleViewSlots = (date, schedule) => {
    // Показать слоты для выбранного дня
    setSelectedDayForSlots(selectedDayForSlots?.toDateString() === date.toDateString() ? null : date);
  };

  // Генерируем дни календаря
  const calendarDays = [];
  
  // Пустые ячейки до начала месяца
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  
  // Дни месяца
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  return (
    <div className="schedule-calendar">
      <div className="calendar-header">
        <button className="btn btn-small" onClick={prevMonth}>
          ← Предыдущий
        </button>
        <div className="calendar-title">
          <h3>{MONTHS[month]} {year}</h3>
          <button className="btn-today" onClick={goToToday}>
            Сегодня
          </button>
        </div>
        <button className="btn btn-small" onClick={nextMonth}>
          Следующий →
        </button>
      </div>

      <div className="calendar-grid">
        {/* Заголовки дней недели */}
        {DAYS_OF_WEEK_SHORT.map(day => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}

        {/* Дни месяца */}
        {calendarDays.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="calendar-day empty" />;
          }

          const schedule = getScheduleForDate(date);
          const hasSchedule = !!schedule;
          const isCurrentDay = isToday(date);
          const isPastDay = isPast(date);
          const selected = isDateSelected(date);
          const isSelectedForSlots = selectedDayForSlots?.toDateString() === date.toDateString();

          return (
            <div
              key={formatDateLocal(date)}
              className={`calendar-day ${hasSchedule ? 'has-schedule' : ''} ${
                isCurrentDay ? 'today' : ''
              } ${isPastDay ? 'past' : ''} ${canEdit ? 'editable' : ''} ${
                selected ? 'selected' : ''
              } ${isSelectedForSlots ? 'viewing-slots' : ''}`}
              onClick={() => handleDayClick(date, schedule)}
              title={hasSchedule ? schedule.times.join(', ') : 'Нет расписания'}
            >
              <div className="day-number">{date.getDate()}</div>
              {hasSchedule && (
                <div className="day-schedule">
                  {schedule.type === 'specific' && schedule.times.map((time, idx) => (
                    <div key={schedule.ids ? schedule.ids[idx] : idx} className="schedule-badge specific">
                      📍 {time}
                    </div>
                  ))}
                  {schedule.type === 'regular' && (
                    <div className="schedule-badge regular">
                      🔄 {schedule.times.join(', ')}
                    </div>
                  )}
                  {/* Кнопка для просмотра слотов */}
                  {!canEdit && (
                    <button 
                      className="view-slots-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewSlots(date, schedule);
                      }}
                    >
                      {isSelectedForSlots ? '✖' : '👁'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-box specific"></div>
          <span>Точечная дата</span>
        </div>
        <div className="legend-item">
          <div className="legend-box regular"></div>
          <span>Регулярное расписание</span>
        </div>
        <div className="legend-item">
          <div className="legend-box today"></div>
          <span>Сегодня</span>
        </div>
        {!canEdit && (
          <div className="legend-item">
            <span style={{ color: '#667eea', fontWeight: 500 }}>👁 Нажмите на день для просмотра слотов</span>
          </div>
        )}
      </div>

      {/* Отображение временных слотов для выбранного дня */}
      {selectedDayForSlots && doctorId && (
        <div className="time-slots-section">
          <div className="time-slots-header-info">
            <h3>
              📅 Слоты на {selectedDayForSlots.toLocaleDateString('ru-RU', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long',
                year: 'numeric'
              })}
            </h3>
            <button 
              className="btn-close-slots"
              onClick={() => setSelectedDayForSlots(null)}
            >
              ✖ Закрыть
            </button>
          </div>
          {(() => {
            const schedule = getScheduleForDate(selectedDayForSlots);
            if (!schedule) {
              return <div className="no-schedule-message">Нет расписания на этот день</div>;
            }

            const dateStr = formatDateLocal(selectedDayForSlots);
            const ranges = [];

            if (schedule.type === 'specific' && schedule.items) {
              schedule.items.forEach(item => {
                ranges.push({ startTime: item.start_time, endTime: item.end_time });
              });
            } else if (schedule.type === 'specific' && schedule.ids) {
              schedule.ids.forEach(id => {
                const dateObj = specificDates.find(d => d.id === id);
                if (dateObj) ranges.push({ startTime: dateObj.start_time, endTime: dateObj.end_time });
              });
            } else if (schedule.type === 'regular' && schedule.ids) {
              schedule.ids.forEach(id => {
                const s = schedules.find(r => r.id === id);
                if (s) ranges.push({ startTime: s.start_time, endTime: s.end_time });
              });
            }

            if (ranges.length === 0) {
              return <div className="no-schedule-message">Не удалось определить время работы</div>;
            }

            return (
              <div className="time-slots-ranges">
                {ranges.map((range, idx) => (
                  <div key={idx} className="time-slots-range-block">
                    {ranges.length > 1 && (
                      <div className="time-slots-range-label">
                        {range.startTime} – {range.endTime}
                      </div>
                    )}
                    <TimeSlots
                      doctorId={doctorId}
                      date={dateStr}
                      startTime={range.startTime}
                      endTime={range.endTime}
                      intervalMinutes={30}
                    />
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default ScheduleCalendar;

