import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DoctorSchedule.css';
import ScheduleCalendar from './ScheduleCalendar';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

const DAYS_OF_WEEK = [
  { value: 1, label: 'Понедельник' },
  { value: 2, label: 'Вторник' },
  { value: 3, label: 'Среда' },
  { value: 4, label: 'Четверг' },
  { value: 5, label: 'Пятница' },
  { value: 6, label: 'Суббота' },
  { value: 0, label: 'Воскресенье' }
];

// Утилита для форматирования даты БЕЗ timezone проблем (как в BookingCalendarV2)
const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const DoctorSchedule = ({ currentUser, doctors }) => {
  const [schedules, setSchedules] = useState([]);
  const [specificDates, setSpecificDates] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [monthlyAppointments, setMonthlyAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [scheduleType, setScheduleType] = useState('regular'); // 'regular' or 'specific'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    day_of_week: '',
    start_time: '',
    end_time: '',
    work_date: ''
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDateSchedule, setSelectedDateSchedule] = useState(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMultipleDates, setSelectedMultipleDates] = useState([]);

  const isSuperAdmin = currentUser.role === 'superadmin';
  const isDoctor = currentUser.role === 'doctor';

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const [schedulesRes, datesRes] = await Promise.all([
        axios.get(`${API_URL}/schedules`),
        axios.get(`${API_URL}/specific-dates`)
      ]);
      setSchedules(schedulesRes.data);
      setSpecificDates(datesRes.data);
    } catch (error) {
      console.error('Ошибка загрузки расписания:', error);
      alert('Ошибка загрузки расписания');
    } finally {
      setLoading(false);
    }
  };

  const loadTodayAppointments = async (doctorId) => {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      
      const response = await axios.get(
        `${API_URL}/doctors/${doctorId}/monthly-appointments?year=${year}&month=${month}`
      );
      
      // Фильтруем только сегодняшние записи
      const todayStr = formatDateLocal(today);
      const todayApts = response.data.filter(apt => {
        // appointment_date может быть в формате YYYY-MM-DD HH:MM:SS или YYYY-MM-DD
        const aptDate = apt.appointment_date.substring(0, 10);
        return aptDate === todayStr;
      });
      
      setTodayAppointments(todayApts);
    } catch (error) {
      console.error('Ошибка загрузки записей:', error);
    }
  };

  const loadMonthlyAppointments = async (doctorId) => {
    try {
      const response = await axios.get(
        `${API_URL}/doctors/${doctorId}/monthly-appointments?year=${selectedYear}&month=${selectedMonth}`
      );
      setMonthlyAppointments(response.data);
    } catch (error) {
      console.error('Ошибка загрузки записей:', error);
    }
  };

  useEffect(() => {
    loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isDoctor && currentUser.doctor_id) {
      loadMonthlyAppointments(currentUser.doctor_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear, isDoctor, currentUser.doctor_id]);

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    
    if (!selectedDoctor) {
      console.error('selectedDoctor не установлен!');
      alert('Ошибка: врач не выбран');
      return;
    }
    
    console.log('Добавление расписания для врача:', selectedDoctor);
    console.log('Данные формы:', formData);
    
    try {
      // Всегда создаем точечную дату при клике из календаря
      await axios.post(`${API_URL}/specific-dates`, {
        doctor_id: selectedDoctor.id,
        work_date: formData.work_date,
        start_time: formData.start_time,
        end_time: formData.end_time
      });
      
      setShowAddModal(false);
      setSelectedDate(null);
      setSelectedDateSchedule(null);
      setFormData({ day_of_week: '', start_time: '', end_time: '', work_date: '' });
      loadSchedules();
      alert('✓ Время добавлено!');
    } catch (error) {
      console.error('Ошибка добавления расписания:', error);
      alert('Ошибка: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteSchedule = async (id, type) => {
    if (!window.confirm('Удалить этот слот расписания?')) return;
    
    try {
      const endpoint = type === 'regular' ? 'schedules' : 'specific-dates';
      await axios.delete(`${API_URL}/${endpoint}/${id}`);
      loadSchedules();
      alert('Расписание удалено');
    } catch (error) {
      console.error('Ошибка удаления расписания:', error);
      alert('Ошибка удаления расписания');
    }
  };

  const handleDateSelect = (date) => {
    const dateStr = formatDateLocal(date);
    const isAlreadySelected = selectedMultipleDates.some(
      d => formatDateLocal(d) === dateStr
    );

    if (isAlreadySelected) {
      // Убираем дату из выбранных
      setSelectedMultipleDates(selectedMultipleDates.filter(
        d => formatDateLocal(d) !== dateStr
      ));
    } else {
      // Добавляем дату к выбранным
      setSelectedMultipleDates([...selectedMultipleDates, date]);
    }
  };

  const handleApplyToMultipleDates = async (e) => {
    e.preventDefault();
    
    if (selectedMultipleDates.length === 0) {
      alert('Выберите хотя бы один день');
      return;
    }

    if (!formData.start_time || !formData.end_time) {
      alert('Укажите время начала и окончания');
      return;
    }

    try {
      // Создаем расписание для каждой выбранной даты
      for (const date of selectedMultipleDates) {
        const dateStr = formatDateLocal(date);
        await axios.post(`${API_URL}/specific-dates`, {
          doctor_id: selectedDoctor.id,
          work_date: dateStr,
          start_time: formData.start_time,
          end_time: formData.end_time
        });
      }

      setShowAddModal(false);
      setMultiSelectMode(false);
      setSelectedMultipleDates([]);
      setFormData({ day_of_week: '', start_time: '', end_time: '', work_date: '' });
      loadSchedules();
      alert(`✓ Расписание добавлено для ${selectedMultipleDates.length} дней!`);
    } catch (error) {
      console.error('Ошибка добавления расписания:', error);
      alert('Ошибка: ' + (error.response?.data?.error || error.message));
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDoctorSchedules = (doctorId) => {
    return {
      regularSlots: schedules.filter(s => s.doctor_id === doctorId),
      specificDates: specificDates.filter(d => d.doctor_id === doctorId)
    };
  };

  // Проверка, работает ли врач сегодня
  const isDoctorWorkingToday = (doctorId) => {
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const todayStr = formatDateLocal(today);
    
    // Проверяем регулярное расписание
    const hasRegularSchedule = schedules.some(s => 
      s.doctor_id === doctorId && s.day_of_week === todayDayOfWeek
    );
    
    // Проверяем точечные даты (work_date уже в формате YYYY-MM-DD)
    const hasSpecificDate = specificDates.some(d => 
      d.doctor_id === doctorId && d.work_date === todayStr
    );
    
    return hasRegularSchedule || hasSpecificDate;
  };

  // Получить время работы врача сегодня
  const getDoctorTodaySchedule = (doctorId) => {
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const todayStr = formatDateLocal(today);
    
    // Сначала проверяем точечные даты (приоритет)
    const specificDate = specificDates.find(d => 
      d.doctor_id === doctorId && d.work_date === todayStr
    );
    
    if (specificDate) {
      return `${specificDate.start_time} - ${specificDate.end_time}`;
    }
    
    // Затем регулярное расписание
    const regularSlots = schedules.filter(s => 
      s.doctor_id === doctorId && s.day_of_week === todayDayOfWeek
    );
    
    if (regularSlots.length > 0) {
      return regularSlots.map(s => `${s.start_time} - ${s.end_time}`).join(', ');
    }
    
    return '-';
  };

  if (loading) {
    return <div className="schedule-loading">Загрузка расписания...</div>;
  }

  // Если это врач, показываем его записи
  if (isDoctor) {
    return (
      <div className="doctor-schedule-container">
        <div className="schedule-header">
          <h2>📅 Мои записи на месяц</h2>
          <div className="month-selector">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2024, i).toLocaleDateString('ru-RU', { month: 'long' })}
                </option>
              ))}
            </select>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {Array.from({ length: 3 }, (_, i) => (
                <option key={i} value={new Date().getFullYear() + i}>
                  {new Date().getFullYear() + i}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="doctor-appointments-list">
          {monthlyAppointments.length === 0 ? (
            <div className="empty-state">Нет записей на выбранный месяц</div>
          ) : (
            <table className="appointments-table">
              <thead>
                <tr>
                  <th>Дата и время</th>
                  <th>Клиент</th>
                  <th>Телефон</th>
                  <th>Статус</th>
                  <th>Примечания</th>
                </tr>
              </thead>
              <tbody>
                {monthlyAppointments.map(apt => (
                  <tr key={apt.id}>
                    <td>{formatDateTime(apt.appointment_date)}</td>
                    <td>{apt.client_last_name} {apt.client_first_name}</td>
                    <td>{apt.client_phone}</td>
                    <td>
                      <span className={`status-badge status-${apt.status}`}>
                        {apt.status === 'scheduled' && '📅 Запланирована'}
                        {apt.status === 'completed' && '✅ Завершена'}
                        {apt.status === 'cancelled' && '❌ Отменена'}
                        {apt.status === 'in_progress' && '🔄 В процессе'}
                      </span>
                    </td>
                    <td>{apt.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // Показываем приемы выбранного врача на сегодня
  if (selectedDoctor && !showScheduleModal) {
    return (
      <div className="doctor-schedule-container">
        <div className="schedule-header">
          <div>
            <button 
              className="btn btn-back"
              onClick={() => {
                setSelectedDoctor(null);
                setTodayAppointments([]);
              }}
            >
              ← Назад к списку врачей
            </button>
            <h2 style={{ marginTop: '15px' }}>
              📋 Приемы сегодня: {selectedDoctor.lastName} {selectedDoctor.firstName}
            </h2>
            <p style={{ color: '#667eea', fontSize: '0.95rem', margin: '5px 0 0 0' }}>
              {selectedDoctor.specialization} • Время работы: {getDoctorTodaySchedule(selectedDoctor.id)}
            </p>
          </div>
          {isSuperAdmin && (
            <button 
              className="btn btn-primary" 
              onClick={() => setShowScheduleModal(true)}
            >
              ⚙️ Управление расписанием
            </button>
          )}
        </div>

        <div className="today-appointments-container">
          {todayAppointments.length === 0 ? (
            <div className="empty-state">
              Нет записей на сегодня
            </div>
          ) : (
            <div className="appointments-cards">
              {todayAppointments.map(apt => (
                <div key={apt.id} className="appointment-card">
                  <div className="appointment-card-header">
                    <div className="appointment-time">
                      <span className="time-icon">🕐</span>
                      {formatTime(apt.appointment_date)}
                    </div>
                    <span className={`status-badge status-${apt.status}`}>
                      {apt.status === 'scheduled' && '📅 Запланирована'}
                      {apt.status === 'completed' && '✅ Завершена'}
                      {apt.status === 'cancelled' && '❌ Отменена'}
                      {apt.status === 'in_progress' && '🔄 В процессе'}
                    </span>
                  </div>
                  <div className="appointment-card-body">
                    <div className="client-info">
                      <h3>{apt.client_last_name} {apt.client_first_name}</h3>
                      <p className="client-phone">📞 {apt.client_phone}</p>
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Показываем управление расписанием выбранного врача
  if (selectedDoctor && showScheduleModal) {
    const { regularSlots, specificDates: doctorSpecificDates } = getDoctorSchedules(selectedDoctor.id);

    return (
      <div className="doctor-schedule-container">
        <div className="schedule-header">
          <div>
            <button 
              className="btn btn-back"
              onClick={() => setShowScheduleModal(false)}
            >
              ← Назад к приемам
            </button>
            <h2 style={{ marginTop: '15px' }}>
              ⚙️ Расписание: {selectedDoctor.lastName} {selectedDoctor.firstName}
            </h2>
            <p style={{ color: '#667eea', fontSize: '0.95rem', margin: '5px 0 0 0' }}>
              {selectedDoctor.specialization}
            </p>
            {isSuperAdmin && !multiSelectMode && (
              <p style={{ color: '#999', fontSize: '0.85rem', margin: '10px 0 0 0' }}>
                💡 Кликните на день в календаре, чтобы установить время приема
              </p>
            )}
            {isSuperAdmin && multiSelectMode && (
              <p style={{ color: '#9c27b0', fontSize: '0.9rem', margin: '10px 0 0 0', fontWeight: '600' }}>
                🔸 Выбрано дней: {selectedMultipleDates.length}. Кликайте на дни для выбора.
              </p>
            )}
          </div>
          {isSuperAdmin && (
            <div style={{ display: 'flex', gap: '10px' }}>
              {!multiSelectMode ? (
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setMultiSelectMode(true);
                    setSelectedMultipleDates([]);
                  }}
                >
                  📅 Выбрать несколько дней
                </button>
              ) : (
                <>
                  <button 
                    className="btn"
                    onClick={() => {
                      setMultiSelectMode(false);
                      setSelectedMultipleDates([]);
                    }}
                  >
                    Отмена
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      if (selectedMultipleDates.length === 0) {
                        alert('Выберите хотя бы один день');
                        return;
                      }
                      setShowAddModal(true);
                    }}
                    disabled={selectedMultipleDates.length === 0}
                  >
                    ⏰ Установить время ({selectedMultipleDates.length})
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <ScheduleCalendar
          schedules={regularSlots}
          specificDates={doctorSpecificDates}
          doctorId={selectedDoctor.id}
          onDateClick={(date, schedule) => {
            setSelectedDate(date);
            setSelectedDateSchedule(schedule);
            const dateStr = formatDateLocal(date);
            setFormData({
              day_of_week: date.getDay(),
              start_time: '',
              end_time: '',
              work_date: dateStr
            });
            setShowAddModal(true);
          }}
          canEdit={isSuperAdmin}
          multiSelectMode={multiSelectMode}
          selectedDates={selectedMultipleDates}
          onDateSelect={handleDateSelect}
        />

        {/* Модалка для множественного выбора */}
        {showAddModal && multiSelectMode && selectedMultipleDates.length > 0 && (
          <div className="modal-overlay" onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              setFormData({ day_of_week: '', start_time: '', end_time: '', work_date: '' });
            }
          }}>
            <div className="modal modal-calendar-time">
              <h2>⏰ Установить время для нескольких дней</h2>
              <p style={{ color: '#667eea', marginBottom: '5px', fontSize: '1.1rem', fontWeight: '600' }}>
                {selectedDoctor.lastName} {selectedDoctor.firstName}
              </p>
              <p style={{ color: '#999', marginBottom: '20px', fontSize: '0.9rem' }}>
                Выбрано дней: {selectedMultipleDates.length}
              </p>

              <div className="selected-dates-preview">
                <h4>📅 Выбранные дни:</h4>
                <div className="dates-grid">
                  {selectedMultipleDates.sort((a, b) => a - b).map((date, idx) => (
                    <div key={idx} className="date-chip">
                      {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleApplyToMultipleDates}>
                <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>⏰ Установить одинаковое время для всех дней:</h4>
                  
                  <label>Время начала *</label>
                  <input 
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                    style={{ marginBottom: '15px' }}
                  />
                  
                  <label>Время окончания *</label>
                  <input 
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    required
                  />
                </div>
                
                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => {
                      setShowAddModal(false);
                      setFormData({ day_of_week: '', start_time: '', end_time: '', work_date: '' });
                    }}
                  >
                    Закрыть
                  </button>
                  <button type="submit" className="btn btn-primary">
                    ✓ Применить ко всем ({selectedMultipleDates.length})
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Модалка добавления/редактирования времени для одного дня */}
        {showAddModal && !multiSelectMode && selectedDate && (
          <div className="modal-overlay" onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              setSelectedDate(null);
              setSelectedDateSchedule(null);
              setFormData({ day_of_week: '', start_time: '', end_time: '', work_date: '' });
            }
          }}>
            <div className="modal modal-calendar-time">
              <h2>⏰ Установить время приема</h2>
              <p style={{ color: '#667eea', marginBottom: '5px', fontSize: '1.1rem', fontWeight: '600' }}>
                {selectedDoctor.lastName} {selectedDoctor.firstName}
              </p>
              <p style={{ color: '#999', marginBottom: '20px', fontSize: '0.9rem' }}>
                📅 {selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>

              {selectedDateSchedule && (
                <div className="existing-schedule-info">
                  <h4>Текущее расписание:</h4>
                  <div className="existing-times">
                    {selectedDateSchedule.times.map((time, idx) => (
                      <div key={idx} className="existing-time-badge">
                        {time}
                        {selectedDateSchedule.type === 'specific' ? ' 📍' : ' 🔄'}
                      </div>
                    ))}
                  </div>
                  {isSuperAdmin && selectedDateSchedule.type === 'specific' && (
                    <button 
                      className="btn btn-danger btn-small"
                      style={{ marginTop: '10px' }}
                      onClick={() => {
                        handleDeleteSchedule(selectedDateSchedule.id, 'specific');
                        setShowAddModal(false);
                        setSelectedDate(null);
                      }}
                    >
                      🗑️ Удалить это расписание
                    </button>
                  )}
                  {isSuperAdmin && selectedDateSchedule.type === 'regular' && selectedDateSchedule.ids && (
                    <div style={{ marginTop: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {selectedDateSchedule.ids.map((id, idx) => (
                        <button 
                          key={id}
                          className="btn btn-danger btn-small"
                          onClick={() => {
                            handleDeleteSchedule(id, 'regular');
                            setShowAddModal(false);
                            setSelectedDate(null);
                          }}
                        >
                          🗑️ Удалить {selectedDateSchedule.times[idx]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={(e) => {
                e.preventDefault();
                // Определяем тип автоматически - точечная дата для конкретного дня
                handleAddSchedule(e);
              }}>
                <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>➕ Добавить новое время:</h4>
                  
                  <label>Время начала *</label>
                  <input 
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                    style={{ marginBottom: '15px' }}
                  />
                  
                  <label>Время окончания *</label>
                  <input 
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    required
                  />
                </div>
                
                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => {
                      setShowAddModal(false);
                      setSelectedDate(null);
                      setSelectedDateSchedule(null);
                      setFormData({ day_of_week: '', start_time: '', end_time: '', work_date: '' });
                    }}
                  >
                    Закрыть
                  </button>
                  <button type="submit" className="btn btn-primary">
                    ✓ Добавить время
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Главный экран - врачи, работающие сегодня
  const workingToday = doctors.filter(doc => isDoctorWorkingToday(doc.id));

  return (
    <div className="doctor-schedule-container">
      <div className="schedule-header">
        <h2>👨‍⚕️ Врачи, работающие сегодня ({new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })})</h2>
        {isSuperAdmin && (
          <div className="header-actions">
            <span style={{ color: '#999', fontSize: '0.9rem', marginRight: '10px' }}>
              Работает: {workingToday.length} из {doctors.length}
            </span>
          </div>
        )}
      </div>

      <div className="working-doctors-list">
        {workingToday.length === 0 ? (
          <div className="empty-state">
            Сегодня нет работающих врачей
          </div>
        ) : (
          <div className="doctor-cards-grid">
            {workingToday.map(doctor => (
              <div 
                key={doctor.id} 
                className="doctor-today-card"
                onClick={() => {
                  setSelectedDoctor(doctor);
                  loadTodayAppointments(doctor.id);
                }}
              >
                <div className="doctor-card-header">
                  <div className="doctor-avatar">👨‍⚕️</div>
                  <div className="doctor-card-info">
                    <h3>{doctor.lastName} {doctor.firstName}</h3>
                    <p className="doctor-spec">{doctor.specialization}</p>
                  </div>
                </div>
                <div className="doctor-card-schedule">
                  <span className="schedule-label">Время работы:</span>
                  <span className="schedule-time">{getDoctorTodaySchedule(doctor.id)}</span>
                </div>
                <div className="doctor-card-footer">
                  <button className="btn-view-appointments">
                    Посмотреть приемы →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Все врачи (для просмотра расписания) - всегда показываем, если есть врачи */}
      {Array.isArray(doctors) && doctors.length > 0 && (
        <div className="not-working-section" style={{ display: 'block' }}>
          <div className="section-divider">
            <h3>Все врачи</h3>
            <span className="count-badge">{doctors.length}</span>
          </div>

          <div className="not-working-doctors-list">
            <table className="doctors-table-compact">
              <thead>
                <tr>
                  <th>№</th>
                  <th>ФИО</th>
                  <th>Специализация</th>
                  <th>Телефон</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doctor, index) => (
                  <tr key={doctor.id || index}>
                    <td className="number-cell">{index + 1}</td>
                    <td>{doctor.lastName} {doctor.firstName} {doctor.middleName || ''}</td>
                    <td>{doctor.specialization || '-'}</td>
                    <td>{doctor.phone || '-'}</td>
                    <td>
                      <button 
                        className="btn btn-small"
                        onClick={() => {
                          setSelectedDoctor(doctor);
                          setShowScheduleModal(true);
                        }}
                      >
                        📅 Посмотреть расписание
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(() => {
        console.log('Проверка условия модалки:');
        console.log('showAddModal:', showAddModal);
        console.log('selectedDoctor:', selectedDoctor);
        console.log('Условие выполнено?', showAddModal && selectedDoctor);
        return null;
      })()}
      
      {showAddModal && selectedDoctor && (
        <div className="modal-overlay" onMouseDown={(e) => {
          console.log('Клик на overlay модалки');
          if (e.target === e.currentTarget) {
            console.log('Закрытие модалки через overlay');
            setShowAddModal(false);
            setFormData({ day_of_week: '', start_time: '', end_time: '', work_date: '' });
            setScheduleType('regular');
          }
        }}>
          <div className="modal">
            <h2>Добавить время работы</h2>
            <p style={{ color: '#667eea', marginBottom: '15px' }}>
              {selectedDoctor.lastName} {selectedDoctor.firstName} - {selectedDoctor.specialization}
            </p>
            <form onSubmit={handleAddSchedule}>
              <label>Тип расписания *</label>
              <select 
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value)}
                required
              >
                <option value="regular">Регулярное (день недели)</option>
                <option value="specific">Точечная дата</option>
              </select>
              
              {scheduleType === 'regular' ? (
                <>
                  <label>День недели *</label>
                  <select 
                    value={formData.day_of_week}
                    onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                    required
                  >
                    <option value="">Выберите день</option>
                    {DAYS_OF_WEEK.map(day => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label>Дата *</label>
                  <input 
                    type="date"
                    value={formData.work_date}
                    onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                    required
                  />
                </>
              )}
              
              <label>Время начала *</label>
              <input 
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
              
              <label>Время окончания *</label>
              <input 
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ day_of_week: '', start_time: '', end_time: '', work_date: '' });
                    setScheduleType('regular');
                  }}
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorSchedule;
