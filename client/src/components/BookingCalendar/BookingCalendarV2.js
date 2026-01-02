import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import { useConfirmModal } from '../../hooks/useConfirmModal';
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

const DAYS_OF_WEEK = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

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
  const [allDoctorsSchedules, setAllDoctorsSchedules] = useState({}); // { doctorId: { schedules, specificDates, appointments } }

  // Форма записи
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [notes, setNotes] = useState('');
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedSlotDoctor, setSelectedSlotDoctor] = useState(null); // Врач выбранного слота в режиме нескольких врачей
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    phone: ''
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
            
            // Получаем расписание на этот день
            let daySchedule = [];
            
            // Проверяем точечные даты
            const specificDate = doctorSpecificDates.find(sd => sd.work_date === dateStr && sd.is_active);
            if (specificDate) {
              daySchedule = [{ start_time: specificDate.start_time, end_time: specificDate.end_time }];
            } else {
              // Проверяем регулярное расписание
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
      const allSchedulesData = {};
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      const slotsByDate = {};

      // Загружаем данные для каждого врача
      for (const doctor of doctors) {
        try {
          const [schedulesRes, datesRes, appointmentsRes] = await Promise.all([
            axios.get(`${API_URL}/schedules?doctor_id=${doctor.id}`),
            axios.get(`${API_URL}/specific-dates?doctor_id=${doctor.id}`),
            axios.get(`${API_URL}/doctors/${doctor.id}/monthly-appointments?month=${currentMonth}&year=${currentYear}`)
          ]);

          allSchedulesData[doctor.id] = {
            schedules: schedulesRes.data,
            specificDates: datesRes.data,
            appointments: appointmentsRes.data.filter(apt => apt.status !== 'cancelled')
          };

          // Генерируем слоты для каждого дня месяца
          for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = formatDate(currentYear, currentMonth, day);
            const dayOfWeek = new Date(currentYear, currentMonth - 1, day).getDay();

            // Получаем расписание на этот день
            let daySchedule = [];
            const specificDate = allSchedulesData[doctor.id].specificDates.find(
              sd => sd.work_date === dateStr && sd.is_active
            );
            if (specificDate) {
              daySchedule = [{ start_time: specificDate.start_time, end_time: specificDate.end_time }];
            } else {
              const daySchedules = allSchedulesData[doctor.id].schedules.filter(
                s => s.day_of_week === dayOfWeek && s.is_active
              );
              daySchedule = daySchedules.map(s => ({ start_time: s.start_time, end_time: s.end_time }));
            }

            if (daySchedule.length === 0) continue;

            // Генерируем слоты для этого дня
            daySchedule.forEach(s => {
              const times = generateTimeSlots(s.start_time, s.end_time);
              times.forEach(time => {
                const [slotHour, slotMinute] = time.split(':').map(Number);
                const slotDateTime = new Date(currentYear, currentMonth - 1, day, slotHour, slotMinute, 0, 0);
                const now = new Date();
                now.setSeconds(0, 0);
                const isPast = slotDateTime.getTime() < now.getTime();

                // Проверяем, занят ли слот
                const dayAppointments = allSchedulesData[doctor.id].appointments.filter(apt => {
                  if (!apt.appointment_date || apt.status === 'cancelled') return false;
                  const normalizedDate = normalizeDateString(apt.appointment_date);
                  return normalizedDate.startsWith(dateStr);
                });

                const isBooked = dayAppointments.some(apt => {
                  const aptTime = parseTime(apt.appointment_date);
                  return aptTime.hours === slotHour && aptTime.minutes === slotMinute;
                });

                // Сохраняем все слоты (включая занятые), но только не прошедшие
                if (!isPast) {
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
                    appointment: isBooked ? dayAppointments.find(apt => {
                      const aptTime = parseTime(apt.appointment_date);
                      return aptTime.hours === slotHour && aptTime.minutes === slotMinute;
                    }) : null
                  });
                }
              });
            });
          }
        } catch (error) {
          console.error(`Ошибка загрузки данных для врача ${doctor.id}:`, error);
        }
      }

      setAllDoctorsSchedules(allSchedulesData);
      setAllDoctorsSlots(slotsByDate);
    } catch (error) {
      console.error('Ошибка загрузки данных всех врачей:', error);
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

    // Проверяем точечные даты
    const specificDate = specificDates.find(sd => sd.work_date === dateStr && sd.is_active);
    if (specificDate) {
      return [{ start_time: specificDate.start_time, end_time: specificDate.end_time }];
    }

    // Проверяем регулярное расписание
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
      if (availableToday.length === 0) return 'past-today';
    }
    
    // Если есть занятые слоты, показываем как частично занятый
    if (bookedSlots.length > 0 && freeSlots.length > 0) {
      return 'partially-booked';
    }
    
    // Если все слоты заняты
    if (bookedSlots.length > 0 && freeSlots.length === 0) {
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
  const generateDaySlotsAllDoctors = (year, month, day) => {
    const dateStr = formatDate(year, month, day);
    const slots = allDoctorsSlots[dateStr] || [];
    
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
        appointment: slot.appointment || null
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
          
          const isBooked = dayAppointments.some(apt => {
            const aptTime = parseTime(apt.appointment_date);
            return aptTime.hours === slotHour && aptTime.minutes === slotMinute;
          });

          const slotDateTime = new Date(year, month - 1, day, slotHour, slotMinute, 0, 0);
          const now = new Date();
          now.setSeconds(0, 0);
          const isPast = slotDateTime.getTime() < now.getTime();

          allSlots.push({
            time,
            isBooked,
            isPast,
            appointment: isBooked ? dayAppointments.find(apt => {
              const aptTime = parseTime(apt.appointment_date);
              const slotTime = time.split(':');
              return aptTime.hours === parseInt(slotTime[0]) && aptTime.minutes === parseInt(slotTime[1]);
            }) : null
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

    // Собираем все слоты
    const allSlots = [];
    schedule.forEach(s => {
      const times = generateTimeSlots(s.start_time, s.end_time);
      times.forEach(time => {
        const [slotHour, slotMinute] = time.split(':').map(Number);
        
        const isBooked = dayAppointments.some(apt => {
          const aptTime = parseTime(apt.appointment_date);
          return aptTime.hours === slotHour && aptTime.minutes === slotMinute;
        });

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
          appointment: isBooked ? dayAppointments.find(apt => {
            const aptTime = parseTime(apt.appointment_date);
            const slotTime = time.split(':');
            return aptTime.hours === parseInt(slotTime[0]) && aptTime.minutes === parseInt(slotTime[1]);
          }) : null
        });
      });
    });

    return { year, month, day, dateStr, slots: allSlots };
  };

  const handleDayClick = async (year, month, day, skipScheduleCheck = false) => {
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
      }
    } else {
      const schedule = getDaySchedule(year, month, day);
      if (!skipScheduleCheck && schedule.length === 0) {
        if (toast) toast.warning('На этот день нет расписания');
        return;
      }
    }

    const daySlots = generateDaySlots(year, month, day);
    setSelectedSlot(daySlots);
    setSelectedTime(null); // Сбрасываем выбранное время при открытии
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

  const handleSlotClick = (time, slot) => {
    if (slot.isBooked) {
      // Отмена записи
      const clientName = slot.appointment.client_last_name && slot.appointment.client_first_name
        ? `${slot.appointment.client_last_name} ${slot.appointment.client_first_name}`
        : 'Клиент';
      const confirmMessage = `Отменить запись на ${time}?\n\nКлиент: ${clientName}\nТелефон: ${slot.appointment.client_phone || 'не указан'}`;
      
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
    
    // В режиме нескольких врачей просто сохраняем выбранный слот, не переключая режим
    if (slot.doctor && selectedSlot?.allDoctorsMode && selectedSlot?.doctorsCount > 1) {
      setSelectedSlotDoctor(slot.doctor);
      setSelectedTime(time);
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
    
    // Выбираем время
    setSelectedTime(time);
  };

  const handleCreateAppointment = () => {
    if (!selectedClient) {
      if (toast) toast.warning('Сначала выберите клиента');
      return;
    }
    if (!selectedTime) {
      if (toast) toast.warning('Выберите время');
      return;
    }
    
    // В режиме нескольких врачей проверяем, что выбран врач
    if (selectedSlot?.allDoctorsMode && selectedSlot?.doctorsCount > 1 && !selectedSlotDoctor) {
      if (toast) toast.warning('Выберите время и врача');
      return;
    }

    // Парсим время, убеждаясь что минуты не теряются
    const timeParts = selectedTime.split(':');
    const hours = parseInt(timeParts[0], 10) || 0;
    const minutes = parseInt(timeParts[1], 10) || 0;
    
    const dateTime = formatDateTime(selectedSlot.year, selectedSlot.month, selectedSlot.day, hours, minutes);
    
    createAppointment(dateTime);
  };

  const cancelAppointment = async (appointmentId) => {
    try {
      await axios.patch(`${API_URL}/appointments/${appointmentId}/status`, {
        status: 'cancelled'
      });
      
      // Сбрасываем выбранное время
      setSelectedTime(null);
      
      // Загружаем обновленные записи
      await loadAppointments();
      
      // Отправляем событие для обновления таблицы записей в App.js
      window.dispatchEvent(new Event('appointmentCreated'));
      
      // Обновляем модалку для перерисовки слотов после обновления appointments
      // Используем setTimeout для гарантии, что React обновил состояние appointments
      setTimeout(() => {
        setModalUpdateKey(prev => prev + 1);
      }, 100);
      
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
      setNewClientForm({ lastName: '', firstName: '', middleName: '', phone: '' });
      
      if (toast) toast.success('✅ Клиент успешно создан!');
    } catch (error) {
      console.error('Ошибка создания клиента:', error);
      if (toast) toast.error(`${error.response?.data?.error || error.message}`);
    }
  };

  const createAppointment = async (dateTime) => {
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
          notes: notes
        });
      } else {
        // Определяем врача для записи
        const doctorForAppointment = selectedSlotDoctor || selectedDoctor;
        
        // Создаем новую запись
        await axios.post(`${API_URL}/appointments`, {
          client_id: selectedClient.id,
          doctor_id: doctorForAppointment.id,
          appointment_date: dateTime,
          services: selectedServices,
          notes: notes
        });
      }

      // Сначала загружаем обновленные записи
      if (showAllDoctorsMode) {
        // В режиме всех врачей перезагружаем данные всех врачей
        await loadAllDoctorsData();
        // Обновляем слоты в модалке
        if (selectedSlot) {
          const updatedSlots = generateDaySlots(selectedSlot.year, selectedSlot.month, selectedSlot.day);
          setSelectedSlot(updatedSlots);
        }
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
        setSelectedSlotDoctor(null);
        setSelectedClient(null);
        setClientSearch('');
        setSelectedServices([]);
        setNotes('');
        if (toast) toast.success('✅ Запись успешно создана!');
        
        // Обновляем модалку для перерисовки слотов после обновления appointments
        // Используем setTimeout для гарантии, что React обновил состояние appointments
        setTimeout(() => {
          // Принудительно пересчитываем слоты с актуальными данными
          if (selectedSlot) {
            if (showAllDoctorsMode) {
              // В режиме всех врачей перезагружаем данные
              loadAllDoctorsData().then(() => {
                const updatedSlots = generateDaySlots(selectedSlot.year, selectedSlot.month, selectedSlot.day);
                setSelectedSlot(updatedSlots);
                setModalUpdateKey(prev => prev + 1);
              });
            } else {
              const updatedSlots = generateDaySlots(selectedSlot.year, selectedSlot.month, selectedSlot.day);
              setSelectedSlot(updatedSlots);
              setModalUpdateKey(prev => prev + 1);
            }
          }
        }, 200);
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
    setSelectedSlot(null);
    setSelectedSlotDoctor(null);
    setEditingAppointmentId(null);
  };

  const renderCalendar = () => {
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay();
    
    const days = [];
    
    // Пустые ячейки до первого дня
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
                setAllDoctorsSchedules({});
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
        // Пересчитываем слоты с актуальными данными appointments и текущим временем
        // Используем useMemo для пересчета при каждом рендере модального окна
        const actualSlots = generateDaySlots(selectedSlot.year, selectedSlot.month, selectedSlot.day);
        
        return (
        <div 
          key={`modal-${selectedSlot.year}-${selectedSlot.month}-${selectedSlot.day}-${modalUpdateKey}`}
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

            {/* Слоты времени */}
            <div>
              <h3>Выберите время:</h3>
              {selectedTime && (
                <div style={{
                  padding: '12px',
                  background: '#e8f5ff',
                  borderRadius: '8px',
                  marginBottom: '15px',
                  border: '2px solid #667eea',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#667eea'
                }}>
                  ⏰ Выбрано время: {selectedTime}
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
                          border: '2px solid #e0e0e0',
                          borderRadius: '12px',
                          padding: '15px',
                          background: '#fafafa'
                        }}>
                          <div style={{
                            textAlign: 'center',
                            marginBottom: '15px',
                            paddingBottom: '10px',
                            borderBottom: '2px solid #667eea'
                          }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#667eea', marginBottom: '5px' }}>
                              👨‍⚕️ {doctorGroup.doctor.lastName}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                              {doctorGroup.doctor.firstName}
                            </div>
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '8px'
                          }}>
                            {doctorGroup.slots.map((slot, slotIdx) => {
                              const [slotHour, slotMinute] = slot.time.split(':').map(Number);
                              const slotDateTime = new Date(actualSlots.year, actualSlots.month - 1, actualSlots.day, slotHour, slotMinute, 0, 0);
                              const now = new Date();
                              now.setSeconds(0, 0);
                              now.setMilliseconds(0);
                              slotDateTime.setSeconds(0, 0);
                              slotDateTime.setMilliseconds(0);
                              const isPast = slotDateTime.getTime() < now.getTime() || slot.isPast;
                              
                              // Проверяем, выбран ли этот слот (время и врач совпадают)
                              const isSelected = selectedTime === slot.time && 
                                                selectedSlotDoctor && 
                                                selectedSlotDoctor.id === slot.doctor?.id;
                              
                              // Слот считается занятым, если он реально занят или выбран
                              const isSlotBooked = slot.isBooked || isSelected;
                              
                              // Слот недоступен, если он занят (но не выбран), прошедший или идет создание
                              const isDisabled = (slot.isBooked && !isSelected) || isPast || creating;
                              
                              return (
                                <button
                                  key={slotIdx}
                                  onClick={() => {
                                    if (!isDisabled) {
                                      handleSlotClick(slot.time, slot);
                                    } else if (slot.isBooked && slot.appointment) {
                                      // Если слот занят, можно отменить запись
                                      handleSlotClick(slot.time, slot);
                                    }
                                  }}
                                  disabled={isDisabled && !slot.isBooked}
                                  style={{
                                    padding: '12px',
                                    fontSize: '0.95rem',
                                    fontWeight: 'bold',
                                    background: isPast 
                                      ? '#f5f5f5' 
                                      : (isSlotBooked 
                                        ? '#ffebee' 
                                        : '#e8f5e9'),
                                    color: isPast 
                                      ? '#999' 
                                      : (isSlotBooked 
                                        ? '#d32f2f' 
                                        : '#388e3c'),
                                    border: `2px solid ${isPast 
                                      ? '#ccc' 
                                      : (isSlotBooked 
                                        ? '#f44336' 
                                        : '#4caf50')}`,
                                    borderRadius: '8px',
                                    cursor: (isDisabled && !slot.isBooked) ? 'not-allowed' : (slot.isBooked ? 'pointer' : 'pointer'),
                                    opacity: creating ? 0.6 : (isPast ? 0.5 : 1),
                                    transform: isSelected ? 'scale(1.05)' : 'none',
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
                                    {isSlotBooked ? (isSelected ? 'Выбрано' : (slot.isBooked ? 'Занято' : 'Выбрано')) : 'Свободно'}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                } else {
                  // Обычное отображение для одного врача
                  return (
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(4, 1fr)', 
                      gap: '10px', 
                      marginTop: '15px' 
                    }}>
                      {actualSlots.slots.map((slot, idx) => {
                        const [slotHour, slotMinute] = slot.time.split(':').map(Number);
                        const slotDateTime = new Date(actualSlots.year, actualSlots.month - 1, actualSlots.day, slotHour, slotMinute, 0, 0);
                        const now = new Date();
                        now.setSeconds(0, 0);
                        now.setMilliseconds(0);
                        slotDateTime.setSeconds(0, 0);
                        slotDateTime.setMilliseconds(0);
                        const isPast = slotDateTime.getTime() < now.getTime() || slot.isPast;
                        
                        // Слот недоступен, если он занят (но можно отменить), прошедший или идет создание
                        const isDisabled = (slot.isBooked && selectedTime !== slot.time) || isPast || creating;
                        
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              if (!isDisabled || slot.isBooked) {
                                handleSlotClick(slot.time, slot);
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
                                  ? '#ffebee' 
                                  : (selectedTime === slot.time 
                                    ? '#667eea' 
                                    : '#e8f5e9')),
                              color: isPast 
                                ? '#999' 
                                : (slot.isBooked 
                                  ? '#d32f2f' 
                                  : (selectedTime === slot.time 
                                    ? 'white' 
                                    : '#388e3c')),
                              border: `2px solid ${isPast 
                                ? '#ccc' 
                                : (slot.isBooked 
                                  ? '#f44336' 
                                  : (selectedTime === slot.time 
                                    ? '#667eea' 
                                    : '#4caf50'))}`,
                              borderRadius: '8px',
                              cursor: (isDisabled && !slot.isBooked) ? 'not-allowed' : 'pointer',
                              opacity: creating ? 0.6 : (isPast ? 0.5 : 1),
                              transform: selectedTime === slot.time ? 'scale(1.05)' : 'none',
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
                              {slot.isBooked ? 'Занято (отменить?)' : (selectedTime === slot.time ? 'Выбрано' : 'Свободно')}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                }
              })()}
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
              {selectedTime && (
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
                  setNewClientForm({ lastName: '', firstName: '', middleName: '', phone: '' });
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

