import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import DoctorCalendar from '../../components/DoctorCalendar/DoctorCalendar';
import { Modal } from '../../shared/ui';
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
  
  // Состояние для уведомлений о пришедших клиентах
  const [waitingNotification, setWaitingNotification] = useState(null);
  const [waitingQueue, setWaitingQueue] = useState([]); // Очередь ожидающих пациентов
  const acknowledgedPatientsRef = useRef(new Set()); // Отслеживаем показанные уведомления только в текущей сессии

  // Функция проверки ожидающих пациентов
  const checkWaitingPatients = useCallback(async () => {
    if (!currentUser?.doctor_id) return;
    
    try {
      const response = await axios.get(`${API_URL}/doctors/${currentUser.doctor_id}/waiting-patients`);
      const waitingPatients = response.data || [];
      
      console.log('Проверка ожидающих пациентов:', waitingPatients.length, 'найдено');
      
      // Находим новых пациентов, для которых еще не показано уведомление
      const newPatients = waitingPatients.filter(p => !acknowledgedPatientsRef.current.has(p.id));
      
      if (newPatients.length > 0) {
        console.log('Новые ожидающие пациенты:', newPatients.length);
        setWaitingQueue(newPatients);
      }
    } catch (error) {
      console.error('Ошибка проверки ожидающих пациентов:', error);
    }
  }, [currentUser?.doctor_id]);

  // Показываем уведомление из очереди
  useEffect(() => {
    if (waitingQueue.length > 0 && !waitingNotification) {
      setWaitingNotification(waitingQueue[0]);
    }
  }, [waitingQueue, waitingNotification]);

  // Обработчик подтверждения уведомления
  const handleAcknowledgeNotification = () => {
    if (waitingNotification) {
      // Добавляем в показанные (только для текущей сессии)
      acknowledgedPatientsRef.current.add(waitingNotification.id);
      
      // Убираем из очереди и закрываем уведомление
      setWaitingQueue(prev => prev.filter(p => p.id !== waitingNotification.id));
      setWaitingNotification(null);
    }
  };

  useEffect(() => {
    if (currentUser?.doctor_id) {
      loadDoctorData();
    } else {
      console.error('doctor_id не найден в currentUser:', currentUser);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Polling для проверки ожидающих пациентов каждые 10 секунд
  useEffect(() => {
    if (!currentUser?.doctor_id) return;
    
    // Первая проверка сразу (с небольшой задержкой чтобы загрузились данные из localStorage)
    const initialTimeout = setTimeout(checkWaitingPatients, 500);
    
    // Polling каждые 10 секунд
    const interval = setInterval(checkWaitingPatients, 10000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [currentUser?.doctor_id, checkWaitingPatients]);

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

  // Форматирование времени из даты
  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="doctor-dashboard">
      {/* Модальное окно уведомления о пришедшем клиенте */}
      {waitingNotification && (
        <Modal isOpen={true} onClose={handleAcknowledgeNotification} title="🔔 Клиент ожидает">
          <div className="waiting-notification-content">
            <div className="notification-icon">👤</div>
            <div className="notification-message">
              <p className="notification-client-name">
                {waitingNotification.client_last_name} {waitingNotification.client_first_name} {waitingNotification.client_middle_name || ''}
              </p>
              <p className="notification-time">
                Запись на {formatTime(waitingNotification.appointment_date)}
              </p>
              <p className="notification-status">Клиент пришёл и ожидает приёма</p>
            </div>
          </div>
          <div className="notification-actions">
            <button className="btn btn-primary btn-large" onClick={handleAcknowledgeNotification}>
              ✓ Понятно
            </button>
          </div>
        </Modal>
      )}

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

