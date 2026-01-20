import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

// FSD imports
import { getTodayDateString, getFullName } from './shared/lib';
import { AppointmentTable, AppointmentTableByDoctor, ClientCard, ClientHistoryCard, NavigationCards } from './widgets';
import { DoctorsPage } from './pages/DoctorsPage';
import { AdministratorsPage } from './pages/AdministratorsPage';
import { StatisticsPage } from './pages/StatisticsPage';
import CompositeServicesPage from './pages/CompositeServicesPage';
import { LoginPage } from './pages/LoginPage';
import { DoctorDashboard } from './pages/DoctorDashboard';
import DoctorSchedule from './components/DoctorSchedule/DoctorSchedule';
import BookingCalendar from './components/BookingCalendar/BookingCalendarV2';
import ChangePassword from './components/ChangePassword';
import { ToastContainer } from './components/Toast';
import { useToast } from './hooks/useToast';
import { useConfirmModal } from './hooks/useConfirmModal';
import PhoneInput from './components/PhoneInput';
import Pagination from './components/Pagination';
import ConfirmModal from './components/ConfirmModal/ConfirmModal';
import { CompleteVisit } from './features/CompleteVisit';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

function App() {
  // Toast уведомления
  const toast = useToast();
  
  // Модалка подтверждения
  const { confirmModal, showConfirm } = useConfirmModal();
  
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
  const [editingClient, setEditingClient] = useState(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showEditAppointmentModal, setShowEditAppointmentModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showClientCardModal, setShowClientCardModal] = useState(false);
  const [showClientHistoryModal, setShowClientHistoryModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showCompleteVisitModal, setShowCompleteVisitModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedClientCardMode, setSelectedClientCardMode] = useState('card');
  const [selectedAppointmentForPayment, setSelectedAppointmentForPayment] = useState(null);
  const [selectedAppointmentForComplete, setSelectedAppointmentForComplete] = useState(null);
  
  // Поиск и выбор
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [servicesPageSearch, setServicesPageSearch] = useState('');
  const [clientsPageSearch, setClientsPageSearch] = useState('');
  const [materialsPageSearch, setMaterialsPageSearch] = useState('');
  
  // Пагинация для клиентов
  const [clientsPage, setClientsPage] = useState(1);
  const [clientsPerPage, setClientsPerPage] = useState(10);
  
  // Пагинация для услуг
  const [servicesPage, setServicesPage] = useState(1);
  const [servicesPerPage, setServicesPerPage] = useState(10);
  
  // Пагинация для материалов
  const [materialsPage, setMaterialsPage] = useState(1);
  const [materialsPerPage, setMaterialsPerPage] = useState(10);
  
  // Фильтр по дате
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  
  // Вид таблицы записей (table или byDoctor)
  const [appointmentsViewMode, setAppointmentsViewMode] = useState('table');
  
  // Фильтр по статусам записей
  const [hiddenStatuses, setHiddenStatuses] = useState([]);
  
  // Редактирование
  const [editingService, setEditingService] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editingAppointment, setEditingAppointment] = useState(null);

  // Формы
  const [clientForm, setClientForm] = useState({ 
    lastName: '', firstName: '', middleName: '', phone: '', address: '', email: '', notes: '', date_of_birth: '', passport_number: '' 
  });
  const [appointmentForm, setAppointmentForm] = useState({
    client_id: '', appointment_date: new Date().toISOString().slice(0, 16), doctor_id: '', services: [], notes: ''
  });
  const [serviceForm, setServiceForm] = useState({ name: '', price: '', description: '', category: '' });
  const [materialForm, setMaterialForm] = useState({ name: '', unit: '', price: '', stock: '', description: '', receipt_date: new Date().toISOString().split('T')[0] });
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ material_id: '', quantity: '', price: '', notes: '', receipt_date: new Date().toISOString().split('T')[0] });
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showClientDropdown]);

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
      .sort((a, b) => {
        // Сортировка по времени (от меньшего к большему)
        const timeA = new Date(a.appointment_date).getTime();
        const timeB = new Date(b.appointment_date).getTime();
        return timeA - timeB;
      });
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
      toast.error('Ошибка обновления статуса звонка');
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
      toast.error('Ошибка обновления статуса');
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
      
      toast.success('✅ Запись отменена');
    } catch (error) {
      console.error('Ошибка отмены записи:', error);
      toast.error(`${error.response?.data?.error || error.message}`);
    }
  };

  // Открыть карточку клиента
  const openClientCard = async (clientId, appointment = null, mode = 'card') => {
    // Для врача открываем форму приема, если есть запись
    if (currentUser.role === 'doctor' && appointment) {
      try {
        // Загружаем полные данные записи с услугами и материалами
        const response = await axios.get(`${API_URL}/appointments/${appointment.id}`);
        setSelectedAppointmentForComplete(response.data);
        setShowCompleteVisitModal(true);
      } catch (error) {
        console.error('Ошибка загрузки записи:', error);
        toast.error('Ошибка загрузки записи');
      }
    } else {
      // Для администраторов открываем карточку клиента
      setSelectedClientId(clientId);
      setSelectedClientCardMode(mode); // Сохраняем режим
      // Сохраняем конкретный визит для режима оплаты
      if (mode === 'payment' && appointment) {
        setSelectedAppointmentForPayment(appointment);
      } else {
        setSelectedAppointmentForPayment(null);
      }
      setShowClientCardModal(true);
    }
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

  const calculateAppointmentTotal = (servicesList, materialsList) => {
    let total = 0;
    
    // Считаем услуги
    if (servicesList && servicesList.length > 0) {
      total += servicesList.reduce((sum, s) => {
        const service = services.find(serv => serv.id === s.service_id);
        return sum + (service ? service.price * s.quantity : 0);
      }, 0);
    }
    
    // Считаем материалы
    if (materialsList && materialsList.length > 0) {
      total += materialsList.reduce((sum, m) => {
        const material = materials.find(mat => mat.id === m.material_id);
        return sum + (material ? material.price * m.quantity : 0);
      }, 0);
    }
    
    return total;
  };

  // Создание клиента
  // Удалить клиента
  const handleDeleteClient = async (clientId) => {
    // Проверяем, есть ли у клиента записи
    const client = clients.find(c => c.id === clientId);
    if (!client) {
      toast.error('Клиент не найден');
      return;
    }
    
    // Загружаем количество записей клиента
    let appointmentCount = 0;
    try {
      const appointmentsResponse = await axios.get(`${API_URL}/clients/${clientId}/appointments`);
      appointmentCount = appointmentsResponse.data?.length || 0;
    } catch (error) {
      console.error('Ошибка загрузки записей клиента:', error);
    }
    
    // Если есть записи, спрашиваем что делать с ними
    if (appointmentCount > 0) {
      const confirmMessage = `У клиента есть ${appointmentCount} ${appointmentCount === 1 ? 'запись' : appointmentCount < 5 ? 'записи' : 'записей'}.\n\nЧто делать с записями?`;
      
      showConfirm({
        title: 'Удаление клиента',
        message: confirmMessage,
        confirmText: 'Удалить записи',
        cancelText: 'Оставить записи',
        confirmButtonClass: 'btn-danger',
        onConfirm: async () => {
          // Вторая модалка - подтверждение удаления
          const confirmed = await showConfirm({
            title: 'Подтверждение удаления',
            message: 'Вы уверены, что хотите удалить этого клиента? Это действие нельзя отменить.',
            confirmText: 'Да, удалить',
            cancelText: 'Отмена',
            confirmButtonClass: 'btn-danger'
          });
          
          if (confirmed) {
            try {
              await axios.delete(`${API_URL}/clients/${clientId}`, {
                data: { 
                  currentUser: currentUser,
                  deleteAppointments: true
                }
              });
              await loadData();
              toast.success(`✅ Клиент и ${appointmentCount} ${appointmentCount === 1 ? 'запись' : appointmentCount < 5 ? 'записи' : 'записей'} успешно удалены`);
            } catch (error) {
              console.error('Ошибка удаления клиента:', error);
              toast.error(`Ошибка удаления клиента: ${error.response?.data?.error || error.message}`);
            }
          }
        },
        onCancel: async () => {
          // Вторая модалка - подтверждение удаления
          const confirmed = await showConfirm({
            title: 'Подтверждение удаления',
            message: 'Вы уверены, что хотите удалить этого клиента? Записи будут сохранены (client_id будет обнулен).',
            confirmText: 'Да, удалить',
            cancelText: 'Отмена',
            confirmButtonClass: 'btn-danger'
          });
          
          if (confirmed) {
            try {
              await axios.delete(`${API_URL}/clients/${clientId}`, {
                data: { 
                  currentUser: currentUser,
                  deleteAppointments: false
                }
              });
              await loadData();
              toast.success(`✅ Клиент удален. ${appointmentCount} ${appointmentCount === 1 ? 'запись' : appointmentCount < 5 ? 'записи' : 'записей'} сохранены (client_id обнулен)`);
            } catch (error) {
              console.error('Ошибка удаления клиента:', error);
              toast.error(`Ошибка удаления клиента: ${error.response?.data?.error || error.message}`);
            }
          }
        }
      });
    } else {
      // Если записей нет, просто подтверждаем удаление
      showConfirm({
        title: 'Подтверждение удаления',
        message: 'Вы уверены, что хотите удалить этого клиента? Это действие нельзя отменить.',
        confirmText: 'Да, удалить',
        cancelText: 'Отмена',
        confirmButtonClass: 'btn-danger',
        onConfirm: async () => {
          try {
            await axios.delete(`${API_URL}/clients/${clientId}`, {
              data: { 
                currentUser: currentUser,
                deleteAppointments: false
              }
            });
            await loadData();
            toast.success('✅ Клиент успешно удален');
          } catch (error) {
            console.error('Ошибка удаления клиента:', error);
            toast.error(`Ошибка удаления клиента: ${error.response?.data?.error || error.message}`);
          }
        }
      });
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      console.log('Отправка данных клиента:', clientForm);
      
      if (editingClient) {
        // Редактирование существующего клиента
        await axios.put(`${API_URL}/clients/${editingClient.id}`, {
          ...clientForm,
          currentUser: currentUser
        });
        toast.success('✅ Клиент успешно обновлен');
      } else {
        // Создание нового клиента
        const response = await axios.post(`${API_URL}/clients`, clientForm);
        console.log('Ответ сервера:', response.data);
        const newClientId = response.data.id;
        
        // Если модалка записи открыта, автоматически выбираем нового клиента
        if (showAppointmentModal) {
          setAppointmentForm({ ...appointmentForm, client_id: newClientId });
          // Используем данные из формы для отображения
          setClientSearchQuery(getFullName(clientForm.lastName, clientForm.firstName, clientForm.middleName));
        }
        
        toast.success('✅ Клиент успешно создан');
      }
      
      // Обновляем данные
      await loadData();
      
      // Очищаем форму и закрываем модалку
      setClientForm({ lastName: '', firstName: '', middleName: '', phone: '', address: '', email: '', notes: '', date_of_birth: '', passport_number: '' });
      setEditingClient(null);
      setShowClientModal(false);
    } catch (error) {
      console.error('Ошибка сохранения клиента:', error);
      console.error('Ответ сервера:', error.response?.data);
      toast.error(`Ошибка сохранения клиента: ${error.response?.data?.error || error.message}`);
    }
  };

  // Создание записи
  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    
    if (!appointmentForm.client_id) {
      toast.warning('Пожалуйста, выберите клиента');
      return;
    }
    if (!appointmentForm.doctor_id) {
      toast.warning('Пожалуйста, выберите врача');
      return;
    }
    if (appointmentForm.services.length === 0) {
      toast.warning('Пожалуйста, выберите хотя бы одну услугу');
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
      
      await loadData();
      
      // Отправляем событие для обновления календаря
      window.dispatchEvent(new Event('appointmentCreated'));
      
      toast.success('✅ Запись успешно создана!');
    } catch (error) {
      console.error('Ошибка создания записи:', error);
      
      // Закрываем модалку даже при ошибке
      setShowAppointmentModal(false);
      setClientSearchQuery('');
      
      // Отправляем событие для обновления календаря (чтобы обновились слоты)
      window.dispatchEvent(new Event('appointmentCreated'));
      
      toast.error(`Ошибка создания записи: ${error.response?.data?.error || error.message}`);
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
      toast.warning('Пожалуйста, выберите клиента');
      return;
    }
    if (!appointmentForm.doctor_id) {
      toast.warning('Пожалуйста, выберите врача');
      return;
    }
    if (appointmentForm.services.length === 0) {
      toast.warning('Пожалуйста, выберите хотя бы одну услугу');
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
      setShowEditAppointmentModal(false);
      loadData();
      toast.success('✅ Запись успешно обновлена');
    } catch (error) {
      console.error('Ошибка обновления записи:', error);
      console.error('Детали ошибки:', error.response?.data);
      toast.error(`Ошибка обновления записи: ${error.response?.data?.error || error.message}`);
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
      toast.error('Ошибка сохранения услуги');
    }
  };

  const handleDeleteService = async (id) => {
    showConfirm({
      title: 'Удаление услуги',
      message: 'Вы уверены, что хотите удалить эту услугу?',
      confirmText: 'Да, удалить',
      cancelText: 'Отмена',
      confirmButtonClass: 'btn-danger',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/services/${id}`);
          toast.success('✅ Услуга успешно удалена');
          loadData();
        } catch (error) {
          const errorMessage = error.response?.data?.error || error.message || 'Неизвестная ошибка';
          toast.error(`Ошибка удаления услуги: ${errorMessage}`);
          console.error('Ошибка удаления услуги:', error);
        }
      }
    });
  };

  // CRUD для материалов
  const handleCreateMaterial = async (e) => {
    e.preventDefault();
    try {
      if (editingMaterial) {
        await axios.put(`${API_URL}/materials/${editingMaterial.id}`, materialForm);
        setEditingMaterial(null);
      } else {
        // Создаем материал
        const materialData = { ...materialForm };
        const initialStock = parseFloat(materialData.stock) || 0;
        // Убираем stock из данных материала, так как он будет установлен через транзакцию
        delete materialData.stock;
        delete materialData.receipt_date;
        
        const response = await axios.post(`${API_URL}/materials`, materialData);
        const newMaterialId = response.data.id || response.data;
        
        // Если указан начальный остаток, создаем транзакцию прихода
        if (initialStock > 0) {
          await axios.post(`${API_URL}/materials/receipt`, {
            material_id: newMaterialId,
            quantity: initialStock,
            price: materialForm.price,
            notes: 'Начальный остаток',
            receipt_date: materialForm.receipt_date || new Date().toISOString().split('T')[0]
          });
        }
      }
      setMaterialForm({ name: '', unit: '', price: '', stock: '', description: '', receipt_date: new Date().toISOString().split('T')[0] });
      setShowMaterialModal(false);
      loadData();
    } catch (error) {
      toast.error('Ошибка сохранения материала: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleReceiptMaterial = async (e) => {
    e.preventDefault();
    try {
      if (!receiptForm.material_id || !receiptForm.quantity || parseFloat(receiptForm.quantity) <= 0) {
        toast.warning('Заполните все обязательные поля');
        return;
      }

      await axios.post(`${API_URL}/materials/receipt`, {
        material_id: parseInt(receiptForm.material_id),
        quantity: parseFloat(receiptForm.quantity),
        price: receiptForm.price || null,
        notes: receiptForm.notes || '',
        receipt_date: receiptForm.receipt_date || new Date().toISOString().split('T')[0]
      });

      toast.success('✅ Материал успешно пополнен');
      setReceiptForm({ material_id: '', quantity: '', price: '', notes: '', receipt_date: new Date().toISOString().split('T')[0] });
      setShowReceiptModal(false);
      loadData();
    } catch (error) {
      toast.error('Ошибка пополнения материала: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteMaterial = async (id) => {
    showConfirm({
      title: 'Удаление материала',
      message: 'Вы уверены, что хотите удалить этот материал?',
      confirmText: 'Да, удалить',
      cancelText: 'Отмена',
      confirmButtonClass: 'btn-danger',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/materials/${id}`);
          toast.success('✅ Материал успешно удален');
          loadData();
        } catch (error) {
          const errorMessage = error.response?.data?.error || error.message || 'Неизвестная ошибка';
          toast.error(`Ошибка удаления материала: ${errorMessage}`);
          console.error('Ошибка удаления материала:', error);
        }
      }
    });
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


  // Если не авторизован - показываем страницу входа
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLogin} />;
  }

  // Рендер основной страницы
  const renderHome = () => {
    let displayAppointments = currentUser.role === 'doctor'
      ? getDoctorAppointments()
      : getAppointmentsByDate();
    
    // Применяем фильтр по статусам
    if (hiddenStatuses.length > 0) {
      displayAppointments = displayAppointments.filter(apt => {
        // Фильтр по статусам
        if (hiddenStatuses.includes(apt.status)) {
          return false;
        }
        
        return true;
      });
    }

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
              {currentUser.role !== 'doctor' && (
                <button
                  className={`btn btn-small ${appointmentsViewMode === 'byDoctor' ? 'btn-primary' : ''}`}
                  onClick={() => setAppointmentsViewMode(appointmentsViewMode === 'table' ? 'byDoctor' : 'table')}
                  title={appointmentsViewMode === 'table' ? 'Показать по врачам' : 'Показать таблицу'}
                >
                  {appointmentsViewMode === 'table' ? '🗂️ Таблица' : '👨‍⚕️ По врачам'}
                </button>
              )}
            </div>
          </div>
          
          {/* Фильтр по статусам */}
          {currentUser.role !== 'doctor' && (
            <div style={{ 
              marginTop: '15px', 
              padding: '12px', 
              background: '#f5f5f5', 
              borderRadius: '8px',
              display: 'flex',
              gap: '15px',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontWeight: '600', color: '#333' }}>Скрыть:</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hiddenStatuses.includes('cancelled')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setHiddenStatuses([...hiddenStatuses, 'cancelled']);
                    } else {
                      setHiddenStatuses(hiddenStatuses.filter(s => s !== 'cancelled'));
                    }
                  }}
                />
                <span>Отмененные</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hiddenStatuses.includes('completed')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setHiddenStatuses([...hiddenStatuses, 'completed']);
                    } else {
                      setHiddenStatuses(hiddenStatuses.filter(s => s !== 'completed'));
                    }
                  }}
                />
                <span>Завершенные</span>
              </label>
            </div>
          )}
        </div>

        {/* Таблица записей */}
        {appointmentsViewMode === 'byDoctor' && currentUser.role !== 'doctor' ? (
          <AppointmentTableByDoctor
            appointments={displayAppointments}
            clients={clients}
            doctors={doctors}
            onClientClick={(clientId, appointment) => openClientCard(clientId, appointment, 'payment')}
            onCallStatusToggle={toggleCallStatus}
            onStatusChange={updateAppointmentStatus}
            onEditAppointment={handleEditAppointment}
            onCancelAppointment={handleCancelAppointment}
            getServiceNames={getServiceNames}
            calculateTotal={calculateAppointmentTotal}
            currentUser={currentUser}
          />
        ) : (
          <AppointmentTable
            appointments={displayAppointments}
            clients={clients}
            onClientClick={(clientId, appointment) => openClientCard(clientId, appointment, 'payment')}
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
        )}
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
            <div className="header-user-actions">
              {currentUser.role === 'superadmin' && (
                <button 
                  className="btn btn-change-password" 
                  onClick={() => setShowChangePasswordModal(true)}
                  title="Сменить пароль"
                >
                  🔐 Сменить пароль
                </button>
              )}
              <button className="btn btn-logout" onClick={handleLogout}>Выход</button>
            </div>
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
        
        {/* Администраторы - доступно только superadmin */}
        {currentView === 'administrators' && currentUser.role === 'superadmin' && (
          <AdministratorsPage onNavigate={setCurrentView} currentUser={currentUser} />
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
                <button className="btn btn-primary" onClick={() => {
                  setEditingClient(null);
                  setClientForm({ lastName: '', firstName: '', middleName: '', phone: '', address: '', email: '', notes: '', date_of_birth: '', passport_number: '' });
                  setShowClientModal(true);
                }}>+ Добавить клиента</button>
              </div>
            </div>

            {/* Поиск клиентов */}
            <div className="page-search-bar">
              <input
                type="text"
                placeholder="🔍 Поиск по ФИО или телефону..."
                value={clientsPageSearch}
                onChange={(e) => {
                  setClientsPageSearch(e.target.value);
                  setClientsPage(1); // Сбрасываем на первую страницу при поиске
                }}
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
              {(() => {
                // Фильтрация клиентов
                const filteredClients = clients.filter(c => {
                  const search = clientsPageSearch.toLowerCase();
                  const fullName = `${c.lastName || ''} ${c.firstName || ''} ${c.middleName || ''}`.toLowerCase();
                  const phone = (c.phone || '').toLowerCase();
                  return fullName.includes(search) || phone.includes(search);
                });

                // Пагинация
                const totalPages = Math.ceil(filteredClients.length / clientsPerPage);
                const startIndex = (clientsPage - 1) * clientsPerPage;
                const endIndex = startIndex + clientsPerPage;
                const paginatedClients = filteredClients.slice(startIndex, endIndex);

                return filteredClients.length === 0 ? (
                  <div className="empty-state">
                    <p>{clientsPageSearch ? 'Клиенты не найдены' : 'Нет клиентов'}</p>
                  </div>
                ) : (
                  <>
                    <table className="wide-table">
                      <thead>
                        <tr>
                          <th style={{ width: '4%' }}>#</th>
                          <th style={{ width: '18%' }}>ФИО</th>
                          <th style={{ width: '11%' }}>Телефон</th>
                          <th style={{ width: '10%' }}>Дата рождения</th>
                          <th style={{ width: '11%' }}>Номер паспорта</th>
                          <th style={{ width: '18%' }}>Адрес</th>
                          <th style={{ width: '12%' }}>Email</th>
                          <th style={{ width: '16%' }}>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedClients.map((client, index) => (
                          <tr key={client.id}>
                            <td className="number-cell">{startIndex + index + 1}</td>
                          <td>
                            <span
                              className="client-name-link"
                              onClick={() => {
                                setSelectedClientId(client.id);
                                setShowClientCardModal(true);
                              }}
                            >
                              {getFullName(client.lastName, client.firstName, client.middleName)}
                            </span>
                          </td>
                          <td>{client.phone || '-'}</td>
                          <td>{client.date_of_birth ? new Date(client.date_of_birth).toLocaleDateString('ru-RU') : '-'}</td>
                          <td>{client.passport_number || '-'}</td>
                          <td>{client.address || '-'}</td>
                          <td>{client.email || '-'}</td>
                          <td className="table-actions">
                            <button 
                              className="btn btn-small"
                              onClick={() => {
                                setSelectedClientId(client.id);
                                setShowClientCardModal(true);
                              }}
                            >
                              📋 Карточка
                            </button>
                            {currentUser.role === 'superadmin' && (
                              <>
                                <button 
                                  className="btn btn-small"
                                  onClick={() => {
                                    setEditingClient(client);
                                    setClientForm({
                                      lastName: client.lastName || '',
                                      firstName: client.firstName || '',
                                      middleName: client.middleName || '',
                                      phone: client.phone || '',
                                      address: client.address || '',
                                      email: client.email || '',
                                      notes: client.notes || ''
                                    });
                                    setShowClientModal(true);
                                  }}
                                  title="Редактировать клиента"
                                >
                                  ✏️ Редактировать
                                </button>
                                <button 
                                  className="btn btn-small btn-danger"
                                  onClick={() => handleDeleteClient(client.id)}
                                  title="Удалить клиента"
                                >
                                  🗑️ Удалить
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                
                {filteredClients.length > 0 && (
                  <Pagination
                    currentPage={clientsPage}
                    totalPages={totalPages}
                    totalItems={filteredClients.length}
                    onPageChange={(page) => {
                      setClientsPage(page);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    itemsPerPage={clientsPerPage}
                    onItemsPerPageChange={(value) => {
                      setClientsPerPage(value);
                      setClientsPage(1);
                    }}
                  />
                )}
                  </>
                );
              })()}
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
                onChange={(e) => {
                  setServicesPageSearch(e.target.value);
                  setServicesPage(1); // Сбрасываем на первую страницу при поиске
                }}
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
              {(() => {
                // Фильтрация услуг
                const filteredServices = services.filter(s => {
                  const search = servicesPageSearch.toLowerCase();
                  return s.name.toLowerCase().includes(search) || 
                         (s.category && s.category.toLowerCase().includes(search));
                });

                // Пагинация
                const totalPages = Math.ceil(filteredServices.length / servicesPerPage);
                const startIndex = (servicesPage - 1) * servicesPerPage;
                const endIndex = startIndex + servicesPerPage;
                const paginatedServices = filteredServices.slice(startIndex, endIndex);

                return filteredServices.length === 0 ? (
                  <div className="empty-state">
                    <p>{servicesPageSearch ? 'Услуги не найдены' : 'Нет услуг'}</p>
                  </div>
                ) : (
                  <>
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
                        {paginatedServices.map((service, index) => (
                          <tr key={service.id}>
                            <td className="service-number">{startIndex + index + 1}</td>
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
                    
                    {filteredServices.length > 0 && (
                      <Pagination
                        currentPage={servicesPage}
                        totalPages={totalPages}
                        totalItems={filteredServices.length}
                        onPageChange={(page) => {
                          setServicesPage(page);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        itemsPerPage={servicesPerPage}
                        onItemsPerPageChange={(value) => {
                          setServicesPerPage(value);
                          setServicesPage(1);
                        }}
                      />
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
        
        {/* Материалы - только для superadmin */}
        {currentView === 'materials' && currentUser.role === 'superadmin' && (
          <div>
            <div className="section-header">
              <h2>📦 Все материалы ({materials.filter(m => {
                const search = materialsPageSearch.toLowerCase();
                return m.name.toLowerCase().includes(search);
              }).length})</h2>
              <div>
                <button className="btn" onClick={() => setCurrentView('home')}>← Назад</button>
                <button className="btn btn-primary" onClick={() => setShowMaterialModal(true)}>+ Добавить материал</button>
              </div>
            </div>

            {/* Поиск материалов */}
            <div className="page-search-bar">
              <input
                type="text"
                placeholder="🔍 Поиск по названию материала..."
                value={materialsPageSearch}
                onChange={(e) => {
                  setMaterialsPageSearch(e.target.value);
                  setMaterialsPage(1); // Сбрасываем на первую страницу при поиске
                }}
                className="page-search-input"
              />
              {materialsPageSearch && (
                <button 
                  className="btn btn-small"
                  onClick={() => setMaterialsPageSearch('')}
                >
                  ✕ Очистить
                </button>
              )}
            </div>

            <div className="materials-list-wide">
              {(() => {
                // Фильтрация материалов
                const filteredMaterials = materials.filter(m => {
                  const search = materialsPageSearch.toLowerCase();
                  return m.name.toLowerCase().includes(search);
                });

                // Пагинация
                const totalPages = Math.ceil(filteredMaterials.length / materialsPerPage);
                const startIndex = (materialsPage - 1) * materialsPerPage;
                const endIndex = startIndex + materialsPerPage;
                const paginatedMaterials = filteredMaterials.slice(startIndex, endIndex);

                return filteredMaterials.length === 0 ? (
                  <div className="empty-state">
                    <p>{materialsPageSearch ? 'Материалы не найдены' : 'Нет материалов'}</p>
                  </div>
                ) : (
                  <>
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
                        {paginatedMaterials.map((material, index) => (
                          <tr key={material.id}>
                            <td className="number-cell">{startIndex + index + 1}</td>
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
                            className="btn btn-small btn-primary"
                            onClick={() => {
                              setReceiptForm({ 
                                material_id: material.id, 
                                quantity: '', 
                                price: material.price, 
                                notes: '', 
                                receipt_date: new Date().toISOString().split('T')[0] 
                              });
                              setMaterialSearchQuery('');
                              setShowReceiptModal(true);
                            }}
                          >
                            ➕ Пополнить
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
                    
                    {filteredMaterials.length > 0 && (
                      <Pagination
                        currentPage={materialsPage}
                        totalPages={totalPages}
                        totalItems={filteredMaterials.length}
                        onPageChange={(page) => {
                          setMaterialsPage(page);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        itemsPerPage={materialsPerPage}
                        onItemsPerPageChange={(value) => {
                          setMaterialsPerPage(value);
                          setMaterialsPage(1);
                        }}
                      />
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
        
        {/* Статистика и отчеты - только для superadmin */}
        {currentView === 'statistics' && currentUser.role === 'superadmin' && (
          <StatisticsPage onNavigate={setCurrentView} currentUser={currentUser} />
        )}
        
        {/* Конструктор составных услуг - только для superadmin */}
        {currentView === 'composite-services' && currentUser.role === 'superadmin' && (
          <CompositeServicesPage 
            onNavigate={setCurrentView} 
            services={services}
            materials={materials}
          />
        )}

        {/* Отчеты - только для superadmin (старая версия, можно удалить позже) */}
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
            toast={toast}
            showConfirm={showConfirm}
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
          onClose={() => {
            setShowClientCardModal(false);
            setSelectedClientCardMode('card');
            setSelectedAppointmentForPayment(null);
          }}
          onUpdate={loadData}
          toast={toast}
          onEditAppointment={handleEditAppointment}
          onCancelAppointment={handleCancelAppointment}
          showConfirm={showConfirm}
          mode={selectedClientCardMode}
          selectedAppointment={selectedAppointmentForPayment}
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
          showConfirm={showConfirm}
        />
      )}

      {/* Модальное окно формы приема для врача */}
      {showCompleteVisitModal && selectedAppointmentForComplete && (
        <div className="modal-overlay" onClick={() => {
          setShowCompleteVisitModal(false);
          setSelectedAppointmentForComplete(null);
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ 
            maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <CompleteVisit
              visit={selectedAppointmentForComplete}
              services={services}
              materials={materials}
              onSuccess={async () => {
                setShowCompleteVisitModal(false);
                setSelectedAppointmentForComplete(null);
                await loadData(); // Обновляем все данные, включая клиентов
                // Отправляем событие для обновления карточек клиентов
                window.dispatchEvent(new Event('appointmentUpdated'));
                window.dispatchEvent(new Event('clientDataUpdated'));
                toast.success('✅ Информация о приеме сохранена');
              }}
              onCancel={() => {
                setShowCompleteVisitModal(false);
                setSelectedAppointmentForComplete(null);
              }}
              toast={toast}
            />
          </div>
        </div>
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
                  onClick={() => {
                    setEditingClient(null);
                    setClientForm({ lastName: '', firstName: '', middleName: '', phone: '', address: '', email: '', notes: '', date_of_birth: '', passport_number: '' });
                    setShowClientModal(true);
                  }}
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
            setMaterialForm({ name: '', unit: '', price: '', stock: '', description: '', receipt_date: new Date().toISOString().split('T')[0] });
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

              {!editingMaterial && (
                <>
                  <label>Начальный остаток на складе</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={materialForm.stock}
                    onChange={(e) => setMaterialForm({ ...materialForm, stock: e.target.value })}
                  />

                  <label>Дата прихода *</label>
                  <input
                    type="date"
                    value={materialForm.receipt_date}
                    onChange={(e) => setMaterialForm({ ...materialForm, receipt_date: e.target.value })}
                    required
                  />
                </>
              )}

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
                    setMaterialForm({ name: '', unit: '', price: '', stock: '', description: '', receipt_date: new Date().toISOString().split('T')[0] });
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

      {/* Модальное окно пополнения материала */}
      {showReceiptModal && (
        <div className="modal-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setShowReceiptModal(false);
            setReceiptForm({ material_id: '', quantity: '', price: '', notes: '', receipt_date: new Date().toISOString().split('T')[0] });
            setMaterialSearchQuery('');
          }
        }}>
          <div className="modal">
            <h2>Пополнить материал</h2>
            <form onSubmit={handleReceiptMaterial}>
              <label>Поиск материала</label>
              <input
                type="text"
                placeholder="Введите название материала для поиска..."
                value={materialSearchQuery}
                onChange={(e) => {
                  setMaterialSearchQuery(e.target.value);
                  // Если материал уже выбран и он не соответствует поиску, сбрасываем выбор
                  if (receiptForm.material_id) {
                    const selectedMaterial = materials.find(m => m.id === parseInt(receiptForm.material_id));
                    if (selectedMaterial && !selectedMaterial.name.toLowerCase().includes(e.target.value.toLowerCase())) {
                      setReceiptForm({ ...receiptForm, material_id: '', price: '' });
                    }
                  }
                }}
                style={{ marginBottom: '10px' }}
              />

              <label>Материал *</label>
              <select
                value={receiptForm.material_id}
                onChange={(e) => {
                  const material = materials.find(m => m.id === parseInt(e.target.value));
                  setReceiptForm({ 
                    ...receiptForm, 
                    material_id: e.target.value,
                    price: material ? material.price : ''
                  });
                  // Очищаем поиск после выбора
                  setMaterialSearchQuery('');
                }}
                required
                style={{ 
                  fontSize: '14px',
                  height: materialSearchQuery ? '200px' : 'auto'
                }}
                size={materialSearchQuery ? Math.min(5, materials.filter(m => 
                  m.name.toLowerCase().includes(materialSearchQuery.toLowerCase())
                ).length) : 1}
              >
                <option value="">Выберите материал</option>
                {materials
                  .filter(m => 
                    !materialSearchQuery || 
                    m.name.toLowerCase().includes(materialSearchQuery.toLowerCase())
                  )
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit}) - Остаток: {m.stock} {m.unit} - Цена: {m.price} BYN
                    </option>
                  ))}
              </select>
              {materialSearchQuery && materials.filter(m => 
                m.name.toLowerCase().includes(materialSearchQuery.toLowerCase())
              ).length === 0 && (
                <div style={{ color: '#999', fontSize: '12px', marginTop: '5px' }}>
                  Материалы не найдены
                </div>
              )}

              <label>Количество *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={receiptForm.quantity}
                onChange={(e) => setReceiptForm({ ...receiptForm, quantity: e.target.value })}
                required
              />

              <label>Цена за единицу (BYN)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Оставить текущую цену"
                value={receiptForm.price}
                onChange={(e) => setReceiptForm({ ...receiptForm, price: e.target.value })}
              />

              <label>Дата прихода *</label>
              <input
                type="date"
                value={receiptForm.receipt_date}
                onChange={(e) => setReceiptForm({ ...receiptForm, receipt_date: e.target.value })}
                required
              />

              <label>Примечание</label>
              <textarea
                placeholder="Примечание к приходу (необязательно)"
                value={receiptForm.notes}
                onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                rows={3}
              />

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => {
                    setShowReceiptModal(false);
                    setReceiptForm({ material_id: '', quantity: '', price: '', notes: '', receipt_date: new Date().toISOString().split('T')[0] });
                    setMaterialSearchQuery('');
                  }}
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  ✅ Пополнить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно создания/редактирования клиента */}
      {showClientModal && (
        <div 
          className="modal-overlay" 
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowClientModal(false);
              setEditingClient(null);
            }
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingClient ? 'Редактировать клиента' : 'Новый клиент'}</h2>
            <form onSubmit={handleCreateClient}>
              <label>Фамилия *</label>
              <input
                type="text"
                placeholder="Фамилия"
                value={clientForm.lastName}
                onChange={(e) => {
                  const lastName = e.target.value;
                  setClientForm({ ...clientForm, lastName });
                  
                  // Автозаполнение телефона по ФИО (только при создании нового клиента)
                  if (!editingClient && lastName && clientForm.firstName) {
                    const existingClient = clients.find(c => 
                      c.lastName?.toLowerCase() === lastName.toLowerCase() &&
                      c.firstName?.toLowerCase() === clientForm.firstName.toLowerCase() &&
                      (!clientForm.middleName || c.middleName?.toLowerCase() === clientForm.middleName.toLowerCase())
                    );
                    if (existingClient && existingClient.phone && !clientForm.phone) {
                      setClientForm(prev => ({ ...prev, phone: existingClient.phone }));
                    }
                  }
                }}
                required
              />

              <label>Имя *</label>
              <input
                type="text"
                placeholder="Имя"
                value={clientForm.firstName}
                onChange={(e) => {
                  const firstName = e.target.value;
                  setClientForm({ ...clientForm, firstName });
                  
                  // Автозаполнение телефона по ФИО (только при создании нового клиента)
                  if (!editingClient && firstName && clientForm.lastName) {
                    const existingClient = clients.find(c => 
                      c.lastName?.toLowerCase() === clientForm.lastName.toLowerCase() &&
                      c.firstName?.toLowerCase() === firstName.toLowerCase() &&
                      (!clientForm.middleName || c.middleName?.toLowerCase() === clientForm.middleName.toLowerCase())
                    );
                    if (existingClient && existingClient.phone && !clientForm.phone) {
                      setClientForm(prev => ({ ...prev, phone: existingClient.phone }));
                    }
                  }
                }}
                required
              />

              <label>Отчество</label>
              <input
                type="text"
                placeholder="Отчество"
                value={clientForm.middleName}
                onChange={(e) => {
                  const middleName = e.target.value;
                  setClientForm({ ...clientForm, middleName });
                  
                  // Автозаполнение телефона по ФИО (только при создании нового клиента)
                  if (!editingClient && middleName && clientForm.lastName && clientForm.firstName) {
                    const existingClient = clients.find(c => 
                      c.lastName?.toLowerCase() === clientForm.lastName.toLowerCase() &&
                      c.firstName?.toLowerCase() === clientForm.firstName.toLowerCase() &&
                      c.middleName?.toLowerCase() === middleName.toLowerCase()
                    );
                    if (existingClient && existingClient.phone && !clientForm.phone) {
                      setClientForm(prev => ({ ...prev, phone: existingClient.phone }));
                    }
                  }
                }}
              />

              <label>Дата рождения</label>
              <input
                type="date"
                value={clientForm.date_of_birth}
                onChange={(e) => setClientForm({ ...clientForm, date_of_birth: e.target.value })}
              />

              <label>Номер паспорта</label>
              <input
                type="text"
                placeholder="Номер паспорта"
                value={clientForm.passport_number}
                onChange={(e) => setClientForm({ ...clientForm, passport_number: e.target.value })}
              />

              <label>Телефон *</label>
              <PhoneInput
                value={clientForm.phone}
                onChange={(phone) => setClientForm({ ...clientForm, phone })}
                placeholder="+375 (XX) XXX-XX-XX"
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
                  {editingClient ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast уведомления */}
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      
      {/* Модальное окно подтверждения */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        confirmButtonClass={confirmModal.confirmButtonClass}
      />

      {/* Модальное окно смены пароля */}
      <ChangePassword
        currentUser={currentUser}
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        onSuccess={() => {
          // Можно добавить дополнительную логику после успешной смены пароля
        }}
      />
    </div>
  );
}

export default App;
