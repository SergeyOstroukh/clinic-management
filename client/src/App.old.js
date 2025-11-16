import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';
import { format } from 'date-fns';
import ru from 'date-fns/locale/ru';

// FSD imports
import { DoctorsPage } from './pages/DoctorsPage';
import { LoginPage } from './pages/LoginPage';

// Автоматическое определение API URL
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

function App() {
  // Авторизация
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [currentView, setCurrentView] = useState('home');
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [doctors, setDoctors] = useState([]);
  
  const [showClientModal, setShowClientModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showInlineClientForm, setShowInlineClientForm] = useState(false);
  const [showClientCardModal, setShowClientCardModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [clientHistory, setClientHistory] = useState([]);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  
  // Фильтр по дате для записей
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Калькулятор сдачи
  const [paidAmount, setPaidAmount] = useState('');
  
  // Редактирование процедур текущего визита
  const [editingVisitProcedures, setEditingVisitProcedures] = useState(false);
  const [visitProcedures, setVisitProcedures] = useState([]);
  const [visitServiceSearch, setVisitServiceSearch] = useState('');
  
  // Скидка для администратора
  const [discountType, setDiscountType] = useState('percent'); // percent или fixed
  const [discountValue, setDiscountValue] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  
  const [editingService, setEditingService] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);
  // editingDoctor moved to DoctorsPage

  const [clientForm, setClientForm] = useState({ 
    lastName: '', 
    firstName: '', 
    middleName: '', 
    phone: '', 
    address: '', 
    email: '', 
    notes: '' 
  });
  const [appointmentForm, setAppointmentForm] = useState({
    client_id: '',
    appointment_date: new Date().toISOString().slice(0, 16),
    doctor_id: '',
    services: [],
    notes: ''
  });
  const [serviceForm, setServiceForm] = useState({ name: '', price: '', description: '' });
  const [materialForm, setMaterialForm] = useState({ name: '', unit: '', price: '', stock: '', description: '' });
  // doctorForm moved to DoctorsPage

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
    if (isAuthenticated) {
      loadData();
    }
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

  // Функции авторизации
  const handleLogin = (user) => {
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

  // Получить записи на выбранную дату
  const getAppointmentsByDate = () => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.appointment_date).toISOString().split('T')[0];
      return aptDate === selectedDate;
    });
  };

  const resetClientForm = () => {
    setClientForm({ 
      lastName: '', 
      firstName: '', 
      middleName: '', 
      phone: '', 
      address: '', 
      email: '', 
      notes: '' 
    });
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/clients`, clientForm);
      resetClientForm();
      setShowClientModal(false);
      loadData();
    } catch (error) {
      alert('Ошибка создания клиента');
    }
  };

  const handleCreateClientInline = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/clients`, clientForm);
      const newClient = response.data;
      resetClientForm();
      setShowInlineClientForm(false);
      await loadData();
      // Автоматически выбираем нового клиента
      setAppointmentForm({ ...appointmentForm, client_id: newClient.id });
    } catch (error) {
      alert('Ошибка создания клиента');
    }
  };

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    if (!appointmentForm.client_id) {
      alert('Пожалуйста, выберите клиента');
      return;
    }
    if (!appointmentForm.doctor_id || appointmentForm.doctor_id === '') {
      alert('Пожалуйста, выберите врача');
      return;
    }
    if (appointmentForm.services.length === 0) {
      alert('Пожалуйста, выберите хотя бы одну услугу');
      return;
    }
    try {
      await axios.post(`${API_URL}/appointments`, appointmentForm);
      setAppointmentForm({
        client_id: '',
        appointment_date: new Date().toISOString().slice(0, 16),
        doctor_id: '',
        services: [],
        notes: ''
      });
      setShowAppointmentModal(false);
      setShowInlineClientForm(false);
      resetClientForm();
      setClientSearchQuery('');
      setShowClientDropdown(false);
      setServiceSearchQuery('');
      setShowServiceDropdown(false);
      loadData();
    } catch (error) {
      alert('Ошибка создания записи');
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      if (editingService) {
        await axios.put(`${API_URL}/services/${editingService.id}`, serviceForm);
        setEditingService(null);
      } else {
        await axios.post(`${API_URL}/services`, serviceForm);
      }
      setServiceForm({ name: '', price: '', description: '' });
      setShowServiceModal(false);
      loadData();
    } catch (error) {
      alert('Ошибка сохранения услуги');
    }
  };

  const handleEditService = (service) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      price: service.price,
      description: service.description || ''
    });
    setShowServiceModal(true);
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

  // Функции для работы с врачами moved to DoctorsPage

  const getDoctorName = (doctorInfo) => {
    if (!doctorInfo) return '-';
    const fullName = `${doctorInfo.lastName || ''} ${doctorInfo.firstName || ''} ${doctorInfo.middleName || ''}`.trim();
    return fullName || '-';
  };

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

  const calculateTotal = () => {
    return appointmentForm.services.reduce((sum, item) => {
      const service = services.find(s => s.id === item.service_id);
      return sum + (service ? service.price * item.quantity : 0);
    }, 0);
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return 'Неизвестный клиент';
    // Формируем ФИО
    return `${client.lastName || ''} ${client.firstName || ''} ${client.middleName || ''}`.trim() || client.name || 'Неизвестный клиент';
  };

  const getClientPhone = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.phone || '-';
  };

  const toggleCallStatus = async (appointmentId, currentStatus) => {
    try {
      await axios.patch(`${API_URL}/appointments/${appointmentId}/call-status`, {
        called_today: !currentStatus
      });
      // Обновляем только конкретную запись без перезагрузки всей таблицы
      setAppointments(appointments.map(apt => 
        apt.id === appointmentId ? { ...apt, called_today: !currentStatus ? 1 : 0 } : apt
      ));
    } catch (error) {
      alert('Ошибка обновления статуса звонка');
    }
  };

  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    try {
      await axios.patch(`${API_URL}/appointments/${appointmentId}/status`, {
        status: newStatus
      });
      // Обновляем только конкретную запись без перезагрузки всей таблицы
      setAppointments(appointments.map(apt => 
        apt.id === appointmentId ? { ...apt, status: newStatus } : apt
      ));
    } catch (error) {
      alert('Ошибка обновления статуса');
    }
  };

  const openClientCard = async (clientId) => {
    try {
      setSelectedClientId(clientId);
      const response = await axios.get(`${API_URL}/clients/${clientId}/appointments`);
      setClientHistory(response.data);
      setPaidAmount(''); // Сбрасываем калькулятор
      setEditingVisitProcedures(false);
      setVisitProcedures([]);
      // Сбрасываем скидку
      setDiscountValue('');
      setAppliedDiscount(0);
      setShowClientCardModal(true);
    } catch (error) {
      alert('Ошибка загрузки истории клиента');
    }
  };

  const applyDiscount = (originalTotal) => {
    if (!discountValue || parseFloat(discountValue) <= 0) {
      setAppliedDiscount(0);
      return originalTotal;
    }

    const discountVal = parseFloat(discountValue);
    let discountAmount = 0;

    if (discountType === 'percent') {
      // Процентная скидка
      discountAmount = (originalTotal * discountVal) / 100;
    } else {
      // Фиксированная скидка
      discountAmount = discountVal;
    }

    // Скидка не может быть больше общей суммы
    if (discountAmount > originalTotal) {
      discountAmount = originalTotal;
    }

    setAppliedDiscount(discountAmount);
    return originalTotal - discountAmount;
  };

  const startEditingProcedures = (visit) => {
    setVisitProcedures(visit.services || []);
    setEditingVisitProcedures(true);
  };

  const addProcedureToVisit = (serviceId) => {
    const existing = visitProcedures.find(s => s.service_id === serviceId);
    if (!existing) {
      setVisitProcedures([...visitProcedures, { service_id: serviceId, quantity: 1 }]);
    }
    setVisitServiceSearch('');
  };

  const removeProcedureFromVisit = (serviceId) => {
    setVisitProcedures(visitProcedures.filter(s => s.service_id !== serviceId));
  };

  const updateProcedureQuantity = (serviceId, quantity) => {
    setVisitProcedures(visitProcedures.map(s => 
      s.service_id === serviceId ? { ...s, quantity: parseInt(quantity) || 1 } : s
    ));
  };

  const saveProcedures = async (visitId) => {
    try {
      await axios.patch(`${API_URL}/appointments/${visitId}/procedures`, {
        services: visitProcedures
      });
      setEditingVisitProcedures(false);
      // Перезагружаем историю клиента
      const response = await axios.get(`${API_URL}/clients/${selectedClientId}/appointments`);
      setClientHistory(response.data);
      // Также обновляем общий список записей
      loadData();
    } catch (error) {
      alert('Ошибка сохранения процедур');
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'scheduled': return '#667eea'; // Запланирован
      case 'waiting': return '#ffa751'; // Ожидает
      case 'in-progress': return '#4ecdc4'; // На приеме
      case 'ready_for_payment': return '#ff9800'; // Готов к оплате (оранжевый яркий)
      case 'completed': return '#95e1d3'; // Завершен
      case 'cancelled': return '#ff4757'; // Отменен
      default: return '#999';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'scheduled': return 'Запланирован';
      case 'waiting': return 'Ожидает';
      case 'in-progress': return 'На приеме';
      case 'ready_for_payment': return 'Готов к оплате';
      case 'completed': return 'Завершен';
      case 'cancelled': return 'Отменен';
      default: return 'Неизвестно';
    }
  };

  const getServiceNames = (servicesList) => {
    if (!servicesList || servicesList.length === 0) return 'Услуги не указаны';
    return servicesList.map(s => {
      const service = services.find(serv => serv.id === s.service_id);
      return service ? `${service.name} x${s.quantity}` : 'Неизвестная услуга';
    }).join(', ');
  };

  const calculateAppointmentTotal = (servicesList) => {
    if (!servicesList || servicesList.length === 0) return 0;
    return servicesList.reduce((sum, s) => {
      const service = services.find(serv => serv.id === s.service_id);
      return sum + (service ? service.price * s.quantity : 0);
    }, 0);
  };

  // Фильтрация клиентов по поиску
  const filterClients = () => {
    if (!clientSearchQuery.trim()) return clients;
    
    const query = clientSearchQuery.toLowerCase();
    return clients.filter(client => {
      const lastName = (client.lastName || '').toLowerCase();
      const firstName = (client.firstName || '').toLowerCase();
      const middleName = (client.middleName || '').toLowerCase();
      const name = (client.name || '').toLowerCase();
      const phone = (client.phone || '').toLowerCase();
      return lastName.includes(query) || firstName.includes(query) || middleName.includes(query) || name.includes(query) || phone.includes(query);
    });
  };

  // Получить отображаемое имя клиента для поиска
  const getClientDisplayName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return '';
    const fullName = `${client.lastName || ''} ${client.firstName || ''} ${client.middleName || ''}`.trim() || client.name || 'Неизвестный';
    return `${fullName}${client.phone ? ' - ' + client.phone : ''}`;
  };

  // Выбрать клиента
  const selectClient = (clientId) => {
    setAppointmentForm({ ...appointmentForm, client_id: clientId });
    setClientSearchQuery(getClientDisplayName(clientId));
    setShowClientDropdown(false);
  };

  // Фильтрация услуг по поиску
  const filterServices = () => {
    if (!serviceSearchQuery.trim()) return services;
    
    const query = serviceSearchQuery.toLowerCase();
    return services.filter(service => {
      const name = (service.name || '').toLowerCase();
      const description = (service.description || '').toLowerCase();
      return name.includes(query) || description.includes(query);
    });
  };

  // Добавить услугу в запись
  const addServiceToAppointment = (serviceId) => {
    const existing = appointmentForm.services.find(s => s.service_id === serviceId);
    if (!existing) {
      setAppointmentForm({
        ...appointmentForm,
        services: [...appointmentForm.services, { service_id: serviceId, quantity: 1 }]
      });
    }
    setServiceSearchQuery('');
    setShowServiceDropdown(false);
  };

  // Удалить услугу из записи
  const removeServiceFromAppointment = (serviceId) => {
    setAppointmentForm({
      ...appointmentForm,
      services: appointmentForm.services.filter(s => s.service_id !== serviceId)
    });
  };

  // Рендер главной страницы
  const renderHome = () => {
    // Для врача показываем только свои записи (без навигационных карточек)
    if (currentUser.role === 'doctor') {
      const myAppointments = appointments.filter(apt => apt.doctor_id === currentUser.doctor_id);
      const appointmentsForDate = myAppointments.filter(apt => {
        const aptDate = new Date(apt.appointment_date).toISOString().split('T')[0];
        return aptDate === selectedDate;
      });

      return (
        <div className="home-view">
          {/* Записи врача на выбранную дату */}
          <div className="today-appointments">
            <div className="section-header">
              <div className="appointments-header-left">
                <h2>📅 Мои записи на дату</h2>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="date-filter"
                />
                <button
                  className="btn btn-small"
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                >
                  Сегодня
                </button>
              </div>
            </div>

            {appointmentsForDate.length === 0 ? (
              <div className="empty-state">
                <p>На выбранную дату нет записей</p>
              </div>
            ) : (
              <div className="appointments-table">
                <table>
                  <thead>
                    <tr>
                      <th>Время</th>
                      <th>ФИО клиента</th>
                      <th>Телефон</th>
                      <th>Процедуры</th>
                      <th>Стоимость</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointmentsForDate.map(apt => (
                      <tr key={apt.id}>
                        <td className="time-cell">
                          {format(new Date(apt.appointment_date), 'HH:mm')}
                        </td>
                        <td className="client-cell">
                          <span
                            className="client-name-link"
                            onClick={() => openClientCard(apt.client_id)}
                          >
                            {getClientName(apt.client_id)}
                          </span>
                        </td>
                        <td className="phone-cell">
                          <span>{getClientPhone(apt.client_id)}</span>
                        </td>
                        <td className="services-cell">{getServiceNames(apt.services)}</td>
                        <td className="price-cell">{calculateAppointmentTotal(apt.services).toFixed(2)} BYN</td>
                        <td className="status-cell">
                          <select
                            value={apt.status}
                            onChange={(e) => updateAppointmentStatus(apt.id, e.target.value)}
                            className="status-select"
                            style={{ backgroundColor: getStatusColor(apt.status) }}
                          >
                            <option value="scheduled">Запланирован</option>
                            <option value="waiting">Ожидает</option>
                            <option value="in-progress">На приеме</option>
                            <option value="ready_for_payment">Готов к оплате</option>
                            <option value="completed">Завершен</option>
                            <option value="cancelled">Отменен</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Для администратора и главного админа показываем карточки навигации
    return (
      <div className="home-view">
        {/* Карточки навигации */}
        <div className="navigation-cards">
          {/* Врачи - только для главного админа */}
          {currentUser.role === 'superadmin' && (
            <div className="nav-card" onClick={() => setCurrentView('doctors')}>
              <div className="nav-card-icon">👨‍⚕️</div>
              <h3>Наши врачи</h3>
              <p className="nav-card-count">Персонал</p>
            </div>
          )}
          
          {/* Клиенты - для администратора и главного админа */}
          {currentUser.role !== 'doctor' && (
            <div className="nav-card" onClick={() => setCurrentView('clients')}>
              <div className="nav-card-icon">👥</div>
              <h3>Все клиенты</h3>
              <p className="nav-card-count">{clients.length} клиентов</p>
            </div>
          )}
          
          {/* Услуги - только для главного админа */}
          {currentUser.role === 'superadmin' && (
            <div className="nav-card" onClick={() => setCurrentView('services')}>
              <div className="nav-card-icon">💼</div>
              <h3>Все услуги</h3>
              <p className="nav-card-count">{services.length} услуг</p>
            </div>
          )}
          
          {/* Материалы - только для главного админа */}
          {currentUser.role === 'superadmin' && (
            <div className="nav-card" onClick={() => setCurrentView('materials')}>
              <div className="nav-card-icon">📦</div>
              <h3>Все материалы</h3>
              <p className="nav-card-count">{materials.length} материалов</p>
            </div>
          )}
          
          {/* Отчеты - только для главного админа */}
          {currentUser.role === 'superadmin' && (
            <div className="nav-card" onClick={() => setCurrentView('reports')}>
              <div className="nav-card-icon">📊</div>
              <h3>Отчеты</h3>
              <p className="nav-card-count">Статистика</p>
            </div>
          )}
        </div>

      {/* Записи на выбранную дату */}
      <div className="today-appointments">
        <div className="section-header">
          <div className="appointments-header-left">
            <h2>📅 Записи на дату</h2>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-filter"
            />
            <button 
              className="btn btn-small" 
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            >
              Сегодня
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => {
            setShowAppointmentModal(true);
            setClientSearchQuery('');
            setShowClientDropdown(false);
          }}>
            + Новая запись
          </button>
        </div>

            {getAppointmentsByDate().length === 0 ? (
              <div className="empty-state">
                <p>На выбранную дату нет записей</p>
              </div>
            ) : (
              <div className="appointments-table">
                <table>
                  <thead>
                    <tr>
                      <th>Время</th>
                      <th>ФИО клиента</th>
                      <th>Телефон</th>
                      <th>Процедуры</th>
                      <th>Врач</th>
                      <th>Стоимость</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getAppointmentsByDate().map(apt => (
                      <tr key={apt.id}>
                        <td className="time-cell">
                          {format(new Date(apt.appointment_date), 'HH:mm')}
                        </td>
                        <td className="client-cell">
                          <span 
                            className="client-name-link"
                            onClick={() => openClientCard(apt.client_id)}
                          >
                            {getClientName(apt.client_id)}
                          </span>
                        </td>
                        <td className="phone-cell">
                          <div className="phone-with-icon">
                            <button
                              className={`phone-icon ${apt.called_today === 1 ? 'called' : 'not-called'}`}
                              onClick={() => toggleCallStatus(apt.id, apt.called_today === 1)}
                              title={apt.called_today === 1 ? 'Позвонили' : 'Не звонили'}
                            >
                              📞
                            </button>
                            <span>{getClientPhone(apt.client_id)}</span>
                          </div>
                        </td>
                        <td className="services-cell">{getServiceNames(apt.services)}</td>
                        <td className="doctor-cell">{getDoctorName(apt.doctor)}</td>
                        <td className="price-cell">{calculateAppointmentTotal(apt.services).toFixed(2)} BYN</td>
                        <td className="status-cell">
                          <select 
                            value={apt.status} 
                            onChange={(e) => updateAppointmentStatus(apt.id, e.target.value)}
                            className="status-select"
                            style={{ backgroundColor: getStatusColor(apt.status) }}
                          >
                            <option value="scheduled">Запланирован</option>
                            <option value="waiting">Ожидает</option>
                            <option value="in-progress">На приеме</option>
                            <option value="ready_for_payment">Готов к оплате</option>
                            <option value="completed">Завершен</option>
                            <option value="cancelled">Отменен</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </div>
    </div>
  );
  };

  // Рендер страницы всех клиентов
  const renderClients = () => (
    <div>
      <div className="section-header">
        <h2>👥 Все клиенты</h2>
        <div>
          <button className="btn" onClick={() => setCurrentView('home')}>← Назад</button>
          <button className="btn btn-primary" onClick={() => setShowClientModal(true)}>+ Новый клиент</button>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="empty-state">Клиенты не найдены</div>
      ) : (
        <div className="clients-list">
          {clients.map(client => (
            <div key={client.id} className="client-card">
              <h3>{client.name}</h3>
              <p>📞 {client.phone || 'Не указан'}</p>
              <p>✉️ {client.email || 'Не указан'}</p>
              {client.notes && <p className="notes">📝 {client.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Рендер страницы всех услуг
  const renderServices = () => (
    <div>
      <div className="section-header">
        <h2>💼 Все услуги</h2>
        <div>
          <button className="btn" onClick={() => setCurrentView('home')}>← Назад</button>
          <button className="btn btn-primary" onClick={() => setShowServiceModal(true)}>+ Новая услуга</button>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="empty-state">Услуги не найдены</div>
      ) : (
        <div className="services-grid">
          {services.map(service => (
            <div key={service.id} className="service-card">
              <h3>{service.name}</h3>
              <div className="service-price">{service.price} BYN</div>
              {service.description && <p className="service-desc">{service.description}</p>}
              <div className="service-actions">
                <button className="btn btn-small" onClick={() => handleEditService(service)}>✏️ Изменить</button>
                <button className="btn btn-small btn-danger" onClick={() => handleDeleteService(service.id)}>🗑️ Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Рендер страницы всех материалов
  const renderMaterials = () => (
    <div>
      <div className="section-header">
        <h2>📦 Все материалы</h2>
        <div>
          <button className="btn" onClick={() => setCurrentView('home')}>← Назад</button>
          <button className="btn btn-primary" onClick={() => setShowMaterialModal(true)}>+ Новый материал</button>
        </div>
      </div>

      {materials.length === 0 ? (
        <div className="empty-state">Материалы не найдены</div>
      ) : (
        <div className="materials-grid">
          {materials.map(material => (
            <div key={material.id} className="material-card">
              <h3>{material.name}</h3>
              <div className="material-price">{material.price} BYN / {material.unit}</div>
              <p className="material-stock">На складе: {material.stock} {material.unit}</p>
              {material.description && <p className="material-desc">{material.description}</p>}
              <div className="material-actions">
                <button className="btn btn-small">✏️ Изменить</button>
                <button className="btn btn-small btn-danger">🗑️ Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Страница врачей вынесена в pages/DoctorsPage

  // Рендер страницы отчетов
  const renderReports = () => (
    <div>
      <div className="section-header">
        <h2>📊 Отчеты и статистика</h2>
        <div>
          <button className="btn" onClick={() => setCurrentView('home')}>← Назад</button>
        </div>
      </div>

      <div className="empty-state">
        <p>Раздел отчетов в разработке</p>
        <p style={{ marginTop: '10px', fontSize: '0.9rem', color: '#999' }}>
          Здесь будет статистика по записям, клиентам и доходам
        </p>
      </div>
    </div>
  );

  // Если не авторизован - показываем страницу входа
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="App">
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
            <button className="btn btn-logout" onClick={handleLogout}>
              Выход
            </button>
          </div>
        </div>
      </div>

      <div className="main-content">
        {currentView === 'home' && renderHome()}
        {currentView === 'doctors' && currentUser.role === 'superadmin' && <DoctorsPage onNavigate={(view) => setCurrentView(view)} />}
        {currentView === 'clients' && currentUser.role !== 'doctor' && renderClients()}
        {currentView === 'services' && currentUser.role === 'superadmin' && renderServices()}
        {currentView === 'materials' && currentUser.role === 'superadmin' && renderMaterials()}
        {currentView === 'reports' && currentUser.role === 'superadmin' && renderReports()}
      </div>

      {/* Модальное окно добавления клиента */}
      {showClientModal && (
        <div className="modal-overlay" onClick={() => setShowClientModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Новый клиент</h2>
            <form onSubmit={handleCreateClient}>
              <input
                type="text"
                placeholder="Фамилия *"
                value={clientForm.lastName}
                onChange={(e) => setClientForm({ ...clientForm, lastName: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Имя *"
                value={clientForm.firstName}
                onChange={(e) => setClientForm({ ...clientForm, firstName: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Отчество *"
                value={clientForm.middleName}
                onChange={(e) => setClientForm({ ...clientForm, middleName: e.target.value })}
                required
              />
              <input
                type="tel"
                placeholder="Номер телефона *"
                value={clientForm.phone}
                onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Адрес проживания *"
                value={clientForm.address}
                onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                required
              />
              <input
                type="email"
                placeholder="Email (необязательно)"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              />
              <textarea
                placeholder="Примечания (необязательно)"
                value={clientForm.notes}
                onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
              />
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setShowClientModal(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно добавления записи */}
      {showAppointmentModal && (
        <div className="modal-overlay" onClick={() => {
          setShowAppointmentModal(false);
          setShowInlineClientForm(false);
          resetClientForm();
          setClientSearchQuery('');
          setShowClientDropdown(false);
          setServiceSearchQuery('');
          setShowServiceDropdown(false);
        }}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>Новая запись</h2>
            <form onSubmit={handleCreateAppointment}>
              <label>Клиент *</label>
              
              {!showInlineClientForm ? (
                <div className="client-select-group">
                  <div className="client-search-wrapper">
                    <input
                      type="text"
                      placeholder="Поиск по имени или телефону..."
                      value={clientSearchQuery}
                      onChange={(e) => {
                        setClientSearchQuery(e.target.value);
                        setShowClientDropdown(true);
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      autoComplete="off"
                    />
                    {showClientDropdown && (
                      <div className="client-dropdown">
                        {filterClients().length > 0 ? (
                          filterClients().map(client => {
                            const fullName = `${client.lastName || ''} ${client.firstName || ''} ${client.middleName || ''}`.trim() || client.name || 'Неизвестный';
                            return (
                              <div
                                key={client.id}
                                className="client-dropdown-item"
                                onClick={() => selectClient(client.id)}
                              >
                                <strong>{fullName}</strong>
                                {client.phone && <span className="client-phone"> - {client.phone}</span>}
                              </div>
                            );
                          })
                        ) : (
                          <div className="client-dropdown-empty">
                            Клиенты не найдены
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-small" 
                    onClick={() => setShowInlineClientForm(true)}
                  >
                    + Новый
                  </button>
                </div>
              ) : (
                <div className="inline-client-form">
                  <h3>Создать нового клиента</h3>
                  <input
                    type="text"
                    placeholder="Фамилия *"
                    value={clientForm.lastName}
                    onChange={(e) => setClientForm({ ...clientForm, lastName: e.target.value })}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Имя *"
                    value={clientForm.firstName}
                    onChange={(e) => setClientForm({ ...clientForm, firstName: e.target.value })}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Отчество *"
                    value={clientForm.middleName}
                    onChange={(e) => setClientForm({ ...clientForm, middleName: e.target.value })}
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Номер телефона *"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Адрес проживания *"
                    value={clientForm.address}
                    onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email (необязательно)"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  />
                  <textarea
                    placeholder="Примечания (необязательно)"
                    value={clientForm.notes}
                    onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                    rows="2"
                  />
                  <div className="inline-client-actions">
                    <button 
                      type="button" 
                      className="btn" 
                      onClick={() => {
                        setShowInlineClientForm(false);
                        resetClientForm();
                      }}
                    >
                      ← Назад к выбору
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={handleCreateClientInline}
                      disabled={!clientForm.lastName || !clientForm.firstName || !clientForm.middleName || !clientForm.phone || !clientForm.address}
                    >
                      Создать клиента
                    </button>
                  </div>
                </div>
              )}

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
                <option value="">-- Выберите врача --</option>
                {doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    {`${doctor.lastName} ${doctor.firstName} ${doctor.middleName || ''}`.trim()}
                    {doctor.specialization ? ` (${doctor.specialization})` : ''}
                  </option>
                ))}
              </select>

              <label>Услуги *</label>
              
              {/* Поиск и добавление услуг */}
              <div className="service-search-wrapper">
                <input
                  type="text"
                  placeholder="Поиск услуги или выберите из списка..."
                  value={serviceSearchQuery}
                  onChange={(e) => {
                    setServiceSearchQuery(e.target.value);
                    setShowServiceDropdown(true);
                  }}
                  onFocus={() => setShowServiceDropdown(true)}
                  autoComplete="off"
                />
                {showServiceDropdown && (
                  <div className="service-dropdown">
                    {filterServices().length > 0 ? (
                      filterServices().map(service => {
                        const alreadyAdded = appointmentForm.services.find(s => s.service_id === service.id);
                        return (
                          <div
                            key={service.id}
                            className={`service-dropdown-item ${alreadyAdded ? 'disabled' : ''}`}
                            onClick={() => !alreadyAdded && addServiceToAppointment(service.id)}
                          >
                            <div>
                              <strong>{service.name}</strong>
                              <span className="service-price-tag"> - {service.price} BYN</span>
                            </div>
                            {alreadyAdded && <span className="already-added">✓ Добавлено</span>}
                          </div>
                        );
                      })
                    ) : (
                      <div className="service-dropdown-empty">
                        {serviceSearchQuery ? 'Услуги не найдены' : 'Нет доступных услуг'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Список выбранных услуг */}
              {appointmentForm.services.length > 0 && (
                <div className="selected-services">
                  <h4>Выбранные услуги:</h4>
                  {appointmentForm.services.map(item => {
                    const service = services.find(s => s.id === item.service_id);
                    if (!service) return null;
                    return (
                      <div key={item.service_id} className="selected-service-item">
                        <div className="service-info">
                          <strong>{service.name}</strong>
                          <span className="service-price"> - {service.price} BYN</span>
                        </div>
                        <div className="service-controls">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateServiceQuantity(item.service_id, e.target.value)}
                            className="quantity-input"
                          />
                          <button
                            type="button"
                            className="btn btn-small btn-danger"
                            onClick={() => removeServiceFromAppointment(item.service_id)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="total-calculation">
                    Итого: {calculateTotal().toFixed(2)} BYN
                  </div>
                </div>
              )}

              <label>Примечания</label>
              <textarea
                placeholder="Дополнительная информация"
                value={appointmentForm.notes}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
              />

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => {
                  setShowAppointmentModal(false);
                  setShowInlineClientForm(false);
                  resetClientForm();
                  setClientSearchQuery('');
                  setShowClientDropdown(false);
                  setServiceSearchQuery('');
                  setShowServiceDropdown(false);
                }}>Отмена</button>
                <button type="submit" className="btn btn-primary">Создать запись</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно врача moved to DoctorsPage */}

      {/* Модальное окно добавления/редактирования услуги */}
      {showServiceModal && (
        <div className="modal-overlay" onClick={() => { setShowServiceModal(false); setEditingService(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingService ? 'Редактировать услугу' : 'Новая услуга'}</h2>
            <form onSubmit={handleCreateService}>
              <input
                type="text"
                placeholder="Название услуги *"
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                required
              />
              <input
                type="number"
                step="0.01"
                placeholder="Цена *"
                value={serviceForm.price}
                onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                required
              />
              <textarea
                placeholder="Описание"
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
              />
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => { setShowServiceModal(false); setEditingService(null); }}>Отмена</button>
                <button type="submit" className="btn btn-primary">{editingService ? 'Сохранить' : 'Создать'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно добавления материала */}
      {showMaterialModal && (
        <div className="modal-overlay" onClick={() => setShowMaterialModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Новый материал</h2>
            <form onSubmit={(e) => { e.preventDefault(); alert('API для материалов будет добавлен'); }}>
              <input
                type="text"
                placeholder="Название материала *"
                value={materialForm.name}
                onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Единица измерения (шт, мл, г) *"
                value={materialForm.unit}
                onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                required
              />
              <input
                type="number"
                step="0.01"
                placeholder="Цена за единицу *"
                value={materialForm.price}
                onChange={(e) => setMaterialForm({ ...materialForm, price: e.target.value })}
                required
              />
              <input
                type="number"
                placeholder="Количество на складе *"
                value={materialForm.stock}
                onChange={(e) => setMaterialForm({ ...materialForm, stock: e.target.value })}
                required
              />
              <textarea
                placeholder="Описание"
                value={materialForm.description}
                onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
              />
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setShowMaterialModal(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно карточки клиента */}
      {showClientCardModal && (
        <div className="modal-overlay" onClick={() => setShowClientCardModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>📋 Карточка клиента: {getClientName(selectedClientId)}</h2>
            
            {/* Информация о клиенте */}
            <div className="client-info-section">
              {clients.find(c => c.id === selectedClientId) && (
                <div className="client-details">
                  <p><strong>Телефон:</strong> {clients.find(c => c.id === selectedClientId).phone || '-'}</p>
                  <p><strong>Адрес:</strong> {clients.find(c => c.id === selectedClientId).address || '-'}</p>
                  <p><strong>Email:</strong> {clients.find(c => c.id === selectedClientId).email || '-'}</p>
                </div>
              )}
            </div>

            {/* Текущий визит */}
            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const currentVisit = clientHistory.find(visit => {
                const visitDate = new Date(visit.appointment_date).toISOString().split('T')[0];
                return visitDate === today && visit.status !== 'completed' && visit.status !== 'cancelled';
              });

              if (currentVisit) {
                const currentTotal = currentVisit.services && currentVisit.services.length > 0
                  ? currentVisit.services.reduce((sum, s) => sum + (s.price * s.quantity), 0)
                  : 0;

                return (
                  <div className="current-visit-section">
                    <h3>🔥 Текущий визит (сегодня)</h3>
                    <div className="current-visit-card">
                      <div className="visit-info-row">
                        <div className="visit-info-item">
                          <span className="visit-label">Время:</span>
                          <span className="visit-value">{format(new Date(currentVisit.appointment_date), 'HH:mm')}</span>
                        </div>
                        <div className="visit-info-item">
                          <span className="visit-label">Врач:</span>
                          <span className="visit-value">{getDoctorName(currentVisit.doctor)}</span>
                        </div>
                        <div className="visit-info-item">
                          <span className="visit-label">Статус:</span>
                          <span 
                            className="status-badge"
                            style={{ backgroundColor: getStatusColor(currentVisit.status) }}
                          >
                            {getStatusText(currentVisit.status)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="visit-procedures">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h4 style={{ margin: 0 }}>Процедуры:</h4>
                          {!editingVisitProcedures && (
                            <button 
                              className="btn btn-small"
                              onClick={() => startEditingProcedures(currentVisit)}
                            >
                              ✏️ Выбрать процедуры
                            </button>
                          )}
                        </div>

                        {!editingVisitProcedures ? (
                          // Просмотр процедур
                          currentVisit.services && currentVisit.services.length > 0 ? (
                            <ul className="procedures-list">
                              {currentVisit.services.map((s, idx) => (
                                <li key={idx}>
                                  {s.name} x{s.quantity} = {(s.price * s.quantity).toFixed(2)} BYN
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>Нет выбранных процедур</p>
                          )
                        ) : (
                          // Редактирование процедур
                          <div className="edit-procedures-form">
                            {/* Поиск и добавление процедур */}
                            <div className="service-search-wrapper">
                              <input
                                type="text"
                                placeholder="Поиск процедуры..."
                                value={visitServiceSearch}
                                onChange={(e) => setVisitServiceSearch(e.target.value)}
                                className="procedure-search-input"
                              />
                              {visitServiceSearch && (
                                <div className="service-dropdown">
                                  {services.filter(s => 
                                    s.name.toLowerCase().includes(visitServiceSearch.toLowerCase())
                                  ).map(service => {
                                    const alreadyAdded = visitProcedures.find(vp => vp.service_id === service.id);
                                    return (
                                      <div
                                        key={service.id}
                                        className={`service-dropdown-item ${alreadyAdded ? 'disabled' : ''}`}
                                        onClick={() => !alreadyAdded && addProcedureToVisit(service.id)}
                                      >
                                        <div>
                                          <strong>{service.name}</strong>
                                          <span className="service-price-tag"> - {service.price} BYN</span>
                                        </div>
                                        {alreadyAdded && <span className="already-added">✓ Добавлено</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Список выбранных процедур */}
                            {visitProcedures.length > 0 && (
                              <div className="selected-procedures">
                                {visitProcedures.map(item => {
                                  const service = services.find(s => s.id === item.service_id);
                                  if (!service) return null;
                                  return (
                                    <div key={item.service_id} className="selected-procedure-item">
                                      <div className="procedure-info">
                                        <strong>{service.name}</strong>
                                        <span> - {service.price} BYN</span>
                                      </div>
                                      <div className="procedure-controls">
                                        <input
                                          type="number"
                                          min="1"
                                          value={item.quantity}
                                          onChange={(e) => updateProcedureQuantity(item.service_id, e.target.value)}
                                          className="quantity-input-small"
                                        />
                                        <button
                                          className="btn btn-small btn-danger"
                                          onClick={() => removeProcedureFromVisit(item.service_id)}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Кнопки сохранения/отмены */}
                            <div className="edit-procedures-actions">
                              <button 
                                className="btn"
                                onClick={() => {
                                  setEditingVisitProcedures(false);
                                  setVisitProcedures([]);
                                  setVisitServiceSearch('');
                                }}
                              >
                                Отмена
                              </button>
                              <button 
                                className="btn btn-primary"
                                onClick={() => saveProcedures(currentVisit.id)}
                              >
                                Сохранить
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="visit-total">
                        <span>Итого:</span>
                        <strong>
                          {editingVisitProcedures ? (
                            visitProcedures.reduce((sum, item) => {
                              const service = services.find(s => s.id === item.service_id);
                              return sum + (service ? service.price * item.quantity : 0);
                            }, 0).toFixed(2)
                          ) : (
                            currentTotal.toFixed(2)
                          )} BYN
                        </strong>
                      </div>

                      {/* Скидка (только для администратора) */}
                      {currentUser.role === 'administrator' && (
                        <div className="discount-section">
                          <h4>🏷️ Применить скидку</h4>
                          <div className="discount-controls">
                            <div className="discount-type-select">
                              <label>
                                <input
                                  type="radio"
                                  value="percent"
                                  checked={discountType === 'percent'}
                                  onChange={(e) => setDiscountType(e.target.value)}
                                />
                                Процент (%)
                              </label>
                              <label>
                                <input
                                  type="radio"
                                  value="fixed"
                                  checked={discountType === 'fixed'}
                                  onChange={(e) => setDiscountType(e.target.value)}
                                />
                                Фиксированная (BYN)
                              </label>
                            </div>
                            <div className="discount-input-row">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder={discountType === 'percent' ? 'Введите %' : 'Введите сумму'}
                                value={discountValue}
                                onChange={(e) => setDiscountValue(e.target.value)}
                                className="discount-input"
                              />
                              <button 
                                className="btn btn-small btn-primary"
                                onClick={() => applyDiscount(currentTotal)}
                              >
                                Применить
                              </button>
                              {appliedDiscount > 0 && (
                                <button 
                                  className="btn btn-small"
                                  onClick={() => {
                                    setDiscountValue('');
                                    setAppliedDiscount(0);
                                  }}
                                >
                                  Сбросить
                                </button>
                              )}
                            </div>
                          </div>
                          {appliedDiscount > 0 && (
                            <div className="discount-result">
                              <div className="discount-row">
                                <span>Скидка:</span>
                                <strong className="discount-amount">-{appliedDiscount.toFixed(2)} BYN</strong>
                              </div>
                              <div className="discount-row final-price">
                                <span>К оплате со скидкой:</span>
                                <strong>{(currentTotal - appliedDiscount).toFixed(2)} BYN</strong>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Калькулятор сдачи */}
                      <div className="change-calculator">
                        <h4>💰 Калькулятор сдачи</h4>
                        <div className="calculator-row">
                          <label>Клиент дал:</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={paidAmount}
                            onChange={(e) => setPaidAmount(e.target.value)}
                            className="paid-input"
                          />
                          <span>BYN</span>
                        </div>
                        {paidAmount && parseFloat(paidAmount) > 0 && (
                          <div className="calculator-result">
                            <div className="result-row">
                              <span>К оплате:</span>
                              <strong>{(currentTotal - appliedDiscount).toFixed(2)} BYN</strong>
                            </div>
                            <div className="result-row change-row">
                              <span>Сдача:</span>
                              <strong className={parseFloat(paidAmount) - (currentTotal - appliedDiscount) >= 0 ? 'change-positive' : 'change-negative'}>
                                {(parseFloat(paidAmount) - (currentTotal - appliedDiscount)).toFixed(2)} BYN
                              </strong>
                            </div>
                            {parseFloat(paidAmount) < (currentTotal - appliedDiscount) && (
                              <div className="warning-message">
                                ⚠️ Недостаточно средств!
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* История завершенных визитов */}
            <div className="client-history-section">
              <h3>📋 История визитов (завершенные)</h3>
              {(() => {
                const completedVisits = clientHistory.filter(visit => visit.status === 'completed');
                
                if (completedVisits.length === 0) {
                  return <p className="empty-state">Нет завершенных визитов</p>;
                }

                return (
                  <div className="history-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Дата</th>
                          <th>Врач</th>
                          <th>Процедуры</th>
                          <th>Стоимость</th>
                        </tr>
                      </thead>
                      <tbody>
                        {completedVisits.map(visit => (
                          <tr key={visit.id}>
                            <td className="date-cell">
                              {format(new Date(visit.appointment_date), 'd MMMM yyyy HH:mm', { locale: ru })}
                            </td>
                            <td className="doctor-cell">{getDoctorName(visit.doctor)}</td>
                            <td className="procedures-cell">
                              {visit.services && visit.services.length > 0 ? (
                                <ul className="procedures-list">
                                  {visit.services.map((s, idx) => (
                                    <li key={idx}>
                                      {s.name} x{s.quantity} = {(s.price * s.quantity).toFixed(2)} BYN
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                'Нет данных'
                              )}
                            </td>
                            <td className="price-cell">
                              <strong>
                                {visit.services && visit.services.length > 0
                                  ? visit.services.reduce((sum, s) => sum + (s.price * s.quantity), 0).toFixed(2)
                                  : '0.00'
                                } BYN
                              </strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  
                  {/* Итоговая сумма за завершенные визиты */}
                  <div className="total-visits-summary">
                    <div className="summary-row">
                      <p><strong>Всего завершенных визитов:</strong> {completedVisits.length}</p>
                    </div>
                    <div className="summary-row grand-total">
                      <p><strong>Общая сумма за все время:</strong> {
                        completedVisits.reduce((total, visit) => {
                          if (visit.services && visit.services.length > 0) {
                            return total + visit.services.reduce((sum, s) => sum + (s.price * s.quantity), 0);
                          }
                          return total;
                        }, 0).toFixed(2)
                      } BYN</p>
                    </div>
                  </div>
                </div>
                );
              })()}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => {
                setShowClientCardModal(false);
                setPaidAmount('');
              }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
