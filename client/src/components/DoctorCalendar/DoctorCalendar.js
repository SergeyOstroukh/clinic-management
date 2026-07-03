import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSocketEvent } from '../../hooks/useSocket';
import './DoctorCalendar.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const DAYS_OF_WEEK = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const SLOT_INTERVAL_MINUTES = 15;

const formatDate = (year, month, day) => {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const DoctorCalendar = ({ currentUser, onAppointmentClick }) => {
  const [appointments, setAppointments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [specificDates, setSpecificDates] = useState([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDayAppointments, setSelectedDayAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.doctor_id) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, currentYear, currentMonth]);

  useEffect(() => {
    if (selectedDate) {
      loadDayAppointments(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, appointments]);

  // Socket.IO: обновляем данные при изменении записей в реальном времени
  useSocketEvent('appointmentUpdated', useCallback(() => {
    if (currentUser?.doctor_id) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.doctor_id, currentYear, currentMonth]));

  useSocketEvent('appointmentCreated', useCallback(() => {
    if (currentUser?.doctor_id) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.doctor_id, currentYear, currentMonth]));

  const loadData = async () => {
    try {
      setLoading(true);
      const [appointmentsRes, schedulesRes, datesRes] = await Promise.all([
        axios.get(`${API_URL}/doctors/${currentUser.doctor_id}/monthly-appointments?month=${currentMonth}&year=${currentYear}`),
        axios.get(`${API_URL}/schedules?doctor_id=${currentUser.doctor_id}`),
        axios.get(`${API_URL}/specific-dates?doctor_id=${currentUser.doctor_id}`)
      ]);
      
      setAppointments(appointmentsRes.data.filter(apt => apt.status !== 'cancelled'));
      setSchedules(schedulesRes.data);
      setSpecificDates(datesRes.data);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDayAppointments = async (date) => {
    const dateStr = formatDate(date.year, date.month, date.day);
    const dayAppointments = appointments.filter(apt => {
      if (!apt.appointment_date) return false;
      let normalizedDate = apt.appointment_date.replace('T', ' ');
      if (normalizedDate.includes('Z')) normalizedDate = normalizedDate.replace('Z', '');
      if (normalizedDate.includes('+')) normalizedDate = normalizedDate.split('+')[0];
      return normalizedDate.startsWith(dateStr);
    });
    
    // Загружаем детали для каждой записи (клиент, услуги)
    try {
      const detailedAppointments = await Promise.all(dayAppointments.map(async (apt) => {
        try {
          // Получаем клиента
          const clientRes = await axios.get(`${API_URL}/clients/${apt.client_id}`);
          const client = clientRes.data;
          
          // Услуги уже должны быть в apt.services из monthly-appointments
          const services = apt.services || [];
          
          return {
            ...apt,
            client: client,
            services: services
          };
        } catch (error) {
          console.error('Ошибка загрузки деталей записи:', error);
          return apt;
        }
      }));
      
      setSelectedDayAppointments(detailedAppointments.sort((a, b) => 
        a.appointment_date.localeCompare(b.appointment_date)
      ));
    } catch (error) {
      console.error('Ошибка загрузки записей дня:', error);
    }
  };

  const getDaySchedule = (year, month, day) => {
    const dateStr = formatDate(year, month, day);
    const dayOfWeek = new Date(year, month - 1, day).getDay();

    // Проверяем точечные даты
    const specificDate = specificDates.find(sd => sd.work_date === dateStr && sd.is_active);
    if (specificDate) {
      return [{ start_time: specificDate.start_time, end_time: specificDate.end_time }];
    }

    // Проверяем регулярное расписание
    const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeek && s.is_active);
    return daySchedules.map(s => ({ start_time: s.start_time, end_time: s.end_time }));
  };

  const getDayAppointments = (year, month, day) => {
    const dateStr = formatDate(year, month, day);
    return appointments.filter(apt => {
      if (!apt.appointment_date) return false;
      let normalizedDate = apt.appointment_date.replace('T', ' ');
      if (normalizedDate.includes('Z')) normalizedDate = normalizedDate.replace('Z', '');
      if (normalizedDate.includes('+')) normalizedDate = normalizedDate.split('+')[0];
      return normalizedDate.startsWith(dateStr);
    });
  };

  const getDayStatus = (year, month, day) => {
    const schedule = getDaySchedule(year, month, day);
    if (schedule.length === 0) return 'no-schedule';

    const dayAppointments = getDayAppointments(year, month, day);
    if (dayAppointments.length === 0) return 'available';
    return 'has-appointments';
  };

  const isPastDate = (year, month, day) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(year, month - 1, day);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const parseTime = (dateTimeStr) => {
    if (!dateTimeStr) return { hours: 0, minutes: 0 };
    let normalized = dateTimeStr.replace('T', ' ');
    if (normalized.includes('Z')) normalized = normalized.replace('Z', '');
    if (normalized.includes('+')) normalized = normalized.split('+')[0];
    const timePart = normalized.split(' ')[1];
    if (!timePart) return { hours: 0, minutes: 0 };
    const parts = timePart.split(':');
    return {
      hours: parseInt(parts[0]) || 0,
      minutes: parseInt(parts[1]) || 0
    };
  };

  const formatTime = (dateTimeStr) => {
    const time = parseTime(dateTimeStr);
    return `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`;
  };

  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = String(timeStr).split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const generateTimeSlots = (startTime, endTime) => {
    const slots = [];
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    let currentH = startH;
    let currentM = startM;

    while (currentH < endH || (currentH === endH && currentM < endM)) {
      slots.push(`${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`);
      currentM += SLOT_INTERVAL_MINUTES;
      if (currentM >= 60) {
        currentM = 0;
        currentH += 1;
      }
    }

    return slots;
  };

  const isSlotBlockedByAppointment = (slotTimeStr, dayAppointments) => {
    const slotMinutes = timeToMinutes(slotTimeStr);

    for (const apt of dayAppointments) {
      if (apt.status === 'cancelled') continue;

      const aptTime = parseTime(apt.appointment_date);
      const aptMinutes = aptTime.hours * 60 + aptTime.minutes;
      const aptDuration = apt.duration || 30;

      if (slotMinutes >= aptMinutes && slotMinutes < aptMinutes + aptDuration) {
        return {
          blocked: true,
          appointment: apt,
          isAppointmentStart: slotMinutes === aptMinutes
        };
      }
    }

    return { blocked: false, appointment: null, isAppointmentStart: false };
  };

  const formatAppointmentTimeRange = (appointment) => {
    const startTime = formatTime(appointment.appointment_date);
    const duration = appointment.duration || 30;
    const endTime = minutesToTime(timeToMinutes(startTime) + duration);
    return `${startTime} — ${endTime}`;
  };

  const getDayTimeline = (year, month, day) => {
    const schedule = getDaySchedule(year, month, day);
    if (schedule.length === 0) {
      return { hasSchedule: false, items: [] };
    }

    const dayAppointments = getDayAppointments(year, month, day);
    const slotSet = new Set();

    schedule.forEach((range) => {
      generateTimeSlots(range.start_time, range.end_time).forEach((time) => slotSet.add(time));
    });

    const allSlots = Array.from(slotSet).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    const now = new Date();
    const items = [];

    allSlots.forEach((slotTime) => {
      const [slotHour, slotMinute] = slotTime.split(':').map(Number);
      const slotDateTime = new Date(year, month - 1, day, slotHour, slotMinute, 0, 0);
      const isPast = slotDateTime.getTime() < now.getTime();
      const blockCheck = isSlotBlockedByAppointment(slotTime, dayAppointments);

      if (blockCheck.blocked) {
        if (!blockCheck.isAppointmentStart) return;

        const detailedAppointment = selectedDayAppointments.find((apt) => apt.id === blockCheck.appointment.id)
          || blockCheck.appointment;

        items.push({
          type: 'appointment',
          key: `apt-${detailedAppointment.id}`,
          time: slotTime,
          appointment: detailedAppointment,
          isPast
        });
        return;
      }

      items.push({
        type: 'free',
        key: `free-${slotTime}`,
        time: slotTime,
        endTime: minutesToTime(timeToMinutes(slotTime) + SLOT_INTERVAL_MINUTES),
        isPast
      });
    });

    return { hasSchedule: true, items };
  };

  const handleDayClick = (year, month, day) => {
    setSelectedDate({ year, month, day });
  };

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
  };

  // Генерация календаря
  const getCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Пустые ячейки до первого дня месяца
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ year: currentYear, month: currentMonth, day });
    }
    
    return days;
  };

  const calendarDays = getCalendarDays();
  const today = new Date();
  const isToday = (year, month, day) => {
    return year === today.getFullYear() && 
           month === today.getMonth() + 1 && 
           day === today.getDate();
  };

  const selectedDayTimeline = selectedDate
    ? getDayTimeline(selectedDate.year, selectedDate.month, selectedDate.day)
    : { hasSchedule: false, items: [] };

  if (loading) {
    return <div className="doctor-calendar-loading">Загрузка...</div>;
  }

  return (
    <div className="doctor-calendar">
      {/* Заголовок календаря */}
      <div className="calendar-header">
        <button className="btn-nav" onClick={handlePrevMonth}>←</button>
        <h3>
          {MONTHS[currentMonth - 1]} {currentYear}
        </h3>
        <button className="btn-nav" onClick={handleNextMonth}>→</button>
        <button className="btn-today" onClick={handleToday}>Сегодня</button>
      </div>

      <div className="calendar-container">
        {/* Календарь */}
        <div className={`calendar-grid ${selectedDate ? 'with-panel' : ''}`}>
          {/* Дни недели */}
          <div className="calendar-weekdays">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="weekday">{day}</div>
            ))}
          </div>

          {/* Дни месяца */}
          <div className="calendar-days">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="calendar-day empty"></div>;
              }

              const status = getDayStatus(day.year, day.month, day.day);
              const dayAppointments = getDayAppointments(day.year, day.month, day.day);
              const isSelected = selectedDate && 
                selectedDate.year === day.year && 
                selectedDate.month === day.month && 
                selectedDate.day === day.day;
              const isPast = isPastDate(day.year, day.month, day.day);

              return (
                <div
                  key={`${day.year}-${day.month}-${day.day}`}
                  className={`calendar-day ${status} ${isToday(day.year, day.month, day.day) ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isPast ? 'past' : ''}`}
                  onClick={() => handleDayClick(day.year, day.month, day.day)}
                >
                  <div className="day-number">{day.day}</div>
                  {dayAppointments.length > 0 && (
                    <div className="day-appointments-count">
                      {dayAppointments.length} {dayAppointments.length === 1 ? 'запись' : 'записей'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Панель с записями выбранного дня */}
        {selectedDate && (
          <div className="day-appointments-panel">
            <div className="panel-header">
              <h4>
                {selectedDate.day} {MONTHS[selectedDate.month - 1]} {selectedDate.year}
              </h4>
              <button className="btn-close" onClick={() => setSelectedDate(null)}>×</button>
            </div>

            {selectedDayTimeline.hasSchedule ? (
              selectedDayTimeline.items.length === 0 ? (
                <div className="no-appointments">
                  <p>Нет слотов на этот день</p>
                </div>
              ) : (
                <div className="appointments-list day-timeline-list">
                  {selectedDayTimeline.items.map((item) => {
                    if (item.type === 'free') {
                      return (
                        <div
                          key={item.key}
                          className={`free-slot-card ${item.isPast ? 'past' : ''}`}
                        >
                          <div className="free-slot-time">
                            {item.time} — {item.endTime}
                          </div>
                          <div className="free-slot-label">Свободное время</div>
                        </div>
                      );
                    }

                    const apt = item.appointment;
                    return (
                      <div
                        key={item.key}
                        className={`appointment-card status-${apt.status} ${item.isPast ? 'past' : ''}`}
                        onClick={() => onAppointmentClick && onAppointmentClick(apt)}
                      >
                        <div className="appointment-time">{formatAppointmentTimeRange(apt)}</div>
                        <div className="appointment-client">
                          <strong>
                            {apt.client?.lastName || apt.client_lastName} {apt.client?.firstName || apt.client_firstName}
                            {apt.client?.middleName && ` ${apt.client.middleName}`}
                          </strong>
                          {apt.client?.phone && (
                            <div className="client-phone">📞 {apt.client.phone}</div>
                          )}
                        </div>
                        <div className="appointment-services">
                          {apt.services && apt.services.length > 0 ? (
                            <div>
                              <strong>Услуги:</strong>
                              <ul>
                                {apt.services.map((service, idx) => (
                                  <li key={idx}>
                                    {service.name} {service.quantity > 1 && `(x${service.quantity})`}
                                    {service.price && ` - ${service.price} ₽`}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <div className="no-services">Услуги не указаны</div>
                          )}
                        </div>
                        <div className="appointment-status">
                          {apt.status === 'scheduled' && '📅 Запланировано'}
                          {apt.status === 'waiting' && '⏳ Ожидает'}
                          {apt.status === 'in-progress' && '🔄 На приеме'}
                          {apt.status === 'completed' && '✅ Завершено'}
                          {apt.status === 'ready_for_payment' && '💰 Готово к оплате'}
                          {apt.status === 'cancelled' && '❌ Отменено'}
                        </div>
                        {apt.notes && (
                          <div className="appointment-notes">
                            <strong>Примечания:</strong> {apt.notes}
                          </div>
                        )}
                        {apt.diagnosis && (
                          <div className="appointment-diagnosis">
                            <strong>Диагноз:</strong> {apt.diagnosis}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="no-appointments">
                <p>Нет расписания на этот день</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Легенда */}
      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-color no-schedule"></div>
          <span>Нет расписания</span>
        </div>
        <div className="legend-item">
          <div className="legend-color available"></div>
          <span>Свободно</span>
        </div>
        <div className="legend-item">
          <div className="legend-color has-appointments"></div>
          <span>Есть записи</span>
        </div>
        <div className="legend-item">
          <div className="legend-color free-slot"></div>
          <span>Свободный слот</span>
        </div>
      </div>
    </div>
  );
};

export default DoctorCalendar;

