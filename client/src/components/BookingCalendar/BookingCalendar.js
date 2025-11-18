import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import './BookingCalendar.css';

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

const DAYS_OF_WEEK_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const BookingCalendar = ({ currentUser, onBack }) => {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [specificDates, setSpecificDates] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showAppointmentInfo, setShowAppointmentInfo] = useState(false);

  // Обработчик события создания записи - перезагружаем appointments
  useEffect(() => {
    const handleAppointmentCreated = () => {
      if (selectedDoctor) {
        setSelectedDate(null);
        loadAppointments();
      }
    };
    
    window.addEventListener('appointmentCreated', handleAppointmentCreated);
    
    return () => {
      window.removeEventListener('appointmentCreated', handleAppointmentCreated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor, currentDate]);

  useEffect(() => {
    loadDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedDoctor) {
      loadDoctorSchedule();
      loadAppointments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor, currentDate]);


  const loadDoctors = async () => {
    try {
      const response = await axios.get(`${API_URL}/doctors`);
      setDoctors(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки врачей:', error);
      setLoading(false);
    }
  };

  const loadDoctorSchedule = async () => {
    try {
      const [schedulesRes, datesRes] = await Promise.all([
        axios.get(`${API_URL}/schedules?doctor_id=${selectedDoctor.id}`),
        axios.get(`${API_URL}/specific-dates?doctor_id=${selectedDoctor.id}`)
      ]);
      setSchedules(schedulesRes.data);
      setSpecificDates(datesRes.data);
    } catch (error) {
      console.error('Ошибка загрузки расписания:', error);
    }
  };

  const loadAppointments = async () => {
    if (!selectedDoctor) return;
    
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const response = await axios.get(
        `${API_URL}/doctors/${selectedDoctor.id}/monthly-appointments?month=${month}&year=${year}`
      );
      console.log('📅 ЗАГРУЗКА ЗАПИСЕЙ:');
      console.log('   Получено записей:', response.data.length);
      if (response.data.length > 0) {
        console.log('   Последние 3:', response.data.slice(-3).map(a => ({
          id: a.id,
          date: a.appointment_date,
          parsed: new Date(a.appointment_date).toLocaleString('ru-RU')
        })));
      }
      setAppointments([...response.data]);
    } catch (error) {
      console.error('Ошибка загрузки записей:', error);
    }
  };

  const getScheduleForDate = (date) => {
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split('T')[0];

    // Проверяем точечные даты (приоритет)
    const specificDate = specificDates.find(d => 
      d.work_date.split('T')[0] === dateStr
    );

    if (specificDate) {
      return [{
        start_time: specificDate.start_time,
        end_time: specificDate.end_time,
        type: 'specific'
      }];
    }

    // Проверяем регулярное расписание
    const regularSlots = schedules.filter(s => s.day_of_week === dayOfWeek);
    
    if (regularSlots.length > 0) {
      return regularSlots.map(s => ({
        start_time: s.start_time,
        end_time: s.end_time,
        type: 'regular'
      }));
    }

    return [];
  };

  const getAppointmentsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return appointments.filter(apt => 
      apt.appointment_date.substring(0, 10) === dateStr
    );
  };

  const generateTimeSlots = (startTime, endTime) => {
    const slots = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    let currentHour = startHour;
    let currentMin = startMin;

    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const slotStart = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      // Добавляем 1 час
      let nextHour = currentHour + 1;
      let nextMin = currentMin;
      
      if (nextHour > endHour || (nextHour === endHour && nextMin > endMin)) {
        break;
      }

      const slotEnd = `${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;
      
      slots.push({ start: slotStart, end: slotEnd });
      
      currentHour = nextHour;
      currentMin = nextMin;
    }

    return slots;
  };

  const getAllSlotsForDate = (date) => {
    const schedule = getScheduleForDate(date);
    if (schedule.length === 0) return { available: [], booked: [] };

    const dateAppointments = getAppointmentsForDate(date);
    const allSlots = [];

    schedule.forEach(slot => {
      const timeSlots = generateTimeSlots(slot.start_time, slot.end_time);
      allSlots.push(...timeSlots);
    });

    const available = [];
    const booked = [];

    allSlots.forEach(slot => {
      const appointment = dateAppointments.find(apt => {
        // appointment_date формат: '2026-01-14 10:00:00' или '2026-01-14T10:00:00'
        const aptTime = apt.appointment_date.substring(11, 16); // извлекаем HH:MM
        return aptTime === slot.start;
      });

      if (appointment) {
        booked.push({ ...slot, appointment });
      } else {
        available.push(slot);
      }
    });

    return { available, booked };
  };

  const getAvailableSlotsForDate = (date) => {
    const { available } = getAllSlotsForDate(date);
    return available;
  };

  const getDayStatus = (date) => {
    const schedule = getScheduleForDate(date);
    if (schedule.length === 0) return 'no-schedule';

    const availableSlots = getAvailableSlotsForDate(date);
    
    if (availableSlots.length === 0) return 'fully-booked';
    
    const totalSlots = schedule.reduce((sum, slot) => {
      return sum + generateTimeSlots(slot.start_time, slot.end_time).length;
    }, 0);

    return availableSlots.length === totalSlots ? 'available' : 'partially-booked';
  };

  const handleDateClick = (date) => {
    const schedule = getScheduleForDate(date);
    if (schedule.length === 0) {
      alert('На этот день нет расписания врача');
      return;
    }

    setSelectedDate(date);
  };

  const isPast = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Генерация календаря
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const calendarDays = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  if (!selectedDoctor) {
    return (
      <div className="booking-calendar-container">
        <div className="booking-header">
          <div>
            <h2>📅 Запись пациентов</h2>
            <p style={{ color: '#666', margin: '5px 0 0 0' }}>
              Выберите врача для просмотра доступных слотов
            </p>
          </div>
          <button className="btn" onClick={onBack}>
            ← Назад
          </button>
        </div>

        <div className="doctors-grid">
          {doctors.map(doctor => (
            <div 
              key={doctor.id}
              className="doctor-card-booking"
              onClick={() => setSelectedDoctor(doctor)}
            >
              <div className="doctor-avatar">
                👨‍⚕️
              </div>
              <h3>{doctor.lastName} {doctor.firstName}</h3>
              <p className="doctor-spec">{doctor.specialization}</p>
              <button className="btn btn-primary btn-small">
                Открыть календарь →
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="booking-calendar-container">
      <div className="booking-header">
        <div>
          <button 
            className="btn btn-back"
            onClick={() => {
              setSelectedDoctor(null);
              setSelectedDate(null);
            }}
          >
            ← Выбрать другого врача
          </button>
          <h2 style={{ marginTop: '15px' }}>
            📅 {selectedDoctor.lastName} {selectedDoctor.firstName}
          </h2>
          <p style={{ color: '#667eea', fontSize: '0.95rem', margin: '5px 0 0 0' }}>
            {selectedDoctor.specialization}
          </p>
        </div>
      </div>

      <div className="calendar-navigation">
        <button className="btn btn-small" onClick={prevMonth}>
          ← Предыдущий
        </button>
        <h3>{MONTHS[month]} {year}</h3>
        <button className="btn btn-small" onClick={nextMonth}>
          Следующий →
        </button>
      </div>

      <div className="booking-calendar-grid" key={`calendar-${appointments.length}-${currentDate.getTime()}`}>
        {DAYS_OF_WEEK_SHORT.map(day => (
          <div key={day} className="calendar-day-header">{day}</div>
        ))}

        {calendarDays.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="calendar-day-booking empty" />;
          }

          // Вычисляем статус дня с учетом текущего состояния appointments
          const schedule = getScheduleForDate(date);
          const hasSchedule = schedule.length > 0;
          const dateStr = date.toISOString().split('T')[0];
          // appointment_date может быть в формате '2026-01-14 10:00:00' или '2026-01-14T10:00:00'
          const dateAppointments = appointments.filter(apt => 
            apt.appointment_date.substring(0, 10) === dateStr
          );
          
          let status = 'no-schedule';
          let availableCount = 0;
          
          // Если есть записи, но нет расписания - показываем как "fully-booked"
          if (!hasSchedule && dateAppointments.length > 0) {
            status = 'fully-booked';
            availableCount = 0;
          } else if (hasSchedule) {
            // Генерируем все слоты для этого дня
            let totalSlots = 0;
            let bookedSlots = 0;
            
            schedule.forEach(slot => {
              const timeSlots = generateTimeSlots(slot.start_time, slot.end_time);
              totalSlots += timeSlots.length;
              
              timeSlots.forEach(timeSlot => {
                const isBooked = dateAppointments.some(apt => {
                  // appointment_date формат: '2026-01-14 10:00:00' или '2026-01-14T10:00:00'
                  const aptTime = apt.appointment_date.substring(11, 16); // извлекаем HH:MM
                  return aptTime === timeSlot.start;
                });
                if (isBooked) bookedSlots++;
              });
            });
            
            availableCount = totalSlots - bookedSlots;
            
            if (bookedSlots === totalSlots) {
              status = 'fully-booked';
            } else if (bookedSlots === 0) {
              status = 'available';
            } else {
              status = 'partially-booked';
            }
          }
          
          const isCurrentDay = isToday(date);
          const isPastDay = isPast(date);

          return (
            <div
              key={date.toISOString()}
              className={`calendar-day-booking ${status} ${
                isCurrentDay ? 'today' : ''
              } ${isPastDay ? 'past' : ''}`}
              onClick={() => !isPastDay && handleDateClick(date)}
            >
              <div className="day-number">{date.getDate()}</div>
              {status === 'available' && (
                <div className="availability-badge">Свободно</div>
              )}
              {status === 'partially-booked' && (
                <div className="availability-badge partial">
                  Свободно: {availableCount}
                </div>
              )}
              {status === 'fully-booked' && (
                <div className="availability-badge full">Занято</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="calendar-legend-booking">
        <div className="legend-item">
          <div className="legend-box available"></div>
          <span>Полностью свободно</span>
        </div>
        <div className="legend-item">
          <div className="legend-box partially-booked"></div>
          <span>Частично занято</span>
        </div>
        <div className="legend-item">
          <div className="legend-box fully-booked"></div>
          <span>Все занято</span>
        </div>
      </div>

      {/* Модалка выбора времени */}
      {selectedDate && (
        <div className="modal-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setSelectedDate(null);
          }
        }}>
          <div className="modal modal-time-slots">
            <h2>🕐 Расписание на день</h2>
            <p style={{ color: '#667eea', fontSize: '1rem', margin: '10px 0', fontWeight: '600' }}>
              {selectedDoctor.lastName} {selectedDoctor.firstName}
            </p>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '20px' }}>
              📅 {selectedDate.toLocaleDateString('ru-RU', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </p>

            {(() => {
              const { available, booked } = getAllSlotsForDate(selectedDate);
              const allSlots = [
                ...available.map(s => ({ ...s, status: 'available' })),
                ...booked.map(s => ({ ...s, status: 'booked' }))
              ].sort((a, b) => a.start.localeCompare(b.start));

              return (
                <>
                  <div className="slots-legend">
                    <div className="legend-item-small">
                      <div className="legend-dot available"></div>
                      <span>Свободно: {available.length}</span>
                    </div>
                    <div className="legend-item-small">
                      <div className="legend-dot booked"></div>
                      <span>Занято: {booked.length}</span>
                    </div>
                  </div>

                  <div className="time-slots-grid">
                    {allSlots.map((slot, idx) => (
                      <button
                        key={idx}
                        className={`time-slot-btn ${slot.status}`}
                        onClick={() => {
                          if (slot.status === 'available') {
                            // Открываем форму записи
                            const appointmentDateTime = new Date(selectedDate);
                            const [hours, minutes] = slot.start.split(':');
                            appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                            
                            // Форматируем для input[type="datetime-local"] БЕЗ конвертации в UTC
                            const year = appointmentDateTime.getFullYear();
                            const month = String(appointmentDateTime.getMonth() + 1).padStart(2, '0');
                            const day = String(appointmentDateTime.getDate()).padStart(2, '0');
                            const hour = String(appointmentDateTime.getHours()).padStart(2, '0');
                            const minute = String(appointmentDateTime.getMinutes()).padStart(2, '0');
                            const localDateTimeString = `${year}-${month}-${day}T${hour}:${minute}`;
                            
                            if (window.openAppointmentModal) {
                              window.openAppointmentModal({
                                doctor_id: selectedDoctor.id,
                                appointment_date: localDateTimeString
                              });
                            }
                          } else {
                            // Показываем информацию о записи
                            setSelectedAppointment(slot.appointment);
                            setShowAppointmentInfo(true);
                          }
                        }}
                      >
                        <div className="time-slot-time">{slot.start}</div>
                        <div className="time-slot-duration">
                          {slot.status === 'available' ? '1 час' : 'Занято'}
                        </div>
                        {slot.status === 'booked' && (
                          <div className="slot-icon">👤</div>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}

            <button 
              className="btn" 
              onClick={() => {
                setSelectedDate(null);
              }}
              style={{ marginTop: '20px', width: '100%' }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Модалка информации о записи */}
      {showAppointmentInfo && selectedAppointment && (
        <div className="modal-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setShowAppointmentInfo(false);
            setSelectedAppointment(null);
          }
        }}>
          <div className="modal modal-appointment-info">
            <h2>📋 Информация о записи</h2>
            
            <div className="appointment-info-content">
              <div className="info-row">
                <span className="info-label">👤 Пациент:</span>
                <span className="info-value">
                  {selectedAppointment.client_lastName} {selectedAppointment.client_firstName} {selectedAppointment.client_middleName}
                </span>
              </div>

              <div className="info-row">
                <span className="info-label">📞 Телефон:</span>
                <span className="info-value">{selectedAppointment.client_phone}</span>
              </div>

              <div className="info-row">
                <span className="info-label">👨‍⚕️ Врач:</span>
                <span className="info-value">
                  {selectedAppointment.doctor_lastName} {selectedAppointment.doctor_firstName}
                </span>
              </div>

              <div className="info-row">
                <span className="info-label">🕐 Время:</span>
                <span className="info-value">
                  {new Date(selectedAppointment.appointment_date).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {selectedAppointment.services && selectedAppointment.services.length > 0 && (
                <div className="info-row">
                  <span className="info-label">💼 Услуги:</span>
                  <div className="info-value">
                    {selectedAppointment.services.map((service, idx) => (
                      <div key={idx} className="service-item-info">
                        • {service.name} {service.quantity > 1 ? `(x${service.quantity})` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedAppointment.notes && (
                <div className="info-row">
                  <span className="info-label">📝 Примечания:</span>
                  <span className="info-value">{selectedAppointment.notes}</span>
                </div>
              )}

              <div className="info-row">
                <span className="info-label">💳 Статус оплаты:</span>
                <span className={`info-value payment-status ${selectedAppointment.paid ? 'paid' : 'unpaid'}`}>
                  {selectedAppointment.paid ? '✓ Оплачено' : '⏳ Не оплачено'}
                </span>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={() => {
                setShowAppointmentInfo(false);
                setSelectedAppointment(null);
              }}
              style={{ marginTop: '20px', width: '100%' }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingCalendar;

