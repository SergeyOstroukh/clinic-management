import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DoctorSchedule.css';

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
      const todayStr = today.toISOString().split('T')[0];
      const todayApts = response.data.filter(apt => {
        const aptDate = new Date(apt.appointment_date).toISOString().split('T')[0];
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
    
    if (!selectedDoctor) return;
    
    try {
      if (scheduleType === 'regular') {
        await axios.post(`${API_URL}/schedules`, {
          doctor_id: selectedDoctor.id,
          day_of_week: parseInt(formData.day_of_week),
          start_time: formData.start_time,
          end_time: formData.end_time
        });
      } else {
        await axios.post(`${API_URL}/specific-dates`, {
          doctor_id: selectedDoctor.id,
          work_date: formData.work_date,
          start_time: formData.start_time,
          end_time: formData.end_time
        });
      }
      
      setShowAddModal(false);
      setFormData({ day_of_week: '', start_time: '', end_time: '', work_date: '' });
      setScheduleType('regular');
      loadSchedules();
      alert('Расписание добавлено!');
    } catch (error) {
      console.error('Ошибка добавления расписания:', error);
      alert('Ошибка добавления расписания');
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
    const todayStr = today.toISOString().split('T')[0];
    
    // Проверяем регулярное расписание
    const hasRegularSchedule = schedules.some(s => 
      s.doctor_id === doctorId && s.day_of_week === todayDayOfWeek
    );
    
    // Проверяем точечные даты
    const hasSpecificDate = specificDates.some(d => 
      d.doctor_id === doctorId && d.work_date.split('T')[0] === todayStr
    );
    
    return hasRegularSchedule || hasSpecificDate;
  };

  // Получить время работы врача сегодня
  const getDoctorTodaySchedule = (doctorId) => {
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const todayStr = today.toISOString().split('T')[0];
    
    // Сначала проверяем точечные даты (приоритет)
    const specificDate = specificDates.find(d => 
      d.doctor_id === doctorId && d.work_date.split('T')[0] === todayStr
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
          </div>
          {isSuperAdmin && (
            <button 
              className="btn btn-primary" 
              onClick={() => setShowAddModal(true)}
            >
              + Добавить время работы
            </button>
          )}
        </div>

        <div className="schedule-management">
          {regularSlots.length === 0 && doctorSpecificDates.length === 0 ? (
            <div className="empty-state">Расписание не заполнено</div>
          ) : (
            <>
              {regularSlots.length > 0 && (
                <div className="schedule-section">
                  <h3 className="schedule-section-title">📆 Регулярное расписание</h3>
                  <div className="schedule-slots">
                    {DAYS_OF_WEEK.map(day => {
                      const daySlots = regularSlots.filter(s => s.day_of_week === day.value);
                      
                      if (daySlots.length === 0) return null;
                      
                      return (
                        <div key={day.value} className="day-schedule">
                          <div className="day-name">{day.label}</div>
                          <div className="time-slots">
                            {daySlots.map(slot => (
                              <div key={slot.id} className="time-slot">
                                <span className="time-range">
                                  {slot.start_time} - {slot.end_time}
                                </span>
                                {isSuperAdmin && (
                                  <button 
                                    className="btn-delete-slot"
                                    onClick={() => handleDeleteSchedule(slot.id, 'regular')}
                                    title="Удалить"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {doctorSpecificDates.length > 0 && (
                <div className="schedule-section">
                  <h3 className="schedule-section-title">📍 Точечные даты</h3>
                  <div className="specific-dates-list">
                    {doctorSpecificDates.map(date => (
                      <div key={date.id} className="specific-date-item">
                        <span className="date-label">{formatDate(date.work_date)}</span>
                        <span className="time-range">
                          {date.start_time} - {date.end_time}
                        </span>
                        {isSuperAdmin && (
                          <button 
                            className="btn-delete-slot"
                            onClick={() => handleDeleteSchedule(date.id, 'specific')}
                            title="Удалить"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Главный экран - врачи, работающие сегодня
  const workingToday = doctors.filter(doc => isDoctorWorkingToday(doc.id));
  const notWorkingToday = doctors.filter(doc => !isDoctorWorkingToday(doc.id));

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

      {/* Врачи, которые не работают сегодня */}
      {notWorkingToday.length > 0 && (
        <div className="not-working-section">
          <div className="section-divider">
            <h3>Не работают сегодня</h3>
            <span className="count-badge">{notWorkingToday.length}</span>
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
                {notWorkingToday.map((doctor, index) => (
                  <tr key={doctor.id}>
                    <td className="number-cell">{index + 1}</td>
                    <td>{doctor.lastName} {doctor.firstName} {doctor.middleName || ''}</td>
                    <td>{doctor.specialization}</td>
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

      {showAddModal && (
        <div className="modal-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
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
