import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

// FSD imports
import { getTodayDateString, getFullName } from './shared/lib';
import { AppointmentTable, ClientCard, ClientHistoryCard, NavigationCards } from './widgets';
import { DoctorsPage } from './pages/DoctorsPage';
import { LoginPage } from './pages/LoginPage';
import { DoctorDashboard } from './pages/DoctorDashboard';
import DoctorSchedule from './components/DoctorSchedule/DoctorSchedule';
import BookingCalendar from './components/BookingCalendar/BookingCalendarV2';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

function App() {
  // Авторизация
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Навигация
  const [currentView, setCurrentView] = useState('home');
  const [editingAppointmentData, setEditingAppointmentData] = useState(null);
  const [returnToClientId, setReturnToClientId] = useState(null);
  
  // Данные
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [doctors, setDoctors] = useState([]);
  
  // Модальные окна
  const [showClientModal, setShowClientModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showEditAppointmentModal, setShowEditAppointmentModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showClientCardModal, setShowClientCardModal] = useState(false);
  const [showClientHistoryModal, setShowClientHistoryModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  
  // Поиск и выбор
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [servicesPageSearch, setServicesPageSearch] = useState('');
  const [clientsPageSearch, setClientsPageSearch] = useState('');
  
  // Фильтр по дате
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  
  // Редактирование
  const [editingService, setEditingService] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editingAppointment, setEditingAppointment] = useState(null);

  // Формы
  const [clientForm, setClientForm] = useState({ 
    lastName: '', firstName: '', middleName: '', phone: '', address: '', email: '', notes: '' 
  });
  const [appointmentForm, setAppointmentForm] = useState({
    client_id: '', appointment_date: new Date().toISOString().slice(0, 16), doctor_id: '', services: [], notes: ''
  });
  const [serviceForm, setServiceForm] = useState({ name: '', price: '', description: '', category: '' });
  const [materialForm, setMaterialForm] = useState({ name: '', unit: '', price: '', stock: '', description: '' });

  // Проверка авторизации при загрузке
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const parsedUser = JSON.parse(user);
        setCurrentUser(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('user');
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated]);

  // Обработчик события создания записи из календаря - обновляем таблицу
  useEffect(() => {
    const handleAppointmentCreated = () => {
      if (isAuthenticated) {
        loadData();
      }
    };
    
    const handleAppointmentUpdated = () => {
      loadData();
    };

    window.addEventListener('appointmentCreated', handleAppointmentCreated);
    window.addEventListener('appointmentUpdated', handleAppointmentUpdated);
    
    return () => {
      window.removeEventListener('appointmentCreated', handleAppointmentCreated);
      window.removeEventListener('appointmentUpdated', handleAppointmentUpdated);
    };
  }, [isAuthenticated]);

  // Закрыть dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showClientDropdown && !event.target.closest('.client-search-wrapper')) {
        setShowClientDropdown(false);
      }
      if (showServiceDropdown && !event.target.closest('.service-search-wrapper')) {
        setShowServiceDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showClientDropdown, showServiceDropdown]);

  // Глобальная функция для открытия модалки записи из календаря
  useEffect(() => {
    window.openAppointmentModal = (prefillData) => {
      // Сохраняем дату как есть (локальная строка YYYY-MM-DDTHH:mm)
      let appointmentDate = '';
      if (prefillData?.appointment_date) {
        appointmentDate = prefillData.appointment_date;
      }

      setAppointmentForm({
        client_id: '',
        doctor_id: prefillData?.doctor_id || '',
        appointment_date: appointmentDate,
        notes: '',
        services: [],
        paid: false
      });
      // Не переключаем view, остаемся там где были
      setShowAppointmentModal(true);
    };

    return () => {
      delete window.openAppointmentModal;
    };
  }, []);

  // Функции авторизации
  const handleLogin = (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setCurrentView('home');
  };

  const loadData = async () => {
    try {
      const [appointmentsRes, clientsRes, servicesRes, doctorsRes, materialsRes] = await Promise.all([
        axios.get(`${API_URL}/appointments`),
        axios.get(`${API_URL}/clients`),
        axios.get(`${API_URL}/services`),
        axios.get(`${API_URL}/doctors`),
        axios.get(`${API_URL}/materials`)
      ]);
      setAppointments(appointmentsRes.data);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
      setDoctors(doctorsRes.data);
      setMaterials(materialsRes.data);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    }
  };

  // Фильтрация записей по дате
  const getAppointmentsByDate = () => {
    return appointments
      .filter(apt => {
        const aptDate = new Date(apt.appointment_date).toISOString().split('T')[0];
        return aptDate === selectedDate;
      })
      .sort((a, b) => a.id - b.id); // Сортировка по id (новые записи в конце)
  };

  // Фильтрация записей по врачу (для роли doctor)
  const getDoctorAppointments = () => {
    if (currentUser.role !== 'doctor' || !currentUser.doctor_id) return [];
    return getAppointmentsByDate().filter(apt => apt.doctor_id === currentUser.doctor_id);
  };

  // Обновление статуса звонка
  const toggleCallStatus = async (appointmentId, currentStatus) => {
    try {
      const newStatus = currentStatus ? 0 : 1;
      await axios.patch(`${API_URL}/appointments/${appointmentId}/call-status`, { called_today: newStatus });
      setAppointments(appointments.map(apt =>
        apt.id === appointmentId ? { ...apt, called_today: newStatus } : apt
      ));
    } catch (error) {
      alert('Ошибка обновления статуса звонка');
    }
  };

  // Обновление статуса записи
  const updateAppointmentStatus = async (appointmentId, status) => {
    try {
      await axios.patch(`${API_URL}/appointments/${appointmentId}/status`, { status });
      setAppointments(appointments.map(apt =>
        apt.id === appointmentId ? { ...apt, status } : apt
      ));
      
      // Если запись отменена, отправляем событие для обновления календаря
      if (status === 'cancelled') {
        window.dispatchEvent(new Event('appointmentCreated'));
      }
    } catch (error) {
      alert('Ошибка обновления статуса');
    }
  };

  // Отмена записи
  const handleCancelAppointment = async (appointmentId) => {
    try {
      await axios.patch(`${API_URL}/appointments/${appointmentId}/status`, { status: 'cancelled' });
      
      // Обновляем локальное состояние
      setAppointments(appointments.map(apt =>
        apt.id === appointmentId ? { ...apt, status: 'cancelled' } : apt
      ));
      
      // Отправляем событие для обновления календаря
      window.dispatchEvent(new Event('appointmentCreated'));
      
      // Перезагружаем данные для обновления истории клиента
      loadData();
      
      alert('✅ Запись отменена');
    } catch (error) {
      console.error('Ошибка отмены записи:', error);
      alert(`❌ ${error.response?.data?.error || error.message}`);
    }
  };

  // Открыть карточку клиента
  const openClientCard = (clientId) => {
    setSelectedClientId(clientId);
    setShowClientCardModal(true);
  };

  // Вспомогательные функции для таблицы
  const getServiceNames = (servicesList) => {
    if (!servicesList || servicesList.length === 0) return 'Услуги не указаны';
    return servicesList.map(s => {
      const service = services.find(serv => serv.id === s.service_id);
      return service ? `${service.name} x${s.quantity}` : 'Неизвестная услуга';
    }).join(', ');
  };

  const getDoctorName = (appointment) => {
    // Если передан объект врача напрямую
    if (appointment && typeof appointment === 'object' && appointment.lastName) {
      return getFullName(appointment.lastName, appointment.firstName, appointment.middleName);
    }
    
    // Если передан ID врача или запись с doctor_id
    if (appointment && (appointment.doctor_id || typeof appointment === 'number')) {
      const doctorId = typeof appointment === 'number' ? appointment : appointment.doctor_id;
      const doctor = doctors.find(d => d.id === doctorId);
      if (doctor) {
        return getFullName(doctor.lastName, doctor.firstName, doctor.middleName);
      }
    }
    
    // Если в записи есть поля врача напрямую (doctor_lastName, doctor_firstName, doctor_middleName)
    if (appointment && appointment.doctor_lastName) {
      return getFullName(appointment.doctor_lastName, appointment.doctor_firstName, appointment.doctor_middleName);
    }
    
    return '-';
  };

  const calculateAppointmentTotal = (servicesList) => {
    if (!servicesList || servicesList.length === 0) return 0;
    return servicesList.reduce((sum, s) => {
      const service = services.find(serv => serv.id === s.service_id);
      return sum + (service ? service.price * s.quantity : 0);
    }, 0);
  };

  // Создание клиента
  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      console.log('Отправка данных клиента:', clientForm);
      const response = await axios.post(`${API_URL}/clients`, clientForm);
      console.log('Ответ сервера:', response.data);
      const newClientId = response.data.id;
      
      // Если модалка записи открыта, автоматически выбираем нового клиента
      if (showAppointmentModal) {
        setAppointmentForm({ ...appointmentForm, client_id: newClientId });
        // Используем данные из формы для отображения
        setClientSearchQuery(getFullName(clientForm.lastName, clientForm.firstName, clientForm.middleName));
      }
      
      // Обновляем данные
      await loadData();
      
      // Очищаем форму и закрываем модалку
      setClientForm({ lastName: '', firstName: '', middleName: '', phone: '', address: '', email: '', notes: '' });
      setShowClientModal(false);
    } catch (error) {
      console.error('Ошибка создания клиента:', error);
      console.error('Ответ сервера:', error.response?.data);
      alert(`Ошибка создания клиента: ${error.response?.data?.error || error.message}`);
    }
  };

  // Создание записи
  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    
    if (!appointmentForm.client_id) {
      alert('Пожалуйста, выберите клиента');
      return;
    }
    if (!appointmentForm.doctor_id) {
      alert('Пожалуйста, выберите врача');
      return;
    }
    if (appointmentForm.services.length === 0) {
      alert('Пожалуйста, выберите хотя бы одну услугу');
      return;
    }
    
    try {
      // Отправляем дату как локальную строку БЕЗ конвертации timezone
      // Формат: YYYY-MM-DD HH:MM:SS (для PostgreSQL/SQLite)
      const localDateTime = appointmentForm.appointment_date.replace('T', ' ') + ':00';
      
      const appointmentData = {
        ...appointmentForm,
        appointment_date: localDateTime
      };
      
      await axios.post(`${API_URL}/appointments`, appointmentData);
      
      setAppointmentForm({
        client_id: '', appointment_date: new Date().toISOString().slice(0, 16), doctor_id: '', services: [], notes: ''
      });
      setShowAppointmentModal(false);
      setClientSearchQuery('');
      setServiceSearchQuery('');
      
      await loadData();
      
      // Отправляем событие для обновления календаря
      window.dispatchEvent(new Event('appointmentCreated'));
      
      alert('✅ Запись успешно создана!');
    } catch (error) {
      console.error('Ошибка создания записи:', error);
      
      // Закрываем модалку даже при ошибке
      setShowAppointmentModal(false);
      setClientSearchQuery('');
      setServiceSearchQuery('');
      
      // Отправляем событие для обновления календаря (чтобы обновились слоты)
      window.dispatchEvent(new Event('appointmentCreated'));
      
      alert(`❌ ${error.response?.data?.error || error.message}`);
    }
  };

  // Открыть редактирование записи
  const handleEditAppointment = (appointment) => {
    // Сохраняем данные записи для редактирования
    setEditingAppointmentData(appointment);
    // Сохраняем ID клиента для возврата в карточку
    if (showClientHistoryModal && selectedClientId) {
      setReturnToClientId(selectedClientId);
    }
    // Закрываем модалку истории клиента, если открыта
    if (showClientHistoryModal) {
      setShowClientHistoryModal(false);
    }
    // Открываем календарь
    setCurrentView('booking');
  };

  // Обновление записи
  const handleUpdateAppointment = async (e) => {
    e.preventDefault();
    if (!appointmentForm.client_id) {
      alert('Пожалуйста, выберите клиента');
      return;
    }
    if (!appointmentForm.doctor_id) {
      alert('Пожалуйста, выберите врача');
      return;
    }
    if (appointmentForm.services.length === 0) {
      alert('Пожалуйста, выберите хотя бы одну услугу');
      return;
    }
    try {
      console.log('Отправка обновления записи:', appointmentForm);
      await axios.put(`${API_URL}/appointments/${editingAppointment.id}`, appointmentForm);
      setAppointmentForm({
        client_id: '', appointment_date: new Date().toISOString().slice(0, 16), doctor_id: '', services: [], notes: ''
      });
      setEditingAppointment(null);
      setClientSearchQuery('');
      setServiceSearchQuery('');
      setShowEditAppointmentModal(false);
      loadData();
      alert('✅ Запись успешно обновлена');
    } catch (error) {
      console.error('Ошибка обновления записи:', error);
      console.error('Детали ошибки:', error.response?.data);
      alert(`Ошибка обновления записи: ${error.response?.data?.error || error.message}`);
    }
  };

  // CRUD для услуг
  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      if (editingService) {
        await axios.put(`${API_URL}/services/${editingService.id}`, serviceForm);
        setEditingService(null);
      } else {
        await axios.post(`${API_URL}/services`, serviceForm);
      }
      setServiceForm({ name: '', price: '', description: '', category: '' });
      setShowServiceModal(false);
      loadData();
    } catch (error) {
      alert('Ошибка сохранения услуги');
    }
  };

  const handleDeleteService = async (id) => {
    if (window.confirm('Удалить услугу?')) {
      try {
        await axios.delete(`${API_URL}/services/${id}`);
        loadData();
      } catch (error) {
        alert('Ошибка удаления услуги');
      }
    }
  };

  // CRUD для материалов
  const handleCreateMaterial = async (e) => {
    e.preventDefault();
    try {
      if (editingMaterial) {
        await axios.put(`${API_URL}/materials/${editingMaterial.id}`, materialForm);
        setEditingMaterial(null);
      } else {
        await axios.post(`${API_URL}/materials`, materialForm);
      }
      setMaterialForm({ name: '', unit: '', price: '', stock: '', description: '' });
      setShowMaterialModal(false);
      loadData();
    } catch (error) {
      alert('Ошибка сохранения материала');
    }
  };

  const handleDeleteMaterial = async (id) => {
    if (window.confirm('Удалить материал?')) {
      try {
        await axios.delete(`${API_URL}/materials/${id}`);
        loadData();
      } catch (error) {
        alert('Ошибка удаления материала');
      }
    }
  };

  // Фильтр клиентов для поиска
  const getFilteredClients = () => {
    if (!clientSearchQuery) return clients;
    return clients.filter(client => {
      const fullName = `${client.lastName} ${client.firstName} ${client.middleName}`.toLowerCase();
      const phone = client.phone || '';
      const query = clientSearchQuery.toLowerCase();
      return fullName.includes(query) || phone.includes(query);
    });
  };

  // Фильтр услуг для поиска
  const getFilteredServices = () => {
    if (!serviceSearchQuery) return services;
    return services.filter(service =>
      service.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())
    );
  };

  // Добавить/убрать услугу в форме записи
  const toggleServiceInAppointment = (serviceId) => {
    const existing = appointmentForm.services.find(s => s.service_id === serviceId);
    if (existing) {
      setAppointmentForm({
        ...appointmentForm,
        services: appointmentForm.services.filter(s => s.service_id !== serviceId)
      });
    } else {
      setAppointmentForm({
        ...appointmentForm,
        services: [...appointmentForm.services, { service_id: serviceId, quantity: 1 }]
      });
    }
  };

  const updateServiceQuantity = (serviceId, quantity) => {
    setAppointmentForm({
      ...appointmentForm,
      services: appointmentForm.services.map(s =>
        s.service_id === serviceId ? { ...s, quantity: parseInt(quantity) || 1 } : s
      )
    });
  };

  // Если не авторизован - показываем страницу входа
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLogin} />;
  }

  // Рендер основной страницы
  const renderHome = () => {
    const displayAppointments = currentUser.role === 'doctor'
      ? getDoctorAppointments()
      : getAppointmentsByDate();

    return (
      <div>
        {/* Навигационные карточки */}
        <NavigationCards
          onNavigate={setCurrentView}
          clientsCount={clients.length}
          servicesCount={services.length}
          materialsCount={materials.length}
          currentUser={currentUser}
        />

        {/* Заголовок и кнопки */}
        <div className="section-header">
          <div className="appointments-header-left">
            <h2>📅 Записи на дату</h2>
            <div className="date-filter">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="date-input"
              />
              <button
                className="btn btn-small"
                onClick={() => setSelectedDate(getTodayDateString())}
              >
                Сегодня
              </button>
            </div>
          </div>
          {currentUser.role !== 'doctor' && (
            <button className="btn btn-primary" onClick={() => setShowAppointmentModal(true)}>
              + Новая запись
            </button>
          )}
        </div>

        {/* Таблица записей */}
        <AppointmentTable
          appointments={displayAppointments}
          clients={clients}
          onClientClick={openClientCard}
          onCallStatusToggle={toggleCallStatus}
          onStatusChange={updateAppointmentStatus}
          onEditAppointment={handleEditAppointment}
          onCancelAppointment={handleCancelAppointment}
          getServiceNames={getServiceNames}
          getDoctorName={getDoctorName}
          calculateTotal={calculateAppointmentTotal}
          showPhoneIcon={currentUser.role !== 'doctor'}
          showDoctor={true}
          showPrice={currentUser.role !== 'doctor'}
          currentUser={currentUser}
        />
      </div>
    );
  };

  // Остальные страницы (renderClients, renderServices, renderMaterials, renderReports)
  // будут реализованы аналогично - выносом в отдельные Page компоненты

  return (
    <div className="App">
      {/* Header */}
      <div className="app-header">
        <div className="header-content">
          <div className="header-title">
            <h1>🏥 Система управления клиникой</h1>
            <p>Управление записями, клиентами и услугами</p>
          </div>
          <div className="header-user">
            <div className="user-info">
              <span className="user-name">{currentUser.full_name || currentUser.username}</span>
              <span className="user-role">
                {currentUser.role === 'superadmin' && '👑 Главный админ'}
                {currentUser.role === 'administrator' && '💼 Администратор'}
                {currentUser.role === 'doctor' && '👨‍⚕️ Врач'}
              </span>
            </div>
            <button className="btn btn-logout" onClick={handleLogout}>Выход</button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {currentView === 'home' && renderHome()}
        
        {/* Врачи - доступно администратору и superadmin */}
        {currentView === 'doctors' && (currentUser.role === 'superadmin' || currentUser.role === 'administrator') && (
          <DoctorsPage onNavigate={setCurrentView} currentUser={currentUser} />
        )}
        
        {/* Клиенты - доступно администратору и superadmin */}
        {currentView === 'clients' && (currentUser.role === 'superadmin' || currentUser.role === 'administrator') && (
          <div>
            <div className="section-header">
              <h2>👥 Все клиенты ({clients.filter(c => {
                const search = clientsPageSearch.toLowerCase();
                const fullName = `${c.lastName || ''} ${c.firstName || ''} ${c.middleName || ''}`.toLowerCase();
                const phone = (c.phone || '').toLowerCase();
                return fullName.includes(search) || phone.includes(search);
              }).length})</h2>
              <div>
                <button className="btn" onClick={() => setCurrentView('home')}>← Назад</button>
                <button className="btn btn-primary" onClick={() => setShowClientModal(true)}>+ Добавить клиента</button>
              </div>
            </div>

            {/* Поиск клиентов */}
            <div className="page-search-bar">
              <input
                type="text"
                placeholder="🔍 Поиск по ФИО или телефону..."
                value={clientsPageSearch}
                onChange={(e) => setClientsPageSearch(e.target.value)}
                className="page-search-input"
              />
              {clientsPageSearch && (
                <button 
                  className="btn btn-small"
                  onClick={() => setClientsPageSearch('')}
                >
                  ✕ Очистить
                </button>
              )}
            </div>

            <div className="clients-list-wide">
              {clients.filter(c => {
                const search = clientsPageSearch.toLowerCase();
                const fullName = `${c.lastName || ''} ${c.firstName || ''} ${c.middleName || ''}`.toLowerCase();
                const phone = (c.phone || '').toLowerCase();
                return fullName.includes(search) || phone.includes(search);
              }).length === 0 ? (
                <div className="empty-state">
                  <p>{clientsPageSearch ? 'Клиенты не найдены' : 'Нет клиентов'}</p>
                </div>
              ) : (
                <table className="wide-table">
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>#</th>
                      <th style={{ width: '25%' }}>ФИО</th>
                      <th style={{ width: '15%' }}>Телефон</th>
                      <th style={{ width: '25%' }}>Адрес</th>
                      <th style={{ width: '15%' }}>Email</th>
                      <th style={{ width: '15%' }}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients
                      .filter(c => {
                        const search = clientsPageSearch.toLowerCase();
                        const fullName = `${c.lastName || ''} ${c.firstName || ''} ${c.middleName || ''}`.toLowerCase();
                        const phone = (c.phone || '').toLowerCase();
                        return fullName.includes(search) || phone.includes(search);
                      })
                      .map((client, index) => (
                        <tr key={client.id}>
                          <td className="number-cell">{index + 1}</td>
                          <td>
                            <span
                              className="client-name-link"
                              onClick={() => {
                                setSelectedClientId(client.id);
                                setShowClientHistoryModal(true);
                              }}
                            >
                              {getFullName(client.lastName, client.firstName, client.middleName)}
                            </span>
                          </td>
                          <td>{client.phone || '-'}</td>
                          <td>{client.address || '-'}</td>
                          <td>{client.email || '-'}</td>
                          <td className="table-actions">
                            <button 
                              className="btn btn-small"
                              onClick={() => {
                                setSelectedClientId(client.id);
                                setShowClientHistoryModal(true);
                              }}
                            >
                              📋 Карточка
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        
        {/* Услуги - доступно администратору (просмотр) и superadmin (редактирование) */}
        {currentView === 'services' && (currentUser.role === 'superadmin' || currentUser.role === 'administrator') && (
          <div>
            <div className="section-header">
              <h2>💼 Все услуги ({services.filter(s => {
                const search = servicesPageSearch.toLowerCase();
                return s.name.toLowerCase().includes(search) || 
                       (s.category && s.category.toLowerCase().includes(search));
              }).length})</h2>
              <div>
                <button className="btn" onClick={() => setCurrentView('home')}>← Назад</button>
                {currentUser.role === 'superadmin' && (
                  <button className="btn btn-primary" onClick={() => setShowServiceModal(true)}>+ Добавить услугу</button>
                )}
              </div>
            </div>

            {/* Поиск услуг */}
            <div className="page-search-bar">
              <input
                type="text"
                placeholder="🔍 Поиск по разделу или названию услуги..."
                value={servicesPageSearch}
                onChange={(e) => setServicesPageSearch(e.target.value)}
                className="page-search-input"
              />
              {servicesPageSearch && (
                <button 
                  className="btn btn-small"
                  onClick={() => setServicesPageSearch('')}
                >
                  ✕ Очистить
                </button>
              )}
            </div>

            <div className="services-list-wide">
              {services.filter(s => {
                const search = servicesPageSearch.toLowerCase();
                return s.name.toLowerCase().includes(search) || 
                       (s.category && s.category.toLowerCase().includes(search));
              }).length === 0 ? (
                <div className="empty-state">
                  <p>{servicesPageSearch ? 'Услуги не найдены' : 'Нет услуг'}</p>
                </div>
              ) : (
                <table className="wide-table">
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>#</th>
                      <th style={{ width: '20%' }}>Раздел</th>
                      <th style={{ width: '30%' }}>Название услуги</th>
                      <th style={{ width: '12%' }}>Цена (BYN)</th>
                      <th style={{ width: '18%' }}>Описание</th>
                      {currentUser.role === 'superadmin' && <th style={{ width: '15%' }}>Действия</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {services
                      .filter(s => {
                        const search = servicesPageSearch.toLowerCase();
                        return s.name.toLowerCase().includes(search) || 
                               (s.category && s.category.toLowerCase().includes(search));
                      })
                      .map((service, index) => (
                        <tr key={service.id}>
                          <td className="service-number">{index + 1}</td>
                          <td className="service-category">
                            {service.category ? (
                              <span className="category-badge">{service.category}</span>
                            ) : (
                              <span className="no-category">Без раздела</span>
                            )}
                          </td>
                          <td><strong>{service.name}</strong></td>
                          <td className="service-price">{service.price.toFixed(2)} BYN</td>
                          <td className="service-description">{service.description || '-'}</td>
                          {currentUser.role === 'superadmin' && (
                            <td className="service-actions">
                              <button 
                                className="btn btn-small"
                                onClick={() => {
                                  setEditingService(service);
                                  setServiceForm(service);
                                  setShowServiceModal(true);
                                }}
                              >
                                ✏️ Редактировать
                              </button>
                              <button 
                                className="btn btn-small btn-danger"
                                onClick={() => handleDeleteService(service.id)}
                              >
                                🗑️ Удалить
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        
        {/* Материалы - только для superadmin */}
        {currentView === 'materials' && currentUser.role === 'superadmin' && (
          <div>
            <div className="section-header">
              <h2>📦 Все материалы</h2>
              <div>
                <button className="btn" onClick={() => setCurrentView('home')}>← Назад</button>
                <button className="btn btn-primary" onClick={() => setShowMaterialModal(true)}>+ Добавить материал</button>
              </div>
            </div>
            <div className="materials-list-wide">
              {materials.length === 0 ? (
                <div className="empty-state">
                  <p>Нет материалов</p>
                </div>
              ) : (
                <table className="wide-table">
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>#</th>
                      <th style={{ width: '25%' }}>Название</th>
                      <th style={{ width: '10%' }}>Единица</th>
                      <th style={{ width: '12%' }}>Цена (BYN)</th>
                      <th style={{ width: '10%' }}>Остаток</th>
                      <th style={{ width: '23%' }}>Описание</th>
                      <th style={{ width: '15%' }}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((material, index) => (
                      <tr key={material.id}>
                        <td className="number-cell">{index + 1}</td>
                        <td><strong>{material.name}</strong></td>
                        <td>{material.unit}</td>
                        <td className="service-price">{material.price} BYN</td>
                        <td>{material.stock}</td>
                        <td className="service-description">{material.description || '-'}</td>
                        <td className="table-actions">
                          <button 
                            className="btn btn-small"
                            onClick={() => {
                              setEditingMaterial(material);
                              setMaterialForm(material);
                              setShowMaterialModal(true);
                            }}
                          >
                            ✏️ Редактировать
                          </button>
                          <button 
                            className="btn btn-small btn-danger"
                            onClick={() => handleDeleteMaterial(material.id)}
                          >
                            🗑️ Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        
        {/* Отчеты - только для superadmin */}
        {currentView === 'reports' && currentUser.role === 'superadmin' && (
          <div>
            <div className="section-header">
              <h2>📊 Отчеты и статистика</h2>
              <button className="btn" onClick={() => setCurrentView('home')}>← Назад</button>
            </div>
            <div className="empty-state">
              <p>Раздел в разработке</p>
            </div>
          </div>
        )}

        {/* Расписание врачей - доступно всем */}
        {/* Личный кабинет врача */}
        {currentView === 'doctor-dashboard' && currentUser.role === 'doctor' && (
          <DoctorDashboard currentUser={currentUser} onNavigate={setCurrentView} />
        )}
        
        {currentView === 'schedule' && (
          <div>
            <button className="btn" onClick={() => setCurrentView('home')} style={{ marginBottom: '20px' }}>← Назад</button>
            <DoctorSchedule 
              currentUser={currentUser}
              doctors={doctors}
            />
          </div>
        )}

        {/* Календарь записи - для администраторов */}
        {currentView === 'booking' && (
          <BookingCalendar 
            currentUser={currentUser}
            onBack={() => {
              // Если есть клиент для возврата, открываем его карточку
              if (returnToClientId) {
                setSelectedClientId(returnToClientId);
                setShowClientHistoryModal(true);
                setReturnToClientId(null);
              } else {
                setCurrentView('home');
              }
              setEditingAppointmentData(null);
            }}
            editingAppointment={editingAppointmentData}
            onEditComplete={() => {
              setEditingAppointmentData(null);
              loadData();
              // Если есть клиент для возврата, открываем его карточку
              if (returnToClientId) {
                setSelectedClientId(returnToClientId);
                setShowClientHistoryModal(true);
                setReturnToClientId(null);
              }
            }}
          />
        )}
      </div>

      {/* Модальное окно карточки клиента */}
      {showClientCardModal && (
        <ClientCard
          clientId={selectedClientId}
          clients={clients}
          services={services}
          materials={materials}
          doctors={doctors}
          currentUser={currentUser}
          onClose={() => setShowClientCardModal(false)}
          onUpdate={loadData}
        />
      )}

      {/* Модальное окно истории клиента */}
      {showClientHistoryModal && (
        <ClientHistoryCard
          clientId={selectedClientId}
          clients={clients}
          onClose={() => setShowClientHistoryModal(false)}
          onEditAppointment={handleEditAppointment}
          onCancelAppointment={handleCancelAppointment}
        />
      )}

      {/* Модальные окна для создания/редактирования (упрощенная версия) */}
      {/* TODO: вынести модальные окна в отдельные компоненты */}

      {/* Модальное окно создания записи */}
      {showAppointmentModal && (
        <div className="modal-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setShowAppointmentModal(false);
          }
        }}>
          <div className="modal">
            <h2>Новая запись</h2>
            <form onSubmit={handleCreateAppointment}>
              {/* Выбор клиента с поиском */}
              <div className="client-select-group">
                <label>Клиент *</label>
                <div className="client-search-wrapper">
                  <input
                    type="text"
                    placeholder="Поиск клиента по ФИО или телефону..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    onFocus={() => setShowClientDropdown(true)}
                    className="client-search-input"
                  />
                  {showClientDropdown && (
                    <div className="client-dropdown">
                      {getFilteredClients().length > 0 ? (
                        getFilteredClients().map(client => (
                          <div
                            key={client.id}
                            className="client-dropdown-item"
                            onClick={() => {
                              setAppointmentForm({ ...appointmentForm, client_id: client.id });
                              setClientSearchQuery(getFullName(client.lastName, client.firstName, client.middleName));
                              setShowClientDropdown(false);
                            }}
                          >
                            <div>{getFullName(client.lastName, client.firstName, client.middleName)}</div>
                            <div className="client-phone">{client.phone}</div>
                          </div>
                        ))
                      ) : (
                        <div className="client-dropdown-empty">Клиенты не найдены</div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => setShowClientModal(true)}
                >
                  + Создать нового клиента
                </button>
              </div>

              {/* Показываем выбранное время только для информации (не редактируемое) */}
              <div style={{ 
                padding: '15px', 
                background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f5ff 100%)', 
                borderRadius: '10px', 
                marginBottom: '20px',
                border: '2px solid #667eea'
              }}>
                <div style={{ fontSize: '0.9rem', color: '#667eea', marginBottom: '8px', fontWeight: '600' }}>
                  📅 Дата и время записи:
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#333' }}>
                  {appointmentForm.appointment_date ? 
                    new Date(appointmentForm.appointment_date).toLocaleString('ru-RU', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) 
                    : 'Время не выбрано'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '5px' }}>
                  💡 Время выбирается в календаре
                </div>
              </div>

              <label>Врач *</label>
              {appointmentForm.doctor_id ? (
                <div style={{
                  padding: '12px',
                  background: '#f0f7ff',
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#667eea' }}>
                    👨‍⚕️ {(() => {
                      const doctor = doctors.find(d => d.id === parseInt(appointmentForm.doctor_id));
                      return doctor ? `${getFullName(doctor.lastName, doctor.firstName, doctor.middleName)} - ${doctor.specialization}` : 'Врач выбран';
                    })()}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '5px' }}>
                    💡 Врач выбирается в календаре
                  </div>
                </div>
              ) : (
                <select
                  value={appointmentForm.doctor_id}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, doctor_id: e.target.value })}
                  required
                >
                  <option value="">Выберите врача</option>
                  {doctors.map(doctor => (
                    <option key={doctor.id} value={doctor.id}>
                      {getFullName(doctor.lastName, doctor.firstName, doctor.middleName)} - {doctor.specialization}
                    </option>
                  ))}
                </select>
              )}

              <label>Услуги</label>
              <div className="service-search-wrapper">
                <input
                  type="text"
                  placeholder="Поиск услуги..."
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  onFocus={() => setShowServiceDropdown(true)}
                  className="service-search-input"
                />
                {showServiceDropdown && (
                  <div className="service-dropdown">
                    {getFilteredServices().length > 0 ? (
                      getFilteredServices().map(service => {
                        const isAdded = appointmentForm.services.find(s => s.service_id === service.id);
                        return (
                          <div
                            key={service.id}
                            className={`service-dropdown-item ${isAdded ? 'already-added' : ''}`}
                            onClick={() => !isAdded && toggleServiceInAppointment(service.id)}
                          >
                            <span>{service.name}</span>
                            {isAdded && <span className="added-mark">✓</span>}
                          </div>
                        );
                      })
                    ) : (
                      <div className="service-dropdown-empty">Услуги не найдены</div>
                    )}
                  </div>
                )}
              </div>

              {appointmentForm.services.length > 0 && (
                <div className="selected-services-table">
                  <label>Выбранные услуги ({appointmentForm.services.length}):</label>
                  <table className="services-simple-table">
                    <thead>
                      <tr>
                        <th>Услуга</th>
                        <th style={{ width: '80px' }}>Кол-во</th>
                        <th style={{ width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointmentForm.services.map(item => {
                        const service = services.find(s => s.id === item.service_id);
                        if (!service) return null;
                        return (
                          <tr key={item.service_id}>
                            <td>{service.name}</td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateServiceQuantity(item.service_id, e.target.value)}
                                className="quantity-input-simple"
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="remove-btn-simple"
                                onClick={() => toggleServiceInAppointment(item.service_id)}
                                title="Удалить"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <label>Заметки</label>
              <textarea
                placeholder="Дополнительная информация"
                value={appointmentForm.notes}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                rows={3}
              />

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => {
                    setShowAppointmentModal(false);
                    setClientSearchQuery('');
                    setServiceSearchQuery('');
                    setAppointmentForm({
                      client_id: '',
                      appointment_date: new Date().toISOString().slice(0, 16),
                      doctor_id: '',
                      services: [],
                      notes: ''
                    });
                  }}
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  Создать запись
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования записи */}
      {showEditAppointmentModal && (
        <div className="modal-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setShowEditAppointmentModal(false);
            setEditingAppointment(null);
            setClientSearchQuery('');
            setServiceSearchQuery('');
          }
        }}>
          <div className="modal">
            <h2>✏️ Редактировать запись</h2>
            <form onSubmit={handleUpdateAppointment}>
              {/* Выбор клиента с поиском */}
              <div className="client-select-group">
                <label>Клиент *</label>
                <div className="client-search-wrapper">
                  <input
                    type="text"
                    placeholder="Поиск клиента по ФИО или телефону..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    onFocus={() => setShowClientDropdown(true)}
                    className="client-search-input"
                  />
                  {showClientDropdown && (
                    <div className="client-dropdown">
                      {getFilteredClients().length > 0 ? (
                        getFilteredClients().map(client => (
                          <div
                            key={client.id}
                            className="client-dropdown-item"
                            onClick={() => {
                              setAppointmentForm({ ...appointmentForm, client_id: client.id });
                              setClientSearchQuery(getFullName(client.lastName, client.firstName, client.middleName));
                              setShowClientDropdown(false);
                            }}
                          >
                            <div>{getFullName(client.lastName, client.firstName, client.middleName)}</div>
                            <div className="client-phone">{client.phone}</div>
                          </div>
                        ))
                      ) : (
                        <div className="client-dropdown-empty">Клиенты не найдены</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <label>Дата и время *</label>
              <input
                type="datetime-local"
                value={appointmentForm.appointment_date}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_date: e.target.value })}
                required
              />

              <label>Врач *</label>
              <select
                value={appointmentForm.doctor_id}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, doctor_id: e.target.value })}
                required
              >
                <option value="">Выберите врача</option>
                {doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    {getFullName(doctor.lastName, doctor.firstName, doctor.middleName)} - {doctor.specialization}
                  </option>
                ))}
              </select>

              <label>Услуги</label>
              <div className="service-search-wrapper">
                <input
                  type="text"
                  placeholder="Поиск услуги..."
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  onFocus={() => setShowServiceDropdown(true)}
                  className="service-search-input"
                />
                {showServiceDropdown && (
                  <div className="service-dropdown">
                    {getFilteredServices().length > 0 ? (
                      getFilteredServices().map(service => {
                        const isAdded = appointmentForm.services.find(s => s.service_id === service.id);
                        return (
                          <div
                            key={service.id}
                            className={`service-dropdown-item ${isAdded ? 'already-added' : ''}`}
                            onClick={() => !isAdded && toggleServiceInAppointment(service.id)}
                          >
                            <span>{service.name}</span>
                            {isAdded && <span className="added-mark">✓</span>}
                          </div>
                        );
                      })
                    ) : (
                      <div className="service-dropdown-empty">Услуги не найдены</div>
                    )}
                  </div>
                )}
              </div>

              {appointmentForm.services.length > 0 && (
                <div className="selected-services-table">
                  <label>Выбранные услуги ({appointmentForm.services.length}):</label>
                  <table className="services-simple-table">
                    <thead>
                      <tr>
                        <th>Услуга</th>
                        <th style={{ width: '80px' }}>Кол-во</th>
                        <th style={{ width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointmentForm.services.map(item => {
                        const service = services.find(s => s.id === item.service_id);
                        if (!service) return null;
                        return (
                          <tr key={item.service_id}>
                            <td>{service.name}</td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateServiceQuantity(item.service_id, e.target.value)}
                                className="quantity-input-simple"
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="remove-btn-simple"
                                onClick={() => toggleServiceInAppointment(item.service_id)}
                                title="Удалить"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <label>Заметки</label>
              <textarea
                placeholder="Дополнительная информация"
                value={appointmentForm.notes}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                rows={3}
              />

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => {
                    setShowEditAppointmentModal(false);
                    setEditingAppointment(null);
                    setClientSearchQuery('');
                    setServiceSearchQuery('');
                    setAppointmentForm({
                      client_id: '',
                      appointment_date: new Date().toISOString().slice(0, 16),
                      doctor_id: '',
                      services: [],
                      notes: ''
                    });
                  }}
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  💾 Сохранить изменения
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно создания/редактирования услуги */}
      {showServiceModal && (
        <div className="modal-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setShowServiceModal(false);
            setEditingService(null);
            setServiceForm({ name: '', price: '', description: '', category: '' });
          }
        }}>
          <div className="modal">
            <h2>{editingService ? 'Редактировать услугу' : 'Новая услуга'}</h2>
            <form onSubmit={handleCreateService}>
              <label>Раздел услуги</label>
              <input
                type="text"
                placeholder="Например: Стоматология, Косметология, УЗИ..."
                value={serviceForm.category}
                onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
              />

              <label>Название услуги *</label>
              <input
                type="text"
                placeholder="Название услуги"
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                required
              />

              <label>Цена (BYN) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={serviceForm.price}
                onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                required
              />

              <label>Описание</label>
              <textarea
                placeholder="Описание услуги (необязательно)"
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                rows={3}
              />

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => {
                    setShowServiceModal(false);
                    setEditingService(null);
                    setServiceForm({ name: '', price: '', description: '', category: '' });
                  }}
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingService ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно создания/редактирования материала */}
      {showMaterialModal && (
        <div className="modal-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setShowMaterialModal(false);
            setEditingMaterial(null);
            setMaterialForm({ name: '', unit: '', price: '', stock: '', description: '' });
          }
        }}>
          <div className="modal">
            <h2>{editingMaterial ? 'Редактировать материал' : 'Новый материал'}</h2>
            <form onSubmit={handleCreateMaterial}>
              <label>Название материала *</label>
              <input
                type="text"
                placeholder="Название материала"
                value={materialForm.name}
                onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                required
              />

              <label>Единица измерения</label>
              <input
                type="text"
                placeholder="шт, кг, л, мл..."
                value={materialForm.unit}
                onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
              />

              <label>Цена (BYN) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={materialForm.price}
                onChange={(e) => setMaterialForm({ ...materialForm, price: e.target.value })}
                required
              />

              <label>Остаток на складе</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={materialForm.stock}
                onChange={(e) => setMaterialForm({ ...materialForm, stock: e.target.value })}
              />

              <label>Описание</label>
              <textarea
                placeholder="Описание материала (необязательно)"
                value={materialForm.description}
                onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                rows={3}
              />

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => {
                    setShowMaterialModal(false);
                    setEditingMaterial(null);
                    setMaterialForm({ name: '', unit: '', price: '', stock: '', description: '' });
                  }}
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingMaterial ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно создания клиента */}
      {showClientModal && (
        <div 
          className="modal-overlay" 
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowClientModal(false);
            }
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Новый клиент</h2>
            <form onSubmit={handleCreateClient}>
              <label>Фамилия *</label>
              <input
                type="text"
                placeholder="Фамилия"
                value={clientForm.lastName}
                onChange={(e) => setClientForm({ ...clientForm, lastName: e.target.value })}
                required
              />

              <label>Имя *</label>
              <input
                type="text"
                placeholder="Имя"
                value={clientForm.firstName}
                onChange={(e) => setClientForm({ ...clientForm, firstName: e.target.value })}
                required
              />

              <label>Отчество</label>
              <input
                type="text"
                placeholder="Отчество"
                value={clientForm.middleName}
                onChange={(e) => setClientForm({ ...clientForm, middleName: e.target.value })}
              />

              <label>Телефон *</label>
              <input
                type="tel"
                placeholder="+375..."
                value={clientForm.phone}
                onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                required
              />

              <label>Адрес проживания *</label>
              <input
                type="text"
                placeholder="Адрес"
                value={clientForm.address}
                onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                required
              />

              <label>Email</label>
              <input
                type="email"
                placeholder="email@example.com"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              />

              <label>Заметки</label>
              <textarea
                placeholder="Дополнительная информация"
                value={clientForm.notes}
                onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                rows={3}
              />

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setShowClientModal(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
