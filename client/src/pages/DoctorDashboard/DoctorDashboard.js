import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DoctorCalendar from '../../components/DoctorCalendar/DoctorCalendar';
import './DoctorDashboard.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

const DoctorDashboard = ({ currentUser, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('schedule');
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.doctor_id) {
      loadDoctorData();
    } else {
      console.error('doctor_id не найден в currentUser:', currentUser);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const loadDoctorData = async () => {
    try {
      setLoading(true);
      if (!currentUser?.doctor_id) {
        throw new Error('doctor_id не найден в данных пользователя');
      }
      const response = await axios.get(`${API_URL}/doctors/${currentUser.doctor_id}`);
      if (response.data) {
        setDoctor(response.data);
      } else {
        throw new Error('Данные врача не получены');
      }
    } catch (error) {
      console.error('Ошибка загрузки данных врача:', error);
      console.error('doctor_id:', currentUser?.doctor_id);
      console.error('currentUser:', currentUser);
      alert(`Ошибка загрузки данных врача: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="doctor-dashboard">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="doctor-dashboard">
        <div className="error">Ошибка: данные врача не найдены</div>
      </div>
    );
  }

  return (
    <div className="doctor-dashboard">
      <div className="dashboard-header">
        <div>
          <h2>👨‍⚕️ Личный кабинет врача</h2>
          <p className="doctor-name">
            {doctor.lastName} {doctor.firstName} {doctor.middleName || ''}
            {doctor.specialization && ` • ${doctor.specialization}`}
          </p>
        </div>
        <button className="btn" onClick={() => onNavigate('home')}>
          ← Назад
        </button>
      </div>

      {/* Вкладки */}
      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          📅 Расписание и записи
        </button>
        <button
          className={`tab ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          📋 Сегодня
        </button>
        <button
          className={`tab ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          📊 Статистика
        </button>
      </div>

      {/* Контент вкладок */}
      <div className="dashboard-content">
        {activeTab === 'schedule' && (
          <div className="schedule-tab">
            <DoctorCalendar 
              currentUser={currentUser}
              onAppointmentClick={(appointment) => {
                // Можно открыть карточку пациента или детали записи
                console.log('Клик на запись:', appointment);
              }}
            />
          </div>
        )}

        {activeTab === 'today' && (
          <div className="today-tab">
            <h3>📋 Записи на сегодня</h3>
            <p className="tab-placeholder">
              Функция "Сегодня" будет реализована в следующем обновлении.
              <br />
              Здесь будет отображаться список записей на сегодня с возможностью быстрого доступа к карточке пациента.
            </p>
          </div>
        )}

        {activeTab === 'statistics' && (
          <div className="statistics-tab">
            <h3>📊 Статистика</h3>
            <p className="tab-placeholder">
              Функция "Статистика" будет реализована в следующем обновлении.
              <br />
              Здесь будет отображаться статистика по записям, доходам и другим показателям.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorDashboard;

