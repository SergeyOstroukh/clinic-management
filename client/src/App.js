import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';
import { format } from 'date-fns';
import ru from 'date-fns/locale/ru';

// Автоматическое определение API URL
// В продакшене API на том же домене, в разработке - localhost
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // В продакшене (после сборки) API на том же домене
  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }
  // В разработке используем localhost
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

function App() {
  const [activeTab, setActiveTab] = useState('appointments');
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);

  // Формы
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [appointmentForm, setAppointmentForm] = useState({
    client_id: '',
    appointment_date: new Date().toISOString().slice(0, 16),
    services: [],
    notes: ''
  });
  const [serviceForm, setServiceForm] = useState({ name: '', price: '', description: '' });

  useEffect(() => {
    loadData();
  }, [selectedDate, activeTab]);

  const loadData = async () => {
    try {
      const [appointmentsRes, clientsRes, servicesRes] = await Promise.all([
        axios.get(`${API_URL}/appointments`),
        axios.get(`${API_URL}/clients`),
        axios.get(`${API_URL}/services`)
      ]);
      setAppointments(appointmentsRes.data);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/clients`, clientForm);
      setClientForm({ name: '', phone: '', email: '', notes: '' });
      setShowClientModal(false);
      loadData();
    } catch (error) {
      alert('Ошибка создания клиента');
    }
  };

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/appointments`, appointmentForm);
      setAppointmentForm({
        client_id: '',
        appointment_date: new Date().toISOString().slice(0, 16),
        services: [],
        notes: ''
      });
      setShowAppointmentModal(false);
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
        s.service_id === serviceId ? { ...s, quantity: Math.max(1, quantity) } : s
      )
    });
  };

  const calculateTotal = () => {
    return appointmentForm.services.reduce((total, item) => {
      const service = services.find(s => s.id === item.service_id);
      return total + (service ? service.price * item.quantity : 0);
    }, 0);
  };

  const filteredAppointments = appointments.filter(apt => {
    if (activeTab === 'appointments') {
      return format(new Date(apt.appointment_date), 'yyyy-MM-dd') === selectedDate;
    }
    return true;
  });

  return (
    <div className="App">
      <header className="app-header">
        <h1>🏥 Система управления клиникой</h1>
        <p>Запись клиентов, услуги и расчет стоимости</p>
      </header>

      <nav className="tabs">
        <button
          className={activeTab === 'appointments' ? 'active' : ''}
          onClick={() => setActiveTab('appointments')}
        >
          📅 Записи
        </button>
        <button
          className={activeTab === 'clients' ? 'active' : ''}
          onClick={() => setActiveTab('clients')}
        >
          👥 Клиенты
        </button>
        <button
          className={activeTab === 'services' ? 'active' : ''}
          onClick={() => setActiveTab('services')}
        >
          💼 Услуги
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'appointments' && (
          <div className="tab-content">
            <div className="section-header">
              <div>
                <label>Дата: </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="date-input"
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowAppointmentModal(true)}
              >
                + Новая запись
              </button>
            </div>

            <div className="appointments-grid">
              {filteredAppointments.length === 0 ? (
                <p className="empty-state">Нет записей на выбранную дату</p>
              ) : (
                filteredAppointments.map(apt => (
                  <div key={apt.id} className="appointment-card">
                    <div className="appointment-header">
                      <h3>{apt.client_name || 'Неизвестный клиент'}</h3>
                      <span className={`status-badge ${apt.status}`}>
                        {apt.status === 'scheduled' ? 'Запланировано' : 
                         apt.status === 'completed' ? 'Завершено' : 'Отменено'}
                      </span>
                    </div>
                    <p className="appointment-time">
                      {format(new Date(apt.appointment_date), 'dd MMMM yyyy, HH:mm', { locale: ru })}
                    </p>
                    {apt.client_phone && <p>📞 {apt.client_phone}</p>}
                    {apt.services_list && (
                      <p className="services-info">Услуги: {apt.services_list}</p>
                    )}
                    <div className="appointment-footer">
                      <strong className="total-price">
                        Итого: {apt.total_price || 0} руб.
                      </strong>
                    </div>
                    {apt.notes && <p className="notes">📝 {apt.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'clients' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Список клиентов</h2>
              <button
                className="btn btn-primary"
                onClick={() => setShowClientModal(true)}
              >
                + Новый клиент
              </button>
            </div>

            <div className="clients-list">
              {clients.length === 0 ? (
                <p className="empty-state">Нет клиентов</p>
              ) : (
                clients.map(client => (
                  <div key={client.id} className="client-card">
                    <h3>{client.name}</h3>
                    {client.phone && <p>📞 {client.phone}</p>}
                    {client.email && <p>✉️ {client.email}</p>}
                    {client.notes && <p className="notes">📝 {client.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'services' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Услуги и цены</h2>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditingService(null);
                  setServiceForm({ name: '', price: '', description: '' });
                  setShowServiceModal(true);
                }}
              >
                + Новая услуга
              </button>
            </div>

            <div className="services-grid">
              {services.map(service => (
                <div key={service.id} className="service-card">
                  <h3>{service.name}</h3>
                  <p className="service-price">{service.price} руб.</p>
                  {service.description && <p className="service-desc">{service.description}</p>}
                  <div className="service-actions">
                    <button
                      className="btn btn-small"
                      onClick={() => handleEditService(service)}
                    >
                      ✏️ Редактировать
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => handleDeleteService(service.id)}
                    >
                      🗑️ Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Модальное окно клиента */}
      {showClientModal && (
        <div className="modal-overlay" onClick={() => setShowClientModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Новый клиент</h2>
            <form onSubmit={handleCreateClient}>
              <input
                type="text"
                placeholder="Имя *"
                value={clientForm.name}
                onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                required
              />
              <input
                type="tel"
                placeholder="Телефон"
                value={clientForm.phone}
                onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
              />
              <input
                type="email"
                placeholder="Email"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              />
              <textarea
                placeholder="Заметки"
                value={clientForm.notes}
                onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
              />
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Создать</button>
                <button type="button" className="btn" onClick={() => setShowClientModal(false)}>
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно записи */}
      {showAppointmentModal && (
        <div className="modal-overlay" onClick={() => setShowAppointmentModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>Новая запись</h2>
            <form onSubmit={handleCreateAppointment}>
              <label>Клиент *</label>
              <select
                value={appointmentForm.client_id}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, client_id: e.target.value })}
                required
              >
                <option value="">Выберите клиента</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>

              <label>Дата и время *</label>
              <input
                type="datetime-local"
                value={appointmentForm.appointment_date}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_date: e.target.value })}
                required
              />

              <label>Услуги (выберите услуги для автоматического расчета)</label>
              <div className="services-selection">
                {services.map(service => {
                  const selected = appointmentForm.services.find(s => s.service_id === service.id);
                  return (
                    <div key={service.id} className="service-checkbox">
                      <label>
                        <input
                          type="checkbox"
                          checked={!!selected}
                          onChange={() => toggleServiceInAppointment(service.id)}
                        />
                        <span>{service.name} - {service.price} руб.</span>
                      </label>
                      {selected && (
                        <input
                          type="number"
                          min="1"
                          value={selected.quantity}
                          onChange={(e) => updateServiceQuantity(service.id, parseInt(e.target.value))}
                          className="quantity-input"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="total-calculation">
                <strong>Итого: {calculateTotal()} руб.</strong>
              </div>

              <textarea
                placeholder="Заметки"
                value={appointmentForm.notes}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
              />

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Создать запись</button>
                <button type="button" className="btn" onClick={() => setShowAppointmentModal(false)}>
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно услуги */}
      {showServiceModal && (
        <div className="modal-overlay" onClick={() => setShowServiceModal(false)}>
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
                placeholder="Цена (руб.) *"
                value={serviceForm.price}
                onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                required
                min="0"
                step="0.01"
              />
              <textarea
                placeholder="Описание"
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
              />
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">
                  {editingService ? 'Сохранить' : 'Создать'}
                </button>
                <button type="button" className="btn" onClick={() => setShowServiceModal(false)}>
                  Отмена
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

