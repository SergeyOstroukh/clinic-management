import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import { useSocketEvent } from '../../hooks/useSocket';
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

const DAYS_OF_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Утилиты для работы с датами БЕЗ timezone проблем
const formatDate = (year, month, day) => {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const formatDateTime = (year, month, day, hours, minutes) => {
  return `${formatDate(year, month, day)} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
};

// Нормализация формата даты для сравнения
const normalizeDateString = (dateStr) => {
  if (!dateStr) return '';
  
  // Преобразуем в строку на случай, если это объект Date или другой тип
  let str = String(dateStr).trim();
  
  // Убираем лишние кавычки и пробелы в начале
  str = str.replace(/^["'\s]+|["'\s]+$/g, '');
  
  // Если строка начинается с "ue" или похоже на обрезанный формат типа "ue Dec 09 2025 19:"
  // Пытаемся распарсить как дату в формате "Dec 09 2025 19:00" или подобном
  if (str.match(/^[a-z]{2,3}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\s+\d{1,2}:/i)) {
    try {
      // Пытаемся восстановить полную строку и распарсить
      // "ue Dec 09 2025 19:" -> "Dec 09 2025 19:00"
      const match = str.match(/([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{0,2})/);
      if (match) {
        const [, monthName, day, year, hours, minutes = '00'] = match;
        const monthMap = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
          'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
          'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        const month = monthMap[monthName] || '01';
        const dayPadded = String(day).padStart(2, '0');
        const hoursPadded = String(hours).padStart(2, '0');
        const minutesPadded = String(minutes).padStart(2, '0');
        str = `${year}-${month}-${dayPadded} ${hoursPadded}:${minutesPadded}:00`;
      }
    } catch (e) {
      console.error('Ошибка парсинга обрезанного формата даты:', e, dateStr);
    }
  }
  
  // Если это объект Date в строковом виде, пытаемся извлечь дату
  if (str === '[object Object]' || str === '[object Date]') {
    try {
      const dateObj = new Date(dateStr);
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const seconds = String(dateObj.getSeconds()).padStart(2, '0');
        str = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      }
    } catch (e) {
      console.error('Ошибка преобразования даты в normalizeDateString:', e, dateStr);
    }
  }
  
  // Нормализуем: убираем 'T', заменяем на пробел, убираем timezone
  let normalized = str.replace('T', ' ');
  if (normalized.includes('Z')) {
    normalized = normalized.replace('Z', '');
  }
  if (normalized.includes('+')) {
    normalized = normalized.split('+')[0].trim();
  }
  // Убираем timezone в формате -HH:MM
  if (normalized.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}-\d{2}:\d{2}$/)) {
    normalized = normalized.substring(0, 19);
  }
  
  // Обрезаем до формата YYYY-MM-DD HH:MM:SS если длиннее
  if (normalized.length > 19) {
    normalized = normalized.substring(0, 19);
  }
  
  return normalized.trim();
};

const parseTime = (dateTimeStr) => {
  // Парсим время из разных форматов:
  // '2026-01-21 16:00:00' (правильный формат)
  // '2026-01-21T16:00:00' (ISO формат)
  // '2026-01-21T16:00:00Z' (ISO с timezone)
  if (!dateTimeStr) return { hours: 0, minutes: 0 };
  
  // Нормализуем формат
  const normalized = normalizeDateString(dateTimeStr);
  
  // Парсим время (часть после пробела)
  const timePart = normalized.split(' ')[1];
  if (!timePart) return { hours: 0, minutes: 0 };
  
  const parts = timePart.split(':');
  return {
    hours: parseInt(parts[0]) || 0,
    minutes: parseInt(parts[1]) || 0
  };
};

// Преобразование времени HH:MM в минуты от начала дня
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Преобразование минут от начала дня в HH:MM
const minutesToTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Проверка, занят ли слот с учетом duration записей
const isSlotBlockedByAppointment = (slotTimeStr, appointments) => {
  const slotMinutes = timeToMinutes(slotTimeStr);
  
  for (const apt of appointments) {
    if (apt.status === 'cancelled') continue;
    
    const aptTime = parseTime(apt.appointment_date);
    const aptMinutes = aptTime.hours * 60 + aptTime.minutes;
    const aptDuration = apt.duration || 30;
    
    // Слот заблокирован, если он попадает в интервал записи
    if (slotMinutes >= aptMinutes && slotMinutes < aptMinutes + aptDuration) {
      // Проверяем, является ли этот слот началом записи
      const isAppointmentStart = slotMinutes === aptMinutes;
      return { blocked: true, appointment: apt, isAppointmentStart };
    }
  }
  
  return { blocked: false, appointment: null, isAppointmentStart: false };
};

// Расчет длительности между двумя временами
const calculateDuration = (startTime, endTime) => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return endMinutes - startMinutes;
};

const BookingCalendarV2 = ({ currentUser, onBack, editingAppointment, onEditComplete, toast, showConfirm: externalShowConfirm }) => {
  // Используем внешний showConfirm или создаем свой
  const { confirmModal, showConfirm: internalShowConfirm } = useConfirmModal();
  const showConfirm = externalShowConfirm || internalShowConfirm;
  
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [specificDates, setSpecificDates] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalUpdateKey, setModalUpdateKey] = useState(0);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [nearestSlots, setNearestSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showNearestSlots, setShowNearestSlots] = useState(false);
  const [showAllDoctorsMode, setShowAllDoctorsMode] = useState(false);
  const [allDoctorsSlots, setAllDoctorsSlots] = useState({}); // { '2026-01-15': [{ doctor, time, ... }] }
  const [showDayAppointmentsTable, setShowDayAppointmentsTable] = useState(false);

  // Форма записи
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [notes, setNotes] = useState('');
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedEndTime, setSelectedEndTime] = useState(null); // Время окончания для выбора диапазона
  const [duration, setDuration] = useState(30); // Длительность в минутах (по умолчанию 30)
  const [manualTimeMode, setManualTimeMode] = useState(false); // Режим ручного ввода времени
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [selectedSlotDoctor, setSelectedSlotDoctor] = useState(null); // Врач выбранного слота в режиме нескольких врачей
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    phone: '',
    date_of_birth: '',
    passport_number: '',
    citizenship_data: '',
    population_type: 'city'
  });

  useEffect(() => {
    loadDoctors();
    loadClients();
  }, []);

  // Загружаем ближайшие свободные слоты только если нужно показать
  useEffect(() => {
    if (showNearestSlots && doctors.length > 0) {
      loadNearestSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNearestSlots, doctors]);

  // Обработка редактирования записи - открываем календарь с нужной датой
  useEffect(() => {
    if (editingAppointment && doctors.length > 0 && clients.length > 0) {
      const appointmentDate = new Date(editingAppointment.appointment_date);
      const year = appointmentDate.getFullYear();
      const month = appointmentDate.getMonth() + 1;
      const day = appointmentDate.getDate();
      
      // Устанавливаем нужный месяц и год
      setCurrentYear(year);
      setCurrentMonth(month);
      
      // Выбираем врача
      const doctor = doctors.find(d => d.id === editingAppointment.doctor_id);
      if (doctor) {
        setSelectedDoctor(doctor);
        
        // Ждем загрузки расписания и записей, затем открываем модалку
        const timer = setTimeout(() => {
          // Открываем день напрямую - даже если нет расписания, все равно открываем для редактирования
          const daySlots = generateDaySlots(year, month, day);
          setSelectedSlot(daySlots);
          setShowModal(true);
          
          // Заполняем форму данными записи
          const client = clients.find(c => c.id === editingAppointment.client_id);
          if (client) {
            setSelectedClient(client);
            setClientSearch(`${client.lastName} ${client.firstName}`);
          }
          
          // Заполняем услуги
          if (editingAppointment.services && editingAppointment.services.length > 0) {
            setSelectedServices(editingAppointment.services.map(s => ({
              service_id: s.service_id,
              quantity: s.quantity || 1
            })));
          } else {
            setSelectedServices([]);
          }
          
          // Заполняем заметки
          setNotes(editingAppointment.notes || '');
          
          // Устанавливаем время
          const hours = appointmentDate.getHours();
          const minutes = appointmentDate.getMinutes();
          const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          setSelectedTime(timeStr);
          
          // Сохраняем ID записи для редактирования
          setEditingAppointmentId(editingAppointment.id);
        }, 1000); // Увеличиваем время ожидания для загрузки расписания
        
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingAppointment, doctors, clients, schedules, appointments]);

  useEffect(() => {
    if (selectedDoctor) {
      loadSchedule();
      loadAppointments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor, currentYear, currentMonth]);

  // Загрузка данных всех врачей для режима "Все записи"
  useEffect(() => {
    if (showAllDoctorsMode && doctors.length > 0) {
      loadAllDoctorsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllDoctorsMode, currentYear, currentMonth, doctors]);

  // Обработчик события отмены/создания записи - обновляем календарь
  useEffect(() => {
    const handleAppointmentChange = () => {
      // НЕ загружаем записи здесь, так как это уже делается в функциях createAppointment и cancelAppointment
      // Только обновляем список ближайших слотов
      loadNearestSlots();
    };
    
    window.addEventListener('appointmentCreated', handleAppointmentChange);
    
    return () => {
      window.removeEventListener('appointmentCreated', handleAppointmentChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor]);

  // Socket.IO: real-time обновление при изменении записей с другого устройства
  useSocketEvent('appointmentUpdated', useCallback(() => {
    if (selectedDoctor) {
      loadAppointments();
    }
    if (showAllDoctorsMode && doctors.length > 0) {
      loadAllDoctorsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor, showAllDoctorsMode, doctors.length]));

  useSocketEvent('appointmentCreated', useCallback(() => {
    if (selectedDoctor) {
      loadAppointments();
      loadNearestSlots();
    }
    if (showAllDoctorsMode && doctors.length > 0) {
      loadAllDoctorsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor, showAllDoctorsMode, doctors.length]));

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

  const loadClients = async () => {
    try {
      const response = await axios.get(`${API_URL}/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('Ошибка загрузки клиентов:', error);
    }
  };


  // Загрузка ближайших свободных слотов для всех врачей
  const loadNearestSlots = async () => {
    if (doctors.length === 0) return;
    
    setLoadingSlots(true);
    try {
      const allSlots = [];
      const today = new Date();
      const daysToCheck = 30; // Проверяем на 30 дней вперед
      
      // Загружаем расписания и записи для каждого врача
      for (const doctor of doctors) {
        try {
          // Загружаем расписание врача
          const [schedulesRes, datesRes] = await Promise.all([
            axios.get(`${API_URL}/schedules?doctor_id=${doctor.id}`),
            axios.get(`${API_URL}/specific-dates?doctor_id=${doctor.id}`)
          ]);
          
          const doctorSchedules = schedulesRes.data;
          const doctorSpecificDates = datesRes.data;
          
          // Загружаем записи врача на ближайшие дни
          const currentYear = today.getFullYear();
          const currentMonth = today.getMonth() + 1;
          const appointmentsRes = await axios.get(
            `${API_URL}/doctors/${doctor.id}/monthly-appointments?month=${currentMonth}&year=${currentYear}`
          );
          const doctorAppointments = appointmentsRes.data.filter(apt => apt.status !== 'cancelled');
          
          // Ищем свободные слоты на ближайшие дни
          for (let i = 0; i < daysToCheck; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + i);
            const year = checkDate.getFullYear();
            const month = checkDate.getMonth() + 1;
            const day = checkDate.getDate();
            const dateStr = formatDate(year, month, day);
            const dayOfWeek = checkDate.getDay();
            
            // Получаем расписание на этот день (несколько слотов в день поддерживаются)
            let daySchedule = [];
            const specificForDay = doctorSpecificDates.filter(sd => sd.work_date === dateStr && sd.is_active);
            if (specificForDay.length > 0) {
              daySchedule = specificForDay.map(sd => ({ start_time: sd.start_time, end_time: sd.end_time }));
            } else {
              const daySchedules = doctorSchedules.filter(s => s.day_of_week === dayOfWeek && s.is_active);
              daySchedule = daySchedules.map(s => ({ start_time: s.start_time, end_time: s.end_time }));
            }

            if (daySchedule.length === 0) continue;
            
            // Генерируем слоты для этого дня
            const allDaySlots = [];
            daySchedule.forEach(s => {
              const slots = generateTimeSlots(s.start_time, s.end_time);
              slots.forEach(time => {
                allDaySlots.push({ time, dateStr, year, month, day });
              });
            });
            
            // Проверяем, какие слоты свободны
            // Нормализуем формат даты для сравнения
            const dayAppointments = doctorAppointments.filter(apt => {
              if (!apt.appointment_date) return false;
              
              // Нормализуем формат даты записи
              const normalizedDate = normalizeDateString(apt.appointment_date);
              
              // Проверяем, начинается ли с нужной даты
              return normalizedDate.startsWith(dateStr);
            });
            
            for (const slot of allDaySlots) {
              const isBooked = dayAppointments.some(apt => {
                const aptTime = parseTime(apt.appointment_date);
                const slotTime = slot.time.split(':');
                return aptTime.hours === parseInt(slotTime[0]) && aptTime.minutes === parseInt(slotTime[1]);
              });
              
              if (!isBooked) {
                // Проверяем, что время еще не прошло (для сегодняшнего дня)
                if (i === 0) {
                  const now = new Date();
                  const slotDateTime = new Date(year, month - 1, day, 
                    parseInt(slot.time.split(':')[0]), 
                    parseInt(slot.time.split(':')[1]));
                  if (slotDateTime <= now) continue;
                }
                
                allSlots.push({
                  doctor,
                  dateStr,
                  year,
                  month,
                  day,
                  time: slot.time,
                  datetime: new Date(year, month - 1, day, 
                    parseInt(slot.time.split(':')[0]), 
                    parseInt(slot.time.split(':')[1]))
                });
              }
            }
          }
        } catch (error) {
          console.error(`Ошибка загрузки данных для врача ${doctor.id}:`, error);
        }
      }
      
      // Сортируем по дате/времени и берем первые 15
      allSlots.sort((a, b) => a.datetime - b.datetime);
      setNearestSlots(allSlots.slice(0, 15));
    } catch (error) {
      console.error('Ошибка загрузки ближайших слотов:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Загрузка данных всех врачей для режима "Все записи"
  const loadAllDoctorsData = async () => {
    try {
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      const slotsByDate = {};

      // Загружаем данные для ВСЕХ врачей ПАРАЛЛЕЛЬНО (вместо последовательного цикла)
      const doctorResults = await Promise.all(
        doctors.map(async (doctor) => {
          try {
            const [schedulesRes, datesRes, appointmentsRes] = await Promise.all([
              axios.get(`${API_URL}/schedules?doctor_id=${doctor.id}`),
              axios.get(`${API_URL}/specific-dates?doctor_id=${doctor.id}`),
              axios.get(`${API_URL}/doctors/${doctor.id}/monthly-appointments?month=${currentMonth}&year=${currentYear}`)
            ]);
            return {
              doctor,
              schedules: schedulesRes.data,
              specificDates: datesRes.data,
              appointments: appointmentsRes.data.filter(apt => apt.status !== 'cancelled')
            };
          } catch (error) {
            console.error(`Ошибка загрузки данных для врача ${doctor.id}:`, error);
            return null;
          }
        })
      );

      // Обрабатываем результаты (генерация слотов — чистые вычисления, быстро)
      for (const result of doctorResults) {
        if (!result) continue;
        const { doctor, schedules, specificDates, appointments } = result;

        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = formatDate(currentYear, currentMonth, day);
          const dayOfWeek = new Date(currentYear, currentMonth - 1, day).getDay();

          // Получаем расписание на этот день
          let daySchedule = [];
          const specificForDay = specificDates.filter(
            sd => sd.work_date === dateStr && sd.is_active
          );
          if (specificForDay.length > 0) {
            daySchedule = specificForDay.map(sd => ({ start_time: sd.start_time, end_time: sd.end_time }));
          } else {
            const daySchedules = schedules.filter(
              s => s.day_of_week === dayOfWeek && s.is_active
            );
            daySchedule = daySchedules.map(s => ({ start_time: s.start_time, end_time: s.end_time }));
          }

          if (daySchedule.length === 0) continue;

          // Фильтруем приёмы для этого дня один раз (вместо повторной фильтрации в каждом слоте)
          const dayAppointments = appointments.filter(apt => {
            if (!apt.appointment_date || apt.status === 'cancelled') return false;
            const normalizedDate = normalizeDateString(apt.appointment_date);
            return normalizedDate.startsWith(dateStr);
          });

          const sortedSchedule = [...daySchedule].sort((a, b) => {
            const aMinutes = parseInt(a.start_time.split(':')[0]) * 60 + parseInt(a.start_time.split(':')[1]);
            const bMinutes = parseInt(b.start_time.split(':')[0]) * 60 + parseInt(b.start_time.split(':')[1]);
            return aMinutes - bMinutes;
          });

          sortedSchedule.forEach((s, scheduleIndex) => {
            const times = generateTimeSlots(s.start_time, s.end_time);
            times.forEach((time, timeIndex) => {
              const [slotHour, slotMinute] = time.split(':').map(Number);
              const slotDateTime = new Date(currentYear, currentMonth - 1, day, slotHour, slotMinute, 0, 0);
              const now = new Date();
              now.setSeconds(0, 0);
              const isPast = slotDateTime.getTime() < now.getTime();

              const slotMinutes = slotHour * 60 + slotMinute;
              
              const bookingAppointment = dayAppointments.find(apt => {
                const aptTime = parseTime(apt.appointment_date);
                const aptStartMinutes = aptTime.hours * 60 + aptTime.minutes;
                const aptDuration = apt.duration || 30;
                const aptEndMinutes = aptStartMinutes + aptDuration;
                return slotMinutes >= aptStartMinutes && slotMinutes < aptEndMinutes;
              });
              
              const isBooked = !!bookingAppointment;
              
              const isAppointmentStart = bookingAppointment ? (() => {
                const aptTime = parseTime(bookingAppointment.appointment_date);
                return aptTime.hours === slotHour && aptTime.minutes === slotMinute;
              })() : false;

              if (!slotsByDate[dateStr]) {
                slotsByDate[dateStr] = [];
              }
              slotsByDate[dateStr].push({
                doctor,
                time,
                year: currentYear,
                month: currentMonth,
                day,
                dateStr,
                isBooked,
                isPast,
                isAppointmentStart,
                appointment: bookingAppointment || null,
                scheduleBlock: scheduleIndex,
                isFirstInBlock: timeIndex === 0,
                scheduleStart: s.start_time,
                scheduleEnd: s.end_time
              });
            });
          });
        }
      }

      setAllDoctorsSlots(slotsByDate);
      return slotsByDate;
    } catch (error) {
      console.error('Ошибка загрузки данных всех врачей:', error);
      return {};
    }
  };

  const loadSchedule = async () => {
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
    try {
      const response = await axios.get(
        `${API_URL}/doctors/${selectedDoctor.id}/monthly-appointments?month=${currentMonth}&year=${currentYear}`
      );
      // Создаем новый массив чтобы React увидел изменения
      // Используем JSON.parse(JSON.stringify()) для глубокого копирования и гарантии нового объекта
      setAppointments(JSON.parse(JSON.stringify(response.data)));
    } catch (error) {
      console.error('Ошибка загрузки записей:', error);
    }
  };

  const getDaySchedule = (year, month, day) => {
    const dateStr = formatDate(year, month, day);
    const dayOfWeek = new Date(year, month - 1, day).getDay();

    // Точечные даты — может быть несколько слотов в один день
    const specificForDay = specificDates.filter(sd => sd.work_date === dateStr && sd.is_active);
    if (specificForDay.length > 0) {
      return specificForDay.map(sd => ({ start_time: sd.start_time, end_time: sd.end_time }));
    }

    // Регулярное расписание
    const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeek && s.is_active);
    if (daySchedules.length > 0) {
      return daySchedules.map(s => ({ start_time: s.start_time, end_time: s.end_time }));
    }

    return [];
  };

  const generateTimeSlots = (startTime, endTime) => {
    const slots = [];
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    let currentH = startH;
    let currentM = startM;

    while (currentH < endH || (currentH === endH && currentM < endM)) {
      slots.push(`${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`);
      currentM += 30;
      if (currentM >= 60) {
        currentM = 0;
        currentH += 1;
      }
    }

    return slots;
  };

  // Получение статуса дня для режима всех врачей
  const getDayStatusAllDoctors = (year, month, day) => {
    const dateStr = formatDate(year, month, day);
    const slots = allDoctorsSlots[dateStr] || [];
    if (slots.length === 0) return 'no-schedule';
    
    // Проверяем, является ли день сегодняшним
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(year, month - 1, day);
    checkDate.setHours(0, 0, 0, 0);
    const isToday = checkDate.getTime() === today.getTime();
    
    // Разделяем слоты на свободные и занятые
    const freeSlots = slots.filter(slot => !slot.isBooked);
    const bookedSlots = slots.filter(slot => slot.isBooked);
    
    if (isToday) {
      const now = new Date();
      now.setSeconds(0, 0);
      const availableToday = freeSlots.filter(slot => {
        const [slotHour, slotMinute] = slot.time.split(':').map(Number);
        const slotDateTime = new Date(year, month - 1, day, slotHour, slotMinute, 0, 0);
        return slotDateTime.getTime() >= now.getTime();
      });
      // Если нет свободных будущих слотов, но есть занятые — показываем как занято
      if (availableToday.length === 0 && bookedSlots.length === 0) return 'past-today';
      if (availableToday.length === 0 && bookedSlots.length > 0) return 'fully-booked';
    }
    
    // Считаем только НЕ прошедшие свободные слоты для статуса
    const activeFreeSlots = freeSlots.filter(slot => !slot.isPast);
    
    // Если есть занятые слоты, показываем как частично занятый
    if (bookedSlots.length > 0 && activeFreeSlots.length > 0) {
      return 'partially-booked';
    }
    
    // Если все слоты заняты или свободные прошли
    if (bookedSlots.length > 0 && activeFreeSlots.length === 0) {
      return 'fully-booked';
    }
    
    // Если есть только свободные слоты
    return 'available';
  };

  const getDayStatus = (year, month, day) => {
    // Если режим всех врачей, используем другую функцию
    if (showAllDoctorsMode) {
      return getDayStatusAllDoctors(year, month, day);
    }
    
    const schedule = getDaySchedule(year, month, day);
    if (schedule.length === 0) return 'no-schedule';

    const dateStr = formatDate(year, month, day);
    // Фильтруем только активные записи (не отмененные)
    // Нормализуем формат даты для сравнения
    const dayAppointments = appointments.filter(apt => {
      if (!apt.appointment_date || apt.status === 'cancelled') return false;
      
      // Нормализуем формат даты записи
      const normalizedDate = normalizeDateString(apt.appointment_date);
      
      // Проверяем, начинается ли с нужной даты
      return normalizedDate.startsWith(dateStr);
    });

    // Проверяем, является ли день сегодняшним
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(year, month - 1, day);
    checkDate.setHours(0, 0, 0, 0);
    const isToday = checkDate.getTime() === today.getTime();
    const now = new Date();
    now.setSeconds(0, 0);
    now.setMilliseconds(0);

    // Собираем все доступные (не прошедшие) слоты и проверяем, какие заняты
    const availableSlots = [];
    const bookedSlots = [];
    
    schedule.forEach(s => {
      const times = generateTimeSlots(s.start_time, s.end_time);
      times.forEach(time => {
        const [slotHour, slotMinute] = time.split(':').map(Number);
        const slotDateTime = new Date(year, month - 1, day, slotHour, slotMinute, 0, 0);
        slotDateTime.setSeconds(0, 0);
        slotDateTime.setMilliseconds(0);
        
        // Для прошедших дней или прошедших слотов сегодня - не учитываем
        const isPastSlot = isToday ? (slotDateTime.getTime() < now.getTime()) : (checkDate < today);
        
        if (!isPastSlot) {
          // Проверяем, занят ли слот
          const isBooked = dayAppointments.some(apt => {
            const aptTime = parseTime(apt.appointment_date);
            return aptTime.hours === slotHour && aptTime.minutes === slotMinute;
          });
          
          if (isBooked) {
            bookedSlots.push(time);
          } else {
            availableSlots.push(time);
          }
        }
      });
    });
    
    // Если все доступные слоты прошли (для сегодняшнего дня)
    if (isToday && availableSlots.length === 0 && bookedSlots.length === 0) {
      return 'past-today';
    }
    
    // Определяем статус на основе доступных слотов
    const totalAvailableSlots = availableSlots.length + bookedSlots.length;
    
    if (totalAvailableSlots === 0) {
      // Если нет доступных слотов (прошедший день)
      return 'past-today';
    }
    
    if (availableSlots.length === 0) {
      // Все доступные слоты заняты
      return 'fully-booked';
    }
    
    if (bookedSlots.length === 0) {
      // Нет занятых слотов
      return 'available';
    }
    
    // Есть и свободные, и занятые слоты
    return 'partially-booked';
  };

  // Генерация слотов для режима всех врачей
  const generateDaySlotsAllDoctors = (year, month, day, customSlotsData = null) => {
    const dateStr = formatDate(year, month, day);
    // Используем переданные данные или данные из состояния
    const slotsData = customSlotsData || allDoctorsSlots;
    const slots = slotsData[dateStr] || [];
    
    // Определяем количество уникальных врачей
    const uniqueDoctors = new Set(slots.map(slot => slot.doctor.id));
    const doctorsCount = uniqueDoctors.size;
    
    // Преобразуем в формат, совместимый с generateDaySlots
    // Сохраняем информацию о занятости слотов
    const formattedSlots = slots.map(slot => {
      const [slotHour, slotMinute] = slot.time.split(':').map(Number);
      const slotDateTime = new Date(year, month - 1, day, slotHour, slotMinute, 0, 0);
      const now = new Date();
      now.setSeconds(0, 0);
      const isPast = slotDateTime.getTime() < now.getTime();
      
      return {
        time: slot.time,
        isBooked: slot.isBooked || false,
        isPast: isPast,
        doctor: slot.doctor,
        appointment: slot.appointment || null,
        isAppointmentStart: slot.isAppointmentStart || false,
        scheduleBlock: slot.scheduleBlock,
        isFirstInBlock: slot.isFirstInBlock,
        scheduleStart: slot.scheduleStart,
        scheduleEnd: slot.scheduleEnd
      };
    });
    
    // Если один врач, получаем его данные
    let singleDoctor = null;
    if (doctorsCount === 1 && slots.length > 0) {
      singleDoctor = slots[0].doctor;
    }
    
    return { 
      year, 
      month, 
      day, 
      dateStr, 
      slots: formattedSlots, 
      allDoctorsMode: true,
      doctorsCount,
      singleDoctor
    };
  };

  const generateDaySlots = (year, month, day) => {
    // Если режим всех врачей, используем другую функцию
    // Но если уже выбран один врач (автоматически), используем обычный формат
    if (showAllDoctorsMode && !selectedDoctor) {
      return generateDaySlotsAllDoctors(year, month, day);
    }
    
    // Если в режиме всех врачей, но врач уже выбран, используем обычный формат
    if (showAllDoctorsMode && selectedDoctor) {
      // Используем обычный формат, но сохраняем информацию о режиме
      const schedule = getDaySchedule(year, month, day);
      const dateStr = formatDate(year, month, day);
      const dayAppointments = appointments.filter(apt => {
        if (!apt.appointment_date || apt.status === 'cancelled') return false;
        const normalizedDate = normalizeDateString(apt.appointment_date);
        return normalizedDate.startsWith(dateStr);
      });

      const allSlots = [];
      schedule.forEach(s => {
        const times = generateTimeSlots(s.start_time, s.end_time);
        times.forEach(time => {
          const [slotHour, slotMinute] = time.split(':').map(Number);
          
          // Проверяем занятость с учетом duration записей
          const blockCheck = isSlotBlockedByAppointment(time, dayAppointments);
          const isBooked = blockCheck.blocked;

          const slotDateTime = new Date(year, month - 1, day, slotHour, slotMinute, 0, 0);
          const now = new Date();
          now.setSeconds(0, 0);
          const isPast = slotDateTime.getTime() < now.getTime();

          allSlots.push({
            time,
            isBooked,
            isPast,
            appointment: blockCheck.appointment,
            isAppointmentStart: blockCheck.isAppointmentStart
          });
        });
      });

      return { year, month, day, dateStr, slots: allSlots, allDoctorsMode: true, singleDoctorMode: true };
    }
    
    const schedule = getDaySchedule(year, month, day);
    const dateStr = formatDate(year, month, day);
    // Фильтруем только активные записи (не отмененные)
    // Нормализуем формат даты для сравнения (убираем 'T', timezone и т.д.)
    const dayAppointments = appointments.filter(apt => {
      if (!apt.appointment_date || apt.status === 'cancelled') return false;
      
      // Используем функцию normalizeDateString для единообразной нормализации
      const normalizedDate = normalizeDateString(apt.appointment_date);
      
      // Проверяем, начинается ли с нужной даты
      return normalizedDate.startsWith(dateStr);
    });

    // Сортируем расписание по времени начала
    const sortedSchedule = [...schedule].sort((a, b) => {
      const [aH, aM] = a.start_time.split(':').map(Number);
      const [bH, bM] = b.start_time.split(':').map(Number);
      return (aH * 60 + aM) - (bH * 60 + bM);
    });

    // Собираем все слоты с информацией о блоках расписания
    const allSlots = [];
    sortedSchedule.forEach((s, scheduleIndex) => {
      const times = generateTimeSlots(s.start_time, s.end_time);
      times.forEach((time, timeIndex) => {
        const [slotHour, slotMinute] = time.split(':').map(Number);
        
        // Проверяем занятость с учетом duration записей
        const blockCheck = isSlotBlockedByAppointment(time, dayAppointments);
        const isBooked = blockCheck.blocked;

        // Проверяем, является ли слот прошедшим
        const slotDateTime = new Date(year, month - 1, day, slotHour, slotMinute, 0, 0);
        const now = new Date();
        // Сравниваем с точностью до минуты
        now.setSeconds(0, 0);
        const isPast = slotDateTime.getTime() < now.getTime();

        allSlots.push({
          time,
          isBooked,
          isPast,
          appointment: blockCheck.appointment,
          isAppointmentStart: blockCheck.isAppointmentStart,
          scheduleBlock: scheduleIndex,
          isFirstInBlock: timeIndex === 0,
          scheduleStart: s.start_time,
          scheduleEnd: s.end_time
        });
      });
    });

    return { year, month, day, dateStr, slots: allSlots, hasMultipleSchedules: sortedSchedule.length > 1 };
  };

  const handleDayClick = async (year, month, day, skipScheduleCheck = false) => {
    let daySlots;

    // Для режима всех врачей проверяем наличие слотов
    if (showAllDoctorsMode) {
      const dateStr = formatDate(year, month, day);
      const slots = allDoctorsSlots[dateStr] || [];
      if (slots.length === 0) {
        if (toast) toast.warning('На этот день нет свободных слотов');
        return;
      }
      
      // Если только один врач работает в этот день, автоматически выбираем его
      const uniqueDoctors = new Set(slots.map(slot => slot.doctor.id));
      if (uniqueDoctors.size === 1 && slots.length > 0) {
        const singleDoctor = slots[0].doctor;
        setSelectedDoctor(singleDoctor);
        
        // Загружаем расписание выбранного врача
        try {
          const [schedulesRes, datesRes] = await Promise.all([
            axios.get(`${API_URL}/schedules?doctor_id=${singleDoctor.id}`),
            axios.get(`${API_URL}/specific-dates?doctor_id=${singleDoctor.id}`)
          ]);
          setSchedules(schedulesRes.data);
          setSpecificDates(datesRes.data);
          
          // Загружаем записи
          const appointmentsRes = await axios.get(
            `${API_URL}/doctors/${singleDoctor.id}/monthly-appointments?month=${month}&year=${year}`
          );
          setAppointments(appointmentsRes.data.filter(apt => apt.status !== 'cancelled'));
        } catch (error) {
          console.error('Ошибка загрузки данных врача:', error);
        }
      } else {
        // Несколько врачей: сбрасываем selectedDoctor и берём слоты из allDoctorsSlots.
        // setSelectedDoctor(null) не успеет примениться до generateDaySlots, поэтому
        // вызываем generateDaySlotsAllDoctors напрямую.
        setSelectedDoctor(null);
        daySlots = generateDaySlotsAllDoctors(year, month, day);
      }
    } else {
      const schedule = getDaySchedule(year, month, day);
      if (!skipScheduleCheck && schedule.length === 0) {
        if (toast) toast.warning('На этот день нет расписания');
        return;
      }
    }

    if (daySlots === undefined) {
      daySlots = generateDaySlots(year, month, day);
    }
    setSelectedSlot(daySlots);
    setSelectedTime(null); // Сбрасываем выбранное время при открытии
    setSelectedEndTime(null);
    setDuration(30);
    setManualTimeMode(false);
    setManualStartTime('');
    setManualEndTime('');
    setSelectedSlotDoctor(null); // Сбрасываем врача слота при открытии (режим нескольких врачей)
    setShowDayAppointmentsTable(false);
    setShowModal(true);
  };

  // Открытие модалки для быстрой записи из списка слотов
  const openQuickBooking = async (slot) => {
    setSelectedDoctor(slot.doctor);
    setCurrentYear(slot.year);
    setCurrentMonth(slot.month);
    
    // Ждем загрузки расписания
    try {
      const [schedulesRes, datesRes] = await Promise.all([
        axios.get(`${API_URL}/schedules?doctor_id=${slot.doctor.id}`),
        axios.get(`${API_URL}/specific-dates?doctor_id=${slot.doctor.id}`)
      ]);
      
      // Обновляем расписание для выбранного врача
      setSchedules(schedulesRes.data);
      setSpecificDates(datesRes.data);
      
      // Загружаем записи
      const appointmentsRes = await axios.get(
        `${API_URL}/doctors/${slot.doctor.id}/monthly-appointments?month=${slot.month}&year=${slot.year}`
      );
      setAppointments(appointmentsRes.data.filter(apt => apt.status !== 'cancelled'));
      
      // Открываем модалку без проверки расписания
      const daySlots = generateDaySlots(slot.year, slot.month, slot.day);
      setSelectedSlot(daySlots);
      setSelectedTime(slot.time);
      setShowModal(true);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      if (toast) toast.error('Ошибка загрузки данных врача');
    }
  };

  const handleSlotClick = (time, slot, isShiftClick = false) => {
    if (slot.isBooked) {
      // Проверяем, оплачена ли запись - такие записи нельзя отменять
      const isPaid = slot.appointment.paid === true || 
                     slot.appointment.paid === 1 || 
                     slot.appointment.status === 'completed';
      
      if (isPaid) {
        // Показываем информационное сообщение - запись оплачена
        const clientName = slot.appointment.client_last_name && slot.appointment.client_first_name
          ? `${slot.appointment.client_last_name} ${slot.appointment.client_first_name}`
          : 'Клиент';
        
        if (toast) {
          toast.info(`Визит оплачен и завершён.\n\nКлиент: ${clientName}`);
        } else {
          alert(`Визит оплачен и завершён.\n\nКлиент: ${clientName}\n\nОтмена оплаченных записей невозможна.`);
        }
        return;
      }
      
      // Отмена записи (только для неоплаченных)
      const clientName = slot.appointment.client_last_name && slot.appointment.client_first_name
        ? `${slot.appointment.client_last_name} ${slot.appointment.client_first_name}`
        : 'Клиент';
      const appointmentDuration = slot.appointment.duration || 30;
      const endTimeStr = minutesToTime(timeToMinutes(time) + appointmentDuration);
      const confirmMessage = `Отменить запись на ${time} - ${endTimeStr} (${appointmentDuration} мин)?\n\nКлиент: ${clientName}\nТелефон: ${slot.appointment.client_phone || 'не указан'}`;
      
      if (showConfirm) {
        showConfirm({
          title: 'Отмена записи',
          message: confirmMessage,
          confirmText: 'Да, отменить',
          cancelText: 'Нет',
          confirmButtonClass: 'btn-danger',
          onConfirm: () => {
            cancelAppointment(slot.appointment.id);
          }
        });
      } else if (window.confirm(confirmMessage)) {
        cancelAppointment(slot.appointment.id);
      }
      return;
    }
    
    // Отключаем ручной режим при клике на слот
    setManualTimeMode(false);
    
    // В режиме нескольких врачей просто сохраняем выбранный слот, не переключая режим
    if (slot.doctor && selectedSlot?.allDoctorsMode && selectedSlot?.doctorsCount > 1) {
      setSelectedSlotDoctor(slot.doctor);
      // Если уже выбран начальный слот и это shift-клик или второй клик, выбираем конечный слот
      if (selectedTime && (isShiftClick || selectedEndTime === null)) {
        const startMinutes = timeToMinutes(selectedTime);
        const clickedMinutes = timeToMinutes(time);
        
        if (clickedMinutes > startMinutes) {
          // Клик после начала - это конец диапазона
          setSelectedEndTime(time);
          const newDuration = clickedMinutes - startMinutes + 30; // +30 чтобы включить конечный слот
          setDuration(newDuration);
        } else if (clickedMinutes < startMinutes) {
          // Клик до начала - меняем местами: кликнутое время становится началом
          setSelectedEndTime(selectedTime);
          setSelectedTime(time);
          const newDuration = startMinutes - clickedMinutes + 30;
          setDuration(newDuration);
        } else {
          // Клик на то же время - сбрасываем конец
          setSelectedEndTime(null);
          setDuration(30);
        }
      } else {
        // Первый клик - начало
        setSelectedTime(time);
        setSelectedEndTime(null);
        setDuration(30);
      }
      return;
    }
    
    // В режиме всех врачей с одним врачом или обычном режиме сохраняем выбранного врача
    if (slot.doctor && showAllDoctorsMode && selectedSlot?.doctorsCount === 1) {
      setSelectedDoctor(slot.doctor);
      // Загружаем расписание выбранного врача
      const loadDoctorData = async () => {
        try {
          const [schedulesRes, datesRes] = await Promise.all([
            axios.get(`${API_URL}/schedules?doctor_id=${slot.doctor.id}`),
            axios.get(`${API_URL}/specific-dates?doctor_id=${slot.doctor.id}`)
          ]);
          setSchedules(schedulesRes.data);
          setSpecificDates(datesRes.data);
        } catch (error) {
          console.error('Ошибка загрузки расписания:', error);
        }
      };
      loadDoctorData();
    }
    
    // Логика выбора диапазона слотов
    // Если уже выбран начальный слот и кликнули на другой - это конец диапазона
    if (selectedTime && time !== selectedTime && (isShiftClick || selectedEndTime === null)) {
      const startMinutes = timeToMinutes(selectedTime);
      const clickedMinutes = timeToMinutes(time);
      
      if (clickedMinutes > startMinutes) {
        // Клик после начала - это конец диапазона
        setSelectedEndTime(time);
        const newDuration = clickedMinutes - startMinutes + 30; // +30 чтобы включить конечный слот
        setDuration(newDuration);
      } else if (clickedMinutes < startMinutes) {
        // Клик до начала - меняем местами
        setSelectedEndTime(selectedTime);
        setSelectedTime(time);
        const newDuration = startMinutes - clickedMinutes + 30;
        setDuration(newDuration);
      }
    } else if (selectedTime === time && selectedEndTime) {
      // Клик на начальный слот когда уже выбран диапазон - сбрасываем
      setSelectedEndTime(null);
      setDuration(30);
    } else {
      // Первый клик или клик на новый слот - начало
      setSelectedTime(time);
      setSelectedEndTime(null);
      setDuration(30);
    }
  };

  const handleCreateAppointment = () => {
    if (!selectedClient) {
      if (toast) toast.warning('Сначала выберите клиента');
      return;
    }
    
    // Определяем время начала (из слота или ручного ввода)
    let startTime = selectedTime;
    let appointmentDuration = duration;
    
    if (manualTimeMode) {
      if (!manualStartTime || !manualEndTime) {
        if (toast) toast.warning('Укажите время начала и окончания');
        return;
      }
      startTime = manualStartTime;
      appointmentDuration = calculateDuration(manualStartTime, manualEndTime);
      if (appointmentDuration <= 0) {
        if (toast) toast.warning('Время окончания должно быть позже времени начала');
        return;
      }
    } else if (!startTime) {
      if (toast) toast.warning('Выберите время');
      return;
    }
    
    // В режиме нескольких врачей проверяем, что выбран врач
    if (selectedSlot?.allDoctorsMode && selectedSlot?.doctorsCount > 1 && !selectedSlotDoctor) {
      if (toast) toast.warning('Выберите время и врача');
      return;
    }

    // Парсим время, убеждаясь что минуты не теряются
    const timeParts = startTime.split(':');
    const hours = parseInt(timeParts[0], 10) || 0;
    const minutes = parseInt(timeParts[1], 10) || 0;
    
    const dateTime = formatDateTime(selectedSlot.year, selectedSlot.month, selectedSlot.day, hours, minutes);
    
    createAppointment(dateTime, appointmentDuration);
  };

  const cancelAppointment = async (appointmentId) => {
    try {
      await axios.patch(`${API_URL}/appointments/${appointmentId}/status`, {
        status: 'cancelled'
      });
      
      // Сбрасываем выбранное время
      setSelectedTime(null);
      setSelectedEndTime(null);
      setDuration(30);
      setSelectedSlotDoctor(null);
      
      // Загружаем обновленные записи
      let updatedSlotsData = null;
      if (showAllDoctorsMode) {
        // В режиме всех врачей перезагружаем данные всех врачей
        updatedSlotsData = await loadAllDoctorsData();
      } else {
        await loadAppointments();
      }
      
      // Отправляем событие для обновления таблицы записей в App.js
      window.dispatchEvent(new Event('appointmentCreated'));
      
      // Обновляем модалку для перерисовки слотов после обновления данных
      if (selectedSlot) {
        if (showAllDoctorsMode && updatedSlotsData) {
          // Для режима всех врачей используем обновленные данные напрямую
          // Создаем временную функцию генерации слотов с переданными данными
          const generateSlotsWithData = (year, month, day) => {
            const dateStr = formatDate(year, month, day);
            const slots = updatedSlotsData[dateStr] || [];
            
            const uniqueDoctors = new Set(slots.map(slot => slot.doctor.id));
            const doctorsCount = uniqueDoctors.size;
            
            const formattedSlots = slots.map(slot => {
              const [slotHour, slotMinute] = slot.time.split(':').map(Number);
              const slotDateTime = new Date(year, month - 1, day, slotHour, slotMinute, 0, 0);
              const now = new Date();
              now.setSeconds(0, 0);
              const isPast = slotDateTime.getTime() < now.getTime();
              
              return {
                time: slot.time,
                isBooked: slot.isBooked || false,
                isPast: isPast,
                doctor: slot.doctor,
                appointment: slot.appointment || null,
                isAppointmentStart: slot.isAppointmentStart || false,
                scheduleBlock: slot.scheduleBlock,
                isFirstInBlock: slot.isFirstInBlock,
                scheduleStart: slot.scheduleStart,
                scheduleEnd: slot.scheduleEnd
              };
            });
            
            let singleDoctor = null;
            if (doctorsCount === 1 && slots.length > 0) {
              singleDoctor = slots[0].doctor;
            }
            
            return { 
              year, 
              month, 
              day, 
              dateStr, 
              slots: formattedSlots, 
              allDoctorsMode: true,
              doctorsCount,
              singleDoctor
            };
          };
          
          // Немедленно обновляем слоты с актуальными данными
          const updatedSlots = generateSlotsWithData(selectedSlot.year, selectedSlot.month, selectedSlot.day);
          setSelectedSlot(updatedSlots);
          setModalUpdateKey(prev => prev + 1);
        } else {
          // Для обычного режима используем стандартную генерацию с задержкой
          setTimeout(() => {
            const updatedSlots = generateDaySlots(selectedSlot.year, selectedSlot.month, selectedSlot.day);
            setSelectedSlot(updatedSlots);
            setModalUpdateKey(prev => prev + 1);
          }, 100);
        }
      }
      
      if (toast) toast.success('✅ Запись отменена');
    } catch (error) {
      console.error('Ошибка отмены записи:', error);
      if (toast) toast.error(`${error.response?.data?.error || error.message}`);
    }
  };

  const createNewClient = async () => {
    if (!newClientForm.lastName || !newClientForm.firstName || !newClientForm.phone) {
      if (toast) toast.warning('Заполните обязательные поля: Фамилия, Имя, Телефон');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/clients`, newClientForm);
      const newClient = response.data;
      
      // Обновляем список клиентов
      await loadClients();
      
      // Выбираем нового клиента
      setSelectedClient(newClient);
      setClientSearch(`${newClient.lastName} ${newClient.firstName}`);
      
      // Закрываем модалку создания клиента
      setShowCreateClientModal(false);
      setNewClientForm({ lastName: '', firstName: '', middleName: '', phone: '', date_of_birth: '', passport_number: '', citizenship_data: '', population_type: 'city' });
      
      if (toast) toast.success('✅ Клиент успешно создан!');
    } catch (error) {
      console.error('Ошибка создания клиента:', error);
      if (toast) toast.error(`${error.response?.data?.error || error.message}`);
    }
  };

  const createAppointment = async (dateTime, appointmentDuration = 30) => {
    // Защита от двойного вызова
    if (creating) {
      return;
    }
    
    setCreating(true);
    try {
      // Если редактируем существующую запись
      if (editingAppointmentId) {
        await axios.put(`${API_URL}/appointments/${editingAppointmentId}`, {
          client_id: selectedClient.id,
          doctor_id: selectedDoctor.id,
          appointment_date: dateTime,
          services: selectedServices,
          notes: notes,
          duration: appointmentDuration
        });
      } else {
        // Определяем врача для записи
        const doctorForAppointment = selectedSlotDoctor || selectedDoctor;
        
        // Создаем новую запись
        const newAppointment = await axios.post(`${API_URL}/appointments`, {
          client_id: selectedClient.id,
          doctor_id: doctorForAppointment.id,
          appointment_date: dateTime,
          services: selectedServices,
          notes: notes,
          duration: appointmentDuration
        });
        
        // Немедленно помечаем слот как занятый в selectedSlot (для режима всех врачей)
        if (showAllDoctorsMode && selectedSlot && selectedSlot.slots) {
          // Извлекаем время из dateTime (формат: "YYYY-MM-DD HH:MM:SS")
          const appointmentTime = parseTime(dateTime);
          const hours = appointmentTime.hours;
          const minutes = appointmentTime.minutes;
          
          const updatedSlots = selectedSlot.slots.map(slot => {
            const [slotHour, slotMinute] = slot.time.split(':').map(Number);
            const slotDoctor = slot.doctor || selectedSlotDoctor;
            
            // Помечаем слот как занятый, если время и врач совпадают
            if (slotHour === hours && slotMinute === minutes && 
                slotDoctor && slotDoctor.id === doctorForAppointment.id) {
              return {
                ...slot,
                isBooked: true,
                appointment: newAppointment.data
              };
            }
            return slot;
          });
          
          // Обновляем selectedSlot немедленно
          setSelectedSlot({
            ...selectedSlot,
            slots: updatedSlots
          });
          setModalUpdateKey(prev => prev + 1);
        }
      }

      // Сначала загружаем обновленные записи
      let updatedSlotsData = null;
      if (showAllDoctorsMode) {
        // В режиме всех врачей перезагружаем данные всех врачей
        // Небольшая задержка для гарантии, что API обновился
        await new Promise(resolve => setTimeout(resolve, 100));
        updatedSlotsData = await loadAllDoctorsData();
      } else {
        await loadAppointments();
      }
      
      // Отправляем событие для обновления таблицы записей в App.js
      // (App.js сам вызовет loadData, поэтому не нужно дублировать)
      window.dispatchEvent(new Event('appointmentCreated'));
      
      // Если редактировали, закрываем модалку и вызываем callback
      if (editingAppointmentId) {
        setShowModal(false);
        resetForm();
        setEditingAppointmentId(null);
        if (onEditComplete) {
          onEditComplete();
        }
        if (toast) toast.success('✅ Запись успешно обновлена!');
      } else {
        // Сбрасываем только выбранное время и форму, но НЕ закрываем модалку
        // Это позволяет сразу записать еще одного клиента
        setSelectedTime(null);
        setSelectedEndTime(null);
        setDuration(30);
        setManualTimeMode(false);
        setManualStartTime('');
        setManualEndTime('');
        setSelectedSlotDoctor(null);
        setSelectedClient(null);
        setClientSearch('');
        setSelectedServices([]);
        setNotes('');
        if (toast) toast.success('✅ Запись успешно создана!');
        
        // Обновляем модалку для перерисовки слотов после обновления данных
        if (selectedSlot) {
          if (showAllDoctorsMode && updatedSlotsData) {
            // Для режима всех врачей используем обновленные данные напрямую
            // Создаем временную функцию генерации слотов с переданными данными
            const generateSlotsWithData = (year, month, day) => {
              const dateStr = formatDate(year, month, day);
              const slots = updatedSlotsData[dateStr] || [];
              
              const uniqueDoctors = new Set(slots.map(slot => slot.doctor.id));
              const doctorsCount = uniqueDoctors.size;
              
              const formattedSlots = slots.map(slot => {
                const [slotHour, slotMinute] = slot.time.split(':').map(Number);
                const slotDateTime = new Date(year, month - 1, day, slotHour, slotMinute, 0, 0);
                const now = new Date();
                now.setSeconds(0, 0);
                const isPast = slotDateTime.getTime() < now.getTime();
                
                return {
                  time: slot.time,
                  isBooked: slot.isBooked || false,
                  isPast: isPast,
                  doctor: slot.doctor,
                  appointment: slot.appointment || null,
                  isAppointmentStart: slot.isAppointmentStart || false,
                  scheduleBlock: slot.scheduleBlock,
                  isFirstInBlock: slot.isFirstInBlock,
                  scheduleStart: slot.scheduleStart,
                  scheduleEnd: slot.scheduleEnd
                };
              });
              
              let singleDoctor = null;
              if (doctorsCount === 1 && slots.length > 0) {
                singleDoctor = slots[0].doctor;
              }
              
              return { 
                year, 
                month, 
                day, 
                dateStr, 
                slots: formattedSlots, 
                allDoctorsMode: true,
                doctorsCount,
                singleDoctor
              };
            };
            
            // Немедленно обновляем слоты с актуальными данными
            const updatedSlots = generateSlotsWithData(selectedSlot.year, selectedSlot.month, selectedSlot.day);
            // Обновляем selectedSlot и принудительно обновляем модалку
            setSelectedSlot(updatedSlots);
            // Обновляем modalUpdateKey для принудительной перерисовки модалки
            setModalUpdateKey(prev => prev + 1);
          } else {
            // Для обычного режима используем стандартную генерацию с задержкой
            setTimeout(() => {
              const updatedSlots = generateDaySlots(selectedSlot.year, selectedSlot.month, selectedSlot.day);
              setSelectedSlot(updatedSlots);
              setModalUpdateKey(prev => prev + 1);
            }, 100);
          }
        }
      }
    } catch (error) {
      console.error('Ошибка создания/обновления записи:', error);
      if (toast) toast.error(`${error.response?.data?.error || error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setClientSearch('');
    setSelectedClient(null);
    setSelectedServices([]);
    setNotes('');
    setSelectedTime(null);
    setSelectedEndTime(null);
    setDuration(30);
    setManualTimeMode(false);
    setManualStartTime('');
    setManualEndTime('');
    setSelectedSlot(null);
    setSelectedSlotDoctor(null);
    setEditingAppointmentId(null);
  };

  const renderCalendar = () => {
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const firstDayOfWeek = (new Date(currentYear, currentMonth - 1, 1).getDay() + 6) % 7;
    
    const days = [];
    
    // Пустые ячейки до первого дня (неделя начинается с понедельника)
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day-booking empty" />);
    }
    
    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const status = getDayStatus(currentYear, currentMonth, day);
      const isToday = new Date().getDate() === day && 
                     new Date().getMonth() + 1 === currentMonth && 
                     new Date().getFullYear() === currentYear;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkDate = new Date(currentYear, currentMonth - 1, day);
      checkDate.setHours(0, 0, 0, 0);
      const isPast = checkDate < today;
      
      // Получаем список врачей для этого дня (в режиме всех врачей)
      let dayDoctors = [];
      if (showAllDoctorsMode && status !== 'no-schedule' && status !== 'past-today') {
        const dateStr = formatDate(currentYear, currentMonth, day);
        const slots = allDoctorsSlots[dateStr] || [];
        const uniqueDoctors = new Map();
        slots.forEach(slot => {
          if (!uniqueDoctors.has(slot.doctor.id)) {
            uniqueDoctors.set(slot.doctor.id, slot.doctor);
          }
        });
        dayDoctors = Array.from(uniqueDoctors.values());
      }
      
      days.push(
        <div
          key={day}
          className={`calendar-day-booking ${status} ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${status === 'past-today' ? 'past-today' : ''}`}
          onClick={() => status !== 'no-schedule' && status !== 'past-today' && handleDayClick(currentYear, currentMonth, day)}
        >
          <div className="day-number">{day}</div>
          {status === 'past-today' && <div className="availability-badge">Запись невозможна</div>}
          {status === 'available' && <div className="availability-badge">Свободно</div>}
          {status === 'partially-booked' && <div className="availability-badge partial">Есть места</div>}
          {status === 'fully-booked' && <div className="availability-badge full">Занято</div>}
          {showAllDoctorsMode && dayDoctors.length > 0 && (
            <div style={{ 
              fontSize: '0.7rem', 
              color: '#667eea', 
              marginTop: '4px',
              fontWeight: '600',
              textAlign: 'center',
              lineHeight: '1.2'
            }}>
              {dayDoctors.map(d => d.lastName).join(', ')}
            </div>
          )}
        </div>
      );
    }
    
    return days;
  };

  const filteredClients = clients.filter(c => {
    const search = clientSearch.toLowerCase();
    const fullName = `${c.lastName} ${c.firstName} ${c.middleName || ''}`.toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    return fullName.includes(search) || phone.includes(search);
  });

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div className="booking-calendar-container">
      <div className="booking-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '2px solid #e0e0e0'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#333', fontWeight: '600' }}>📅 Календарь записи</h2>
        <button 
          className="btn" 
          onClick={onBack}
          style={{
            padding: '10px 20px',
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = '#e8e8e8'}
          onMouseOut={(e) => e.target.style.background = '#f5f5f5'}
        >
          ← Назад
        </button>
      </div>

      {/* Выбор врача карточками */}
      {!showAllDoctorsMode && !selectedDoctor && (
      <div style={{ marginBottom: '30px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '15px'
        }}>
          <label style={{ 
            fontSize: '1.1rem', 
            fontWeight: '600', 
            color: '#333',
            margin: 0
          }}>
            Выберите врача:
          </label>
          <button
            onClick={() => {
              setShowAllDoctorsMode(true);
              setSelectedDoctor(null);
            }}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
            }}
          >
            📅 Все записи
          </button>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '20px'
        }}>
          {doctors.map(doctor => (
            <div
              key={doctor.id}
              onClick={() => setSelectedDoctor(doctor)}
              style={{
                padding: '20px',
                background: selectedDoctor?.id === doctor.id 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                  : 'white',
                color: selectedDoctor?.id === doctor.id ? 'white' : '#333',
                borderRadius: '12px',
                border: selectedDoctor?.id === doctor.id 
                  ? '2px solid #667eea' 
                  : '2px solid #e0e0e0',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: selectedDoctor?.id === doctor.id 
                  ? '0 4px 15px rgba(102, 126, 234, 0.4)' 
                  : '0 2px 8px rgba(0, 0, 0, 0.1)',
                transform: selectedDoctor?.id === doctor.id ? 'translateY(-2px)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (selectedDoctor?.id !== doctor.id) {
                  e.currentTarget.style.background = '#f8f9ff';
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedDoctor?.id !== doctor.id) {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#e0e0e0';
                  e.currentTarget.style.transform = 'none';
                }
              }}
            >
              <div style={{ 
                fontSize: '1.5rem', 
                marginBottom: '10px',
                textAlign: 'center'
              }}>
                👨‍⚕️
              </div>
              <div style={{ 
                fontSize: '1rem', 
                fontWeight: '600', 
                marginBottom: '5px',
                textAlign: 'center'
              }}>
                {doctor.lastName} {doctor.firstName}
              </div>
              <div style={{ 
                fontSize: '0.85rem', 
                opacity: 0.9,
                textAlign: 'center'
              }}>
                {doctor.specialization}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Режим всех врачей - календарь */}
      {showAllDoctorsMode && (
        <div style={{ marginBottom: '30px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#333' }}>
              📅 Все доступные записи
            </h3>
            <button
              onClick={() => {
                setShowAllDoctorsMode(false);
                setSelectedDoctor(null);
                setAllDoctorsSlots({});
              }}
              style={{
                padding: '10px 20px',
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#e8e8e8'}
              onMouseLeave={(e) => e.target.style.background = '#f5f5f5'}
            >
              ← Выбрать врача
            </button>
          </div>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Выберите дату для просмотра всех доступных слотов записи от всех врачей
          </p>
        </div>
      )}

      {/* Ближайшие свободные слоты */}
      {!showAllDoctorsMode && (
      <div style={{ marginBottom: '30px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '15px'
        }}>
          <label style={{ 
            fontSize: '1.1rem', 
            fontWeight: '600', 
            color: '#333',
            margin: 0
          }}>
            🕐 Ближайшие свободные записи:
          </label>
          <button
            onClick={() => {
              setShowNearestSlots(!showNearestSlots);
              if (!showNearestSlots && nearestSlots.length === 0) {
                loadNearestSlots();
              }
            }}
            style={{
              padding: '8px 16px',
              background: showNearestSlots ? '#f44336' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
            }}
          >
            {showNearestSlots ? '▲ Скрыть' : '▼ Показать'}
          </button>
        </div>
        {showNearestSlots && (
          <>
            {loadingSlots ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                Загрузка доступных слотов...
              </div>
            ) : nearestSlots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999', background: '#f5f5f5', borderRadius: '8px' }}>
                Нет доступных слотов на ближайшие 30 дней
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '12px'
              }}>
            {nearestSlots.map((slot, idx) => {
              const dateObj = new Date(slot.year, slot.month - 1, slot.day);
              const dayName = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dateObj.getDay()];
              const monthName = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 
                'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'][slot.month - 1];
              
              return (
                <div
                  key={idx}
                  onClick={() => openQuickBooking(slot)}
                  style={{
                    padding: '15px',
                    background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                    borderRadius: '10px',
                    border: '2px solid #4caf50',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#2e7d32' }}>
                      {slot.doctor.lastName} {slot.doctor.firstName}
                    </div>
                    <div style={{ fontSize: '1.2rem' }}>👨‍⚕️</div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '5px' }}>
                    {dayName}, {slot.day} {monthName}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#667eea' }}>
                    ⏰ {slot.time}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#4caf50', marginTop: '5px', fontWeight: '600' }}>
                    ✓ Свободно
                  </div>
                </div>
              );
            })}
              </div>
            )}
          </>
        )}
      </div>
      )}

      {(selectedDoctor || showAllDoctorsMode) && (
        <>
          {/* Навигация календаря */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '25px',
            padding: '15px 20px',
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
          }}>
            <button
              onClick={() => {
                if (currentMonth === 1) {
                  setCurrentMonth(12);
                  setCurrentYear(currentYear - 1);
                } else {
                  setCurrentMonth(currentMonth - 1);
                }
              }}
              style={{
                padding: '12px 24px',
                background: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                color: '#667eea',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#667eea';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.transform = 'translateX(-3px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.color = '#667eea';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              ← Предыдущий
            </button>
            
            <h3 style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#333',
              textTransform: 'capitalize'
            }}>
              {MONTHS[currentMonth - 1]} {currentYear}
            </h3>
            
            <button
              onClick={() => {
                if (currentMonth === 12) {
                  setCurrentMonth(1);
                  setCurrentYear(currentYear + 1);
                } else {
                  setCurrentMonth(currentMonth + 1);
                }
              }}
              style={{
                padding: '12px 24px',
                background: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                color: '#667eea',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#667eea';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.transform = 'translateX(3px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.color = '#667eea';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              Следующий →
            </button>
          </div>

          <div className="booking-calendar-grid" key={`calendar-${appointments.length}-${currentYear}-${currentMonth}`}>
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="calendar-day-header">{day}</div>
            ))}
            {renderCalendar()}
          </div>
        </>
      )}

      {/* Модалка выбора времени и создания записи */}
      {showModal && selectedSlot && (() => {
        // Для режима всех врачей всегда используем слоты из selectedSlot (они обновляются напрямую)
        // Для обычного режима пересчитываем слоты с актуальными данными из состояния
        let actualSlots;
        if (selectedSlot.allDoctorsMode) {
          // Для режима всех врачей используем слоты напрямую из selectedSlot
          // Они уже обновлены с актуальными данными после создания/отмены записи
          actualSlots = selectedSlot;
        } else {
          // Для обычного режима пересчитываем слоты с актуальными данными
          actualSlots = generateDaySlots(selectedSlot.year, selectedSlot.month, selectedSlot.day);
        }
        
        return (
        <div 
          key={`modal-${selectedSlot.year}-${selectedSlot.month}-${selectedSlot.day}-${modalUpdateKey}-${selectedSlot.slots?.length || 0}-${selectedSlot.slots?.filter(s => s.isBooked).length || 0}`}
          className="modal-overlay" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
              resetForm();
          }
        }}>
          <div className="modal" style={{ maxWidth: selectedSlot.allDoctorsMode && selectedSlot.doctorsCount > 1 ? '900px' : '600px' }}>
            <h2>📅 Запись на {selectedSlot.day} {MONTHS[selectedSlot.month - 1]}</h2>
            {selectedSlot.allDoctorsMode ? (
              (selectedSlot.singleDoctorMode && selectedDoctor) ? (
                <p style={{ color: '#667eea', marginBottom: '20px' }}>
                  👨‍⚕️ {selectedDoctor.lastName} {selectedDoctor.firstName}
                </p>
              ) : selectedSlot.doctorsCount === 1 && selectedSlot.singleDoctor ? (
                <p style={{ color: '#667eea', marginBottom: '20px' }}>
                  👨‍⚕️ {selectedSlot.singleDoctor.lastName} {selectedSlot.singleDoctor.firstName}
                </p>
              ) : (
                <p style={{ color: '#666', marginBottom: '20px', fontSize: '0.9rem' }}>
                  Выберите время и врача для записи
                </p>
              )
            ) : (
              <p style={{ color: '#667eea', marginBottom: '20px' }}>
                👨‍⚕️ {selectedDoctor.lastName} {selectedDoctor.firstName}
              </p>
            )}

            {/* Поиск клиента */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ margin: 0 }}>Клиент *</label>
                <button
                  onClick={() => setShowCreateClientModal(true)}
                  style={{
                    padding: '6px 12px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '600'
                  }}
                >
                  + Создать клиента
                </button>
              </div>
              {selectedClient && (
                <div style={{
                  padding: '10px',
                  background: '#e8f5ff',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  border: '2px solid #667eea'
                }}>
                  <div><strong>{selectedClient.lastName} {selectedClient.firstName}</strong></div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>{selectedClient.phone}</div>
                </div>
              )}
              <input
                type="text"
                placeholder="Поиск по ФИО или телефону..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                style={{ width: '100%', marginBottom: '10px' }}
              />
              {clientSearch && !selectedClient && (
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                  {filteredClients.map(c => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedClient(c);
                        setClientSearch(`${c.lastName} ${c.firstName}`);
                      }}
                      style={{
                        padding: '10px',
                        cursor: 'pointer',
                        background: selectedClient?.id === c.id ? '#e8f5ff' : 'white',
                        borderBottom: '1px solid #eee'
                      }}
                    >
                      <div><strong>{c.lastName} {c.firstName}</strong></div>
                      <div style={{ fontSize: '0.9rem', color: '#666' }}>{c.phone}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Примечания */}
            <div style={{ marginBottom: '20px' }}>
              <label>Примечания</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{ width: '100%' }}
              />
            </div>

            {/* Выбор длительности */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontWeight: '600', margin: 0 }}>Длительность записи:</label>
                <button
                  type="button"
                  onClick={() => {
                    setManualTimeMode(!manualTimeMode);
                    if (!manualTimeMode) {
                      setSelectedTime(null);
                      setSelectedEndTime(null);
                    } else {
                      setManualStartTime('');
                      setManualEndTime('');
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    background: manualTimeMode ? '#667eea' : '#f0f0f0',
                    color: manualTimeMode ? 'white' : '#333',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  {manualTimeMode ? '📅 Выбрать слоты' : '✏️ Ввести вручную'}
                </button>
              </div>
              
              {/* Кнопки быстрого выбора длительности */}
              {!manualTimeMode && (
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  flexWrap: 'wrap',
                  marginBottom: '10px'
                }}>
                  {[
                    { label: '30 мин', value: 30 },
                    { label: '1 час', value: 60 },
                    { label: '1.5 часа', value: 90 },
                    { label: '2 часа', value: 120 },
                    { label: '2.5 часа', value: 150 },
                    { label: '3 часа', value: 180 }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setDuration(opt.value);
                        // Если выбрано начальное время, пересчитываем конечное
                        if (selectedTime) {
                          const startMinutes = timeToMinutes(selectedTime);
                          const endMinutes = startMinutes + opt.value;
                          if (endMinutes <= 24 * 60) {
                            setSelectedEndTime(minutesToTime(endMinutes - 30)); // -30 потому что конечный слот включается
                          }
                        }
                      }}
                      style={{
                        padding: '8px 14px',
                        background: duration === opt.value ? '#667eea' : '#f5f5f5',
                        color: duration === opt.value ? 'white' : '#333',
                        border: duration === opt.value ? '2px solid #667eea' : '1px solid #ddd',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: duration === opt.value ? '600' : '400',
                        transition: 'all 0.2s'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Ручной ввод времени */}
              {manualTimeMode && (
                <div style={{ 
                  display: 'flex', 
                  gap: '15px', 
                  alignItems: 'center',
                  background: '#f8f9ff',
                  padding: '15px',
                  borderRadius: '10px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#666' }}>
                      Начало:
                    </label>
                    <input
                      type="time"
                      value={manualStartTime}
                      onChange={(e) => setManualStartTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '1.5rem', color: '#667eea', marginTop: '20px' }}>→</div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#666' }}>
                      Окончание:
                    </label>
                    <input
                      type="time"
                      value={manualEndTime}
                      onChange={(e) => setManualEndTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  {manualStartTime && manualEndTime && (
                    <div style={{ 
                      background: '#e8f5e9', 
                      padding: '10px 15px', 
                      borderRadius: '8px',
                      marginTop: '20px',
                      fontWeight: '600',
                      color: '#388e3c'
                    }}>
                      {calculateDuration(manualStartTime, manualEndTime)} мин
                    </div>
                  )}
                </div>
              )}

              {/* Подсказка для выбора диапазона */}
              {!manualTimeMode && (
                <div style={{ 
                  fontSize: '0.85rem', 
                  color: '#666', 
                  marginTop: '10px',
                  padding: '8px 12px',
                  background: '#fffde7',
                  borderRadius: '6px',
                  border: '1px solid #fff9c4'
                }}>
                  💡 Кликните на начальный слот, затем на конечный для выбора диапазона, или выберите длительность кнопками выше
                </div>
              )}
            </div>

            {/* Слоты времени */}
            <div>
              <h3>Выберите время:</h3>
              {/* Информация о выбранном времени */}
              {(selectedTime || (manualTimeMode && manualStartTime && manualEndTime)) && (
                <div style={{
                  padding: '12px',
                  background: '#e8f5ff',
                  borderRadius: '8px',
                  marginBottom: '15px',
                  border: '2px solid #667eea',
                  textAlign: 'center'
                }}>
                  <div style={{ fontWeight: '600', color: '#667eea', fontSize: '1.1rem' }}>
                    ⏰ {manualTimeMode 
                      ? `${manualStartTime} - ${manualEndTime}` 
                      : selectedEndTime 
                        ? `${selectedTime} - ${minutesToTime(timeToMinutes(selectedEndTime) + 30)}`
                        : `${selectedTime} - ${minutesToTime(timeToMinutes(selectedTime) + duration)}`
                    }
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
                    Длительность: {manualTimeMode 
                      ? calculateDuration(manualStartTime, manualEndTime) 
                      : duration
                    } мин
                  </div>
                </div>
              )}
              {creating && (
                <div style={{ textAlign: 'center', padding: '10px', color: '#667eea', fontWeight: 'bold' }}>
                  ⏳ Создание записи...
                </div>
              )}
              {(() => {
                // Если несколько врачей, группируем слоты по врачам
                const isMultiDoctor = selectedSlot.allDoctorsMode && !selectedSlot.singleDoctorMode && selectedSlot.doctorsCount > 1;
                
                if (isMultiDoctor) {
                  // Группируем слоты по врачам
                  const slotsByDoctor = new Map();
                  actualSlots.slots.forEach(slot => {
                    const doctorId = slot.doctor?.id;
                    if (doctorId) {
                      if (!slotsByDoctor.has(doctorId)) {
                        slotsByDoctor.set(doctorId, {
                          doctor: slot.doctor,
                          slots: []
                        });
                      }
                      slotsByDoctor.get(doctorId).slots.push(slot);
                    }
                  });
                  
                  const doctorsList = Array.from(slotsByDoctor.values());
                  
                  return (
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: `repeat(${doctorsList.length}, 1fr)`,
                      gap: '20px', 
                      marginTop: '15px' 
                    }}>
                      {doctorsList.map((doctorGroup, doctorIdx) => (
                        <div key={doctorGroup.doctor.id} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          border: selectedSlotDoctor?.id === doctorGroup.doctor.id 
                            ? '3px solid #667eea' 
                            : '2px solid #e0e0e0',
                          borderRadius: '12px',
                          padding: '15px',
                          background: selectedSlotDoctor?.id === doctorGroup.doctor.id 
                            ? '#f0f4ff' 
                            : '#fafafa',
                          transition: 'all 0.2s'
                        }}>
                          <div 
                            onClick={() => setSelectedSlotDoctor(doctorGroup.doctor)}
                            style={{
                              textAlign: 'center',
                              marginBottom: '15px',
                              paddingBottom: '10px',
                              borderBottom: selectedSlotDoctor?.id === doctorGroup.doctor.id 
                                ? '3px solid #667eea' 
                                : '2px solid #667eea',
                              cursor: 'pointer',
                              borderRadius: '8px 8px 0 0',
                              padding: '8px',
                              margin: '-15px -15px 15px -15px',
                              background: selectedSlotDoctor?.id === doctorGroup.doctor.id 
                                ? '#667eea' 
                                : 'transparent',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ 
                              fontSize: '1.1rem', 
                              fontWeight: 'bold', 
                              color: selectedSlotDoctor?.id === doctorGroup.doctor.id ? 'white' : '#667eea', 
                              marginBottom: '5px' 
                            }}>
                              👨‍⚕️ {doctorGroup.doctor.lastName}
                            </div>
                            <div style={{ 
                              fontSize: '0.85rem', 
                              color: selectedSlotDoctor?.id === doctorGroup.doctor.id ? 'rgba(255,255,255,0.9)' : '#666' 
                            }}>
                              {doctorGroup.doctor.firstName}
                            </div>
                            {selectedSlotDoctor?.id === doctorGroup.doctor.id && (
                              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>
                                ✓ Выбран
                              </div>
                            )}
                          </div>
                          {(() => {
                            // Группируем слоты по блокам расписания
                            const slotsByBlock = new Map();
                            doctorGroup.slots.forEach(slot => {
                              const blockKey = slot.scheduleBlock !== undefined ? slot.scheduleBlock : 0;
                              if (!slotsByBlock.has(blockKey)) {
                                slotsByBlock.set(blockKey, {
                                  slots: [],
                                  scheduleStart: slot.scheduleStart,
                                  scheduleEnd: slot.scheduleEnd
                                });
                              }
                              slotsByBlock.get(blockKey).slots.push(slot);
                            });
                            
                            const blocks = Array.from(slotsByBlock.entries()).sort((a, b) => a[0] - b[0]);
                            
                            return blocks.map(([blockIndex, blockData], blockIdx) => (
                              <React.Fragment key={`block-${blockIndex}`}>
                                {/* Разделитель между блоками расписания */}
                                {blockIdx > 0 && (
                                  <div style={{
                                    gridColumn: '1 / -1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 0',
                                    margin: '8px 0'
                                  }}>
                                    <div style={{ flex: 1, height: '2px', background: '#ffb74d' }}></div>
                                    <span style={{ 
                                      fontSize: '0.75rem', 
                                      color: '#f57c00', 
                                      fontWeight: '600',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      ☕ Перерыв
                                    </span>
                                    <div style={{ flex: 1, height: '2px', background: '#ffb74d' }}></div>
                                  </div>
                                )}
                                {/* Заголовок блока с временем */}
                                {blocks.length > 1 && blockData.scheduleStart && (
                                  <div style={{
                                    gridColumn: '1 / -1',
                                    fontSize: '0.8rem',
                                    color: '#667eea',
                                    fontWeight: '600',
                                    textAlign: 'center',
                                    padding: '4px',
                                    background: '#f0f4ff',
                                    borderRadius: '6px',
                                    marginBottom: '4px'
                                  }}>
                                    🕐 {blockData.scheduleStart} - {blockData.scheduleEnd}
                                  </div>
                                )}
                                {/* Слоты в сетке */}
                                <div style={{
                                  gridColumn: '1 / -1',
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(2, 1fr)',
                                  gap: '8px'
                                }}>
                                  {(() => {
                                    // Группируем слоты: свободные отдельно, занятые одной записи - в один блок
                                    const renderedAppointments = new Set();
                                    
                                    return blockData.slots.map((slot, slotIdx) => {
                                      const [slotHour, slotMinute] = slot.time.split(':').map(Number);
                                      const slotDateTime = new Date(actualSlots.year, actualSlots.month - 1, actualSlots.day, slotHour, slotMinute, 0, 0);
                                      const now = new Date();
                                      now.setSeconds(0, 0);
                                      now.setMilliseconds(0);
                                      slotDateTime.setSeconds(0, 0);
                                      slotDateTime.setMilliseconds(0);
                                      const isPast = slotDateTime.getTime() < now.getTime() || slot.isPast;
                                      
                                      // Проверяем принадлежность к выбранному врачу
                                      const isThisDoctorSelected = selectedSlotDoctor && 
                                                                  selectedSlotDoctor.id === slot.doctor?.id;
                                      
                                      // Проверяем, входит ли слот в выбранный диапазон (только для выбранного врача)
                                      const slotMinutes = timeToMinutes(slot.time);
                                      const startMinutes = selectedTime ? timeToMinutes(selectedTime) : null;
                                      const endMinutes = selectedEndTime 
                                        ? timeToMinutes(selectedEndTime) + 30 
                                        : (selectedTime ? startMinutes + duration : null);
                                      
                                      const isInSelectedRange = !manualTimeMode && selectedTime && isThisDoctorSelected &&
                                        slotMinutes >= startMinutes && slotMinutes < endMinutes;
                                      const isStartSlot = selectedTime === slot.time && isThisDoctorSelected;
                                      
                                      // Информация о записи для занятого слота
                                      const appointmentDuration = slot.appointment?.duration || 30;
                                      const isMultiSlotAppointment = slot.isBooked && appointmentDuration > 30;
                                      const appointmentId = slot.appointment?.id;
                                      
                                      // Для многослотовых записей - показываем только один объединённый блок
                                      if (isMultiSlotAppointment && appointmentId) {
                                        if (renderedAppointments.has(appointmentId)) {
                                          // Уже показали этот блок записи - пропускаем
                                          return null;
                                        }
                                        renderedAppointments.add(appointmentId);
                                        
                                        // Вычисляем время начала и окончания
                                        const aptTime = parseTime(slot.appointment.appointment_date);
                                        const startTime = `${String(aptTime.hours).padStart(2, '0')}:${String(aptTime.minutes).padStart(2, '0')}`;
                                        const endMinutesCalc = aptTime.hours * 60 + aptTime.minutes + appointmentDuration;
                                        const endTime = minutesToTime(endMinutesCalc);
                                        const slotsCount = Math.ceil(appointmentDuration / 30);
                                        
                                        // Проверяем оплачена ли запись
                                        const isPaidAppointment = slot.appointment.paid === true || 
                                                                  slot.appointment.paid === 1 || 
                                                                  slot.appointment.status === 'completed';
                                        
                                        // Объединённый блок для многослотовой записи
                                        return (
                                          <div
                                            key={`apt-${appointmentId}`}
                                            onClick={() => handleSlotClick(startTime, slot, false)}
                                            style={{
                                              gridColumn: '1 / -1',
                                              padding: '12px 16px',
                                              background: isPaidAppointment 
                                                ? 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)'
                                                : 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                                              border: `2px solid ${isPaidAppointment ? '#9e9e9e' : '#f44336'}`,
                                              borderRadius: '12px',
                                              cursor: isPaidAppointment ? 'default' : 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              gap: '12px',
                                              boxShadow: isPaidAppointment 
                                                ? '0 2px 8px rgba(0, 0, 0, 0.1)'
                                                : '0 2px 8px rgba(244, 67, 54, 0.2)',
                                              opacity: isPaidAppointment ? 0.8 : 1
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                              <div style={{
                                                background: isPaidAppointment ? '#757575' : '#f44336',
                                                color: 'white',
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                fontWeight: 'bold',
                                                fontSize: '1rem'
                                              }}>
                                                {startTime} — {endTime}
                                              </div>
                                              <div style={{
                                                color: isPaidAppointment ? '#616161' : '#c62828',
                                                fontWeight: 'bold',
                                                fontSize: '0.9rem'
                                              }}>
                                                {appointmentDuration} мин ({slotsCount} {slotsCount === 1 ? 'слот' : (slotsCount < 5 ? 'слота' : 'слотов')})
                                              </div>
                                            </div>
                                            <div style={{
                                              background: isPaidAppointment ? '#616161' : '#d32f2f',
                                              color: 'white',
                                              padding: '4px 10px',
                                              borderRadius: '12px',
                                              fontSize: '0.75rem',
                                              fontWeight: 'bold'
                                            }}>
                                              {isPaidAppointment ? '✓ ОПЛАЧЕНО' : 'ЗАНЯТО'}
                                            </div>
                                          </div>
                                        );
                                      }
                                      
                                      // Обычный слот (свободный или занятый на 30 мин)
                                      const isDisabled = (slot.isBooked && !isStartSlot) || isPast || creating;
                                      
                                      // Проверяем оплачена ли запись
                                      const isPaidSlot = slot.isBooked && slot.appointment && (
                                        slot.appointment.paid === true || 
                                        slot.appointment.paid === 1 || 
                                        slot.appointment.status === 'completed'
                                      );
                                      
                                      return (
                                        <button
                                          key={slotIdx}
                                          onClick={(e) => {
                                            if (!isDisabled || slot.isBooked) {
                                              handleSlotClick(slot.time, slot, e.shiftKey);
                                            }
                                          }}
                                          disabled={isDisabled && !slot.isBooked}
                                          style={{
                                            padding: '12px',
                                            fontSize: '0.95rem',
                                            fontWeight: 'bold',
                                            background: isPast 
                                              ? '#f5f5f5' 
                                              : (slot.isBooked 
                                                ? (isPaidSlot ? '#eeeeee' : '#ffebee')
                                                : (isInSelectedRange
                                                  ? (isStartSlot ? '#667eea' : '#a8b9f7')
                                                  : '#e8f5e9')),
                                            color: isPast 
                                              ? '#999' 
                                              : (slot.isBooked 
                                                ? (isPaidSlot ? '#616161' : '#d32f2f')
                                                : (isInSelectedRange
                                                  ? 'white' 
                                                  : '#388e3c')),
                                            border: `2px solid ${isPast ? '#ccc' : (slot.isBooked ? (isPaidSlot ? '#9e9e9e' : '#f44336') : (isInSelectedRange ? '#667eea' : '#4caf50'))}`,
                                            borderRadius: '8px',
                                            cursor: isPaidSlot ? 'default' : ((isDisabled && !slot.isBooked) ? 'not-allowed' : 'pointer'),
                                            opacity: creating ? 0.6 : (isPast ? 0.5 : (isPaidSlot ? 0.7 : 1)),
                                            transform: isStartSlot ? 'scale(1.05)' : 'none',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                          }}
                                        >
                                          <div style={{ fontSize: '1rem' }}>
                                            {slot.time}
                                          </div>
                                          <div style={{ fontSize: '0.65rem', marginTop: '3px' }}>
                                            {slot.isBooked 
                                              ? (isPaidSlot ? '✓ Оплачено' : `${appointmentDuration} мин`)
                                              : (isStartSlot 
                                                ? 'Начало' 
                                                : (isInSelectedRange 
                                                  ? '✓' 
                                                  : 'Свободно'))}
                                          </div>
                                        </button>
                                      );
                                    });
                                  })()}
                                </div>
                              </React.Fragment>
                            ));
                          })()}
                        </div>
                      ))}
                    </div>
                  );
                } else {
                  // Обычное отображение для одного врача
                  // Проверяем есть ли несколько блоков расписания
                  const hasMultipleBlocks = actualSlots.hasMultipleSchedules || 
                    (actualSlots.slots.length > 0 && actualSlots.slots.some(s => s.scheduleBlock !== undefined && s.scheduleBlock > 0));
                  
                  if (hasMultipleBlocks) {
                    // Группируем слоты по блокам расписания
                    const slotsByBlock = new Map();
                    actualSlots.slots.forEach(slot => {
                      const blockKey = slot.scheduleBlock !== undefined ? slot.scheduleBlock : 0;
                      if (!slotsByBlock.has(blockKey)) {
                        slotsByBlock.set(blockKey, {
                          slots: [],
                          scheduleStart: slot.scheduleStart,
                          scheduleEnd: slot.scheduleEnd
                        });
                      }
                      slotsByBlock.get(blockKey).slots.push(slot);
                    });
                    
                    const blocks = Array.from(slotsByBlock.entries()).sort((a, b) => a[0] - b[0]);
                    
                    return (
                      <div style={{ marginTop: '15px' }}>
                        {blocks.map(([blockIndex, blockData], blockIdx) => {
                          const renderedAppointments = new Set();
                          
                          return (
                            <React.Fragment key={blockIndex}>
                              {/* Разделитель перерыва между блоками */}
                              {blockIdx > 0 && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  margin: '20px 0',
                                  gap: '12px'
                                }}>
                                  <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, transparent, #ff9800, transparent)' }} />
                                  <div style={{
                                    background: '#fff3e0',
                                    color: '#e65100',
                                    padding: '6px 16px',
                                    borderRadius: '20px',
                                    fontSize: '0.85rem',
                                    fontWeight: '500',
                                    border: '1px solid #ffcc80',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    ☕ Перерыв
                                  </div>
                                  <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, transparent, #ff9800, transparent)' }} />
                                </div>
                              )}
                              {/* Заголовок блока расписания */}
                              {blockData.scheduleStart && blockData.scheduleEnd && (
                                <div style={{
                                  fontSize: '0.85rem',
                                  color: '#666',
                                  marginBottom: '10px',
                                  padding: '6px 12px',
                                  background: '#f0f4ff',
                                  borderRadius: '6px',
                                  display: 'inline-block'
                                }}>
                                  🕐 {blockData.scheduleStart} - {blockData.scheduleEnd}
                                </div>
                              )}
                              {/* Слоты в сетке */}
                              <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(4, 1fr)', 
                                gap: '10px'
                              }}>
                                {blockData.slots.map((slot, idx) => {
                                  const [slotHour, slotMinute] = slot.time.split(':').map(Number);
                                  const slotDateTime = new Date(actualSlots.year, actualSlots.month - 1, actualSlots.day, slotHour, slotMinute, 0, 0);
                                  const now = new Date();
                                  now.setSeconds(0, 0);
                                  now.setMilliseconds(0);
                                  slotDateTime.setSeconds(0, 0);
                                  slotDateTime.setMilliseconds(0);
                                  const isPast = slotDateTime.getTime() < now.getTime() || slot.isPast;
                                  
                                  const slotMinutes = timeToMinutes(slot.time);
                                  const startMinutes = selectedTime ? timeToMinutes(selectedTime) : null;
                                  const endMinutes = selectedEndTime 
                                    ? timeToMinutes(selectedEndTime) + 30 
                                    : (selectedTime ? startMinutes + duration : null);
                                  
                                  const isInSelectedRange = !manualTimeMode && selectedTime && 
                                    slotMinutes >= startMinutes && slotMinutes < endMinutes;
                                  const isStartSlot = selectedTime === slot.time;
                                  
                                  const appointmentDuration = slot.appointment?.duration || 30;
                                  const isMultiSlotAppointment = slot.isBooked && appointmentDuration > 30;
                                  const appointmentId = slot.appointment?.id;
                                  
                                  // Для многослотовых записей - показываем только один объединённый блок
                                  if (isMultiSlotAppointment && appointmentId) {
                                    if (renderedAppointments.has(appointmentId)) {
                                      return null;
                                    }
                                    renderedAppointments.add(appointmentId);
                                    
                                    const aptTime = parseTime(slot.appointment.appointment_date);
                                    const startTime = `${String(aptTime.hours).padStart(2, '0')}:${String(aptTime.minutes).padStart(2, '0')}`;
                                    const endMinutesCalc = aptTime.hours * 60 + aptTime.minutes + appointmentDuration;
                                    const endTime = minutesToTime(endMinutesCalc);
                                    const slotsCount = Math.ceil(appointmentDuration / 30);
                                    
                                    // Проверяем оплачена ли запись
                                    const isPaidAppointment = slot.appointment.paid === true || 
                                                              slot.appointment.paid === 1 || 
                                                              slot.appointment.status === 'completed';
                                    
                                    return (
                                      <div
                                        key={`apt-${appointmentId}`}
                                        onClick={() => handleSlotClick(startTime, slot, false)}
                                        style={{
                                          gridColumn: '1 / -1',
                                          padding: '16px 20px',
                                          background: isPaidAppointment 
                                            ? 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)'
                                            : 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                                          border: `2px solid ${isPaidAppointment ? '#9e9e9e' : '#f44336'}`,
                                          borderRadius: '12px',
                                          cursor: isPaidAppointment ? 'default' : 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '16px',
                                          boxShadow: isPaidAppointment 
                                            ? '0 2px 8px rgba(0, 0, 0, 0.1)'
                                            : '0 2px 8px rgba(244, 67, 54, 0.2)',
                                          opacity: isPaidAppointment ? 0.8 : 1
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                          <div style={{
                                            background: isPaidAppointment ? '#757575' : '#f44336',
                                            color: 'white',
                                            padding: '10px 16px',
                                            borderRadius: '8px',
                                            fontWeight: 'bold',
                                            fontSize: '1.1rem'
                                          }}>
                                            {startTime} — {endTime}
                                          </div>
                                          <div style={{
                                            color: isPaidAppointment ? '#616161' : '#c62828',
                                            fontWeight: 'bold',
                                            fontSize: '1rem'
                                          }}>
                                            {appointmentDuration} мин ({slotsCount} {slotsCount === 1 ? 'слот' : (slotsCount < 5 ? 'слота' : 'слотов')})
                                          </div>
                                        </div>
                                        <div style={{
                                          background: isPaidAppointment ? '#616161' : '#d32f2f',
                                          color: 'white',
                                          padding: '6px 14px',
                                          borderRadius: '16px',
                                          fontSize: '0.85rem',
                                          fontWeight: 'bold'
                                        }}>
                                          {isPaidAppointment ? '✓ ОПЛАЧЕНО' : 'ЗАНЯТО'}
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  const isDisabled = (slot.isBooked && !isStartSlot) || isPast || creating;
                                  
                                  // Проверяем оплачена ли запись
                                  const isPaidSlot = slot.isBooked && slot.appointment && (
                                    slot.appointment.paid === true || 
                                    slot.appointment.paid === 1 || 
                                    slot.appointment.status === 'completed'
                                  );
                                  
                                  return (
                                    <button
                                      key={idx}
                                      onClick={(e) => {
                                        if (!isDisabled || slot.isBooked) {
                                          handleSlotClick(slot.time, slot, e.shiftKey);
                                        }
                                      }}
                                      disabled={isDisabled && !slot.isBooked}
                                      style={{
                                        padding: '15px',
                                        fontSize: '1rem',
                                        fontWeight: 'bold',
                                        background: isPast 
                                          ? '#f5f5f5' 
                                          : (slot.isBooked 
                                            ? (isPaidSlot ? '#eeeeee' : '#ffebee')
                                            : (isInSelectedRange
                                              ? (isStartSlot ? '#667eea' : '#a8b9f7')
                                              : '#e8f5e9')),
                                        color: isPast 
                                          ? '#999' 
                                          : (slot.isBooked 
                                            ? (isPaidSlot ? '#616161' : '#d32f2f')
                                            : (isInSelectedRange
                                              ? 'white' 
                                              : '#388e3c')),
                                        border: `2px solid ${isPast ? '#ccc' : (slot.isBooked ? (isPaidSlot ? '#9e9e9e' : '#f44336') : (isInSelectedRange ? '#667eea' : '#4caf50'))}`,
                                        borderRadius: '8px',
                                        cursor: isPaidSlot ? 'default' : ((isDisabled && !slot.isBooked) ? 'not-allowed' : 'pointer'),
                                        opacity: creating ? 0.6 : (isPast ? 0.5 : (isPaidSlot ? 0.7 : 1)),
                                        transform: isStartSlot ? 'scale(1.05)' : 'none',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <div style={{ fontSize: '1rem' }}>
                                        {slot.time}
                                      </div>
                                      <div style={{ fontSize: '0.7rem', marginTop: '5px' }}>
                                        {slot.isBooked 
                                          ? (isPaidSlot ? '✓ Оплачено' : `${appointmentDuration} мин`)
                                          : (isStartSlot 
                                            ? 'Начало' 
                                            : (isInSelectedRange 
                                              ? '✓' 
                                              : 'Свободно'))}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    );
                  }
                  
                  // Обычное отображение без блоков расписания
                  return (
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(4, 1fr)', 
                      gap: '10px', 
                      marginTop: '15px' 
                    }}>
                      {(() => {
                        // Группируем слоты: свободные отдельно, занятые одной записи - в один блок
                        const renderedAppointments = new Set();
                        
                        return actualSlots.slots.map((slot, idx) => {
                          const [slotHour, slotMinute] = slot.time.split(':').map(Number);
                          const slotDateTime = new Date(actualSlots.year, actualSlots.month - 1, actualSlots.day, slotHour, slotMinute, 0, 0);
                          const now = new Date();
                          now.setSeconds(0, 0);
                          now.setMilliseconds(0);
                          slotDateTime.setSeconds(0, 0);
                          slotDateTime.setMilliseconds(0);
                          const isPast = slotDateTime.getTime() < now.getTime() || slot.isPast;
                          
                          // Проверяем, входит ли слот в выбранный диапазон
                          const slotMinutes = timeToMinutes(slot.time);
                          const startMinutes = selectedTime ? timeToMinutes(selectedTime) : null;
                          const endMinutes = selectedEndTime 
                            ? timeToMinutes(selectedEndTime) + 30 
                            : (selectedTime ? startMinutes + duration : null);
                          
                          const isInSelectedRange = !manualTimeMode && selectedTime && 
                            slotMinutes >= startMinutes && slotMinutes < endMinutes;
                          const isStartSlot = selectedTime === slot.time;
                          
                          // Определяем информацию о записи для занятого слота
                          const appointmentDuration = slot.appointment?.duration || 30;
                          const isMultiSlotAppointment = slot.isBooked && appointmentDuration > 30;
                          const appointmentId = slot.appointment?.id;
                          
                          // Для многослотовых записей - показываем только один объединённый блок
                          if (isMultiSlotAppointment && appointmentId) {
                            if (renderedAppointments.has(appointmentId)) {
                              // Уже показали этот блок записи - пропускаем
                              return null;
                            }
                            renderedAppointments.add(appointmentId);
                            
                            // Вычисляем время начала и окончания
                            const aptTime = parseTime(slot.appointment.appointment_date);
                            const startTime = `${String(aptTime.hours).padStart(2, '0')}:${String(aptTime.minutes).padStart(2, '0')}`;
                            const endMinutesCalc = aptTime.hours * 60 + aptTime.minutes + appointmentDuration;
                            const endTime = minutesToTime(endMinutesCalc);
                            const slotsCount = Math.ceil(appointmentDuration / 30);
                            
                            // Проверяем оплачена ли запись
                            const isPaidAppointment = slot.appointment.paid === true || 
                                                      slot.appointment.paid === 1 || 
                                                      slot.appointment.status === 'completed';
                            
                            // Объединённый блок для многослотовой записи
                            return (
                              <div
                                key={`apt-${appointmentId}`}
                                onClick={() => handleSlotClick(startTime, slot, false)}
                                style={{
                                  gridColumn: '1 / -1',
                                  padding: '16px 20px',
                                  background: isPaidAppointment 
                                    ? 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)'
                                    : 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                                  border: `2px solid ${isPaidAppointment ? '#9e9e9e' : '#f44336'}`,
                                  borderRadius: '12px',
                                  cursor: isPaidAppointment ? 'default' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '16px',
                                  boxShadow: isPaidAppointment 
                                    ? '0 2px 8px rgba(0, 0, 0, 0.1)'
                                    : '0 2px 8px rgba(244, 67, 54, 0.2)',
                                  opacity: isPaidAppointment ? 0.8 : 1
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <div style={{
                                    background: isPaidAppointment ? '#757575' : '#f44336',
                                    color: 'white',
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem'
                                  }}>
                                    {startTime} — {endTime}
                                  </div>
                                  <div style={{
                                    color: isPaidAppointment ? '#616161' : '#c62828',
                                    fontWeight: 'bold',
                                    fontSize: '1rem'
                                  }}>
                                    {appointmentDuration} мин ({slotsCount} {slotsCount === 1 ? 'слот' : (slotsCount < 5 ? 'слота' : 'слотов')})
                                  </div>
                                </div>
                                <div style={{
                                  background: isPaidAppointment ? '#616161' : '#d32f2f',
                                  color: 'white',
                                  padding: '6px 14px',
                                  borderRadius: '16px',
                                  fontSize: '0.85rem',
                                  fontWeight: 'bold'
                                }}>
                                  {isPaidAppointment ? '✓ ОПЛАЧЕНО' : 'ЗАНЯТО'}
                                </div>
                              </div>
                            );
                          }
                          
                          // Обычный слот (свободный или занятый на 30 мин)
                          const isDisabled = (slot.isBooked && !isStartSlot) || isPast || creating;
                          
                          // Проверяем оплачена ли запись
                          const isPaidSlot = slot.isBooked && slot.appointment && (
                            slot.appointment.paid === true || 
                            slot.appointment.paid === 1 || 
                            slot.appointment.status === 'completed'
                          );
                          
                          return (
                            <button
                              key={idx}
                              onClick={(e) => {
                                if (!isDisabled || slot.isBooked) {
                                  handleSlotClick(slot.time, slot, e.shiftKey);
                                }
                              }}
                              disabled={isDisabled && !slot.isBooked}
                              style={{
                                padding: '15px',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                background: isPast 
                                  ? '#f5f5f5' 
                                  : (slot.isBooked 
                                    ? (isPaidSlot ? '#eeeeee' : '#ffebee')
                                    : (isInSelectedRange
                                      ? (isStartSlot ? '#667eea' : '#a8b9f7')
                                      : '#e8f5e9')),
                                color: isPast 
                                  ? '#999' 
                                  : (slot.isBooked 
                                    ? (isPaidSlot ? '#616161' : '#d32f2f')
                                    : (isInSelectedRange
                                      ? 'white' 
                                      : '#388e3c')),
                                border: `2px solid ${isPast ? '#ccc' : (slot.isBooked ? (isPaidSlot ? '#9e9e9e' : '#f44336') : (isInSelectedRange ? '#667eea' : '#4caf50'))}`,
                                borderRadius: '8px',
                                cursor: isPaidSlot ? 'default' : ((isDisabled && !slot.isBooked) ? 'not-allowed' : 'pointer'),
                                opacity: creating ? 0.6 : (isPast ? 0.5 : (isPaidSlot ? 0.7 : 1)),
                                transform: isStartSlot ? 'scale(1.05)' : 'none',
                                transition: 'all 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <div style={{ fontSize: '1rem' }}>
                                {slot.time}
                              </div>
                              <div style={{ fontSize: '0.7rem', marginTop: '5px' }}>
                                {slot.isBooked 
                                  ? (isPaidSlot ? '✓ Оплачено' : `${appointmentDuration} мин`)
                                  : (isStartSlot 
                                    ? 'Начало' 
                                    : (isInSelectedRange 
                                      ? '✓' 
                                      : 'Свободно'))}
                              </div>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  );
                }
              })()}
              {selectedSlot.allDoctorsMode && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDayAppointmentsTable(v => !v)}
                    style={{
                      marginTop: '12px',
                      padding: '8px 16px',
                      background: '#f0f4ff',
                      border: '1px solid #667eea',
                      borderRadius: '8px',
                      color: '#667eea',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}
                  >
                    {showDayAppointmentsTable ? 'Скрыть записи' : 'Показать записи'}
                  </button>
                  {showDayAppointmentsTable && (() => {
                    const rows = actualSlots.slots
                      .filter(s => s.isBooked && s.appointment)
                      .sort((a, b) => a.time.localeCompare(b.time));
                    return (
                      <div style={{ marginTop: '10px', maxHeight: '220px', overflow: 'auto', border: '1px solid #ddd', borderRadius: '8px', background: '#fafafa' }}>
                        {rows.length === 0 ? (
                          <p style={{ padding: '16px', margin: 0, color: '#666', fontSize: '0.9rem' }}>На этот день нет записей</p>
                        ) : (
                          <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: '#f5f5f5' }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Время</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Клиент</th>
                                {actualSlots.doctorsCount > 1 && <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Врач</th>}
                                <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Услуги, примечания</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((slot, i) => (
                                <tr key={slot.appointment.id || i} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '8px 10px' }}>{slot.time}</td>
                                  <td style={{ padding: '8px 10px' }}>{[slot.appointment.client_last_name, slot.appointment.client_first_name].filter(Boolean).join(' ') || '-'}</td>
                                  {actualSlots.doctorsCount > 1 && <td style={{ padding: '8px 10px' }}>{slot.doctor ? `${slot.doctor.lastName || ''} ${slot.doctor.firstName || ''}`.trim() || '-' : '-'}</td>}
                                  <td style={{ padding: '8px 10px', fontSize: '0.85rem' }}>
                                    {[
                                      (slot.appointment.services || []).map(s => s.name).filter(Boolean).join(', '),
                                      slot.appointment.notes || ''
                                    ].filter(Boolean).join(' | ') || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                style={{
                  padding: '10px 20px',
                  background: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Закрыть
              </button>
              {(selectedTime || (manualTimeMode && manualStartTime && manualEndTime)) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!creating) {
                      handleCreateAppointment();
                    }
                  }}
                  disabled={creating || !selectedClient}
                  style={{
                    padding: '10px 30px',
                    background: (creating || !selectedClient) 
                      ? '#ccc' 
                      : '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (creating || !selectedClient) 
                      ? 'not-allowed' 
                      : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!creating && selectedClient) {
                      e.target.style.background = '#5568d3';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!creating && selectedClient) {
                      e.target.style.background = '#667eea';
                    }
                  }}
                >
                  {editingAppointmentId ? '✅ Обновить запись' : '✅ Записать'}
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Модалка создания клиента */}
      {showCreateClientModal && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowCreateClientModal(false);
            setNewClientForm({ lastName: '', firstName: '', middleName: '', phone: '' });
          }
        }}>
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h2>➕ Создать нового клиента</h2>
            
            <div style={{ marginBottom: '15px' }}>
              <label>Фамилия *</label>
              <input
                type="text"
                value={newClientForm.lastName}
                onChange={(e) => setNewClientForm({ ...newClientForm, lastName: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                placeholder="Введите фамилию"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label>Имя *</label>
              <input
                type="text"
                value={newClientForm.firstName}
                onChange={(e) => setNewClientForm({ ...newClientForm, firstName: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                placeholder="Введите имя"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label>Отчество</label>
              <input
                type="text"
                value={newClientForm.middleName}
                onChange={(e) => setNewClientForm({ ...newClientForm, middleName: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                placeholder="Введите отчество (необязательно)"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label>Дата рождения</label>
              <input
                type="date"
                value={newClientForm.date_of_birth}
                onChange={(e) => setNewClientForm({ ...newClientForm, date_of_birth: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label>Номер паспорта</label>
              <input
                type="text"
                value={newClientForm.passport_number}
                onChange={(e) => setNewClientForm({ ...newClientForm, passport_number: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                placeholder="Номер паспорта (необязательно)"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label>Телефон *</label>
              <input
                type="text"
                value={newClientForm.phone}
                onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                placeholder="+375XXXXXXXXX"
              />
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCreateClientModal(false);
                  setNewClientForm({ lastName: '', firstName: '', middleName: '', phone: '', date_of_birth: '', passport_number: '', citizenship_data: '', population_type: 'city' });
                }}
                style={{
                  padding: '10px 20px',
                  background: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Отмена
              </button>
              <button
                onClick={createNewClient}
                style={{
                  padding: '10px 30px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно подтверждения */}
      {!externalShowConfirm && (
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
      )}
    </div>
  );
};

export default BookingCalendarV2;

