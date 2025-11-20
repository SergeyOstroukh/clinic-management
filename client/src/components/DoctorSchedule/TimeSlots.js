import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TimeSlots.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

// Генерация временных слотов из начального и конечного времени
const generateTimeSlots = (startTime, endTime, intervalMinutes = 30) => {
  const slots = [];
  
  // Парсим время начала
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  // Создаем объекты Date для удобства работы
  const start = new Date();
  start.setHours(startHour, startMinute, 0, 0);
  
  const end = new Date();
  end.setHours(endHour, endMinute, 0, 0);
  
  // Генерируем слоты
  let current = new Date(start);
  while (current < end) {
    const hours = current.getHours().toString().padStart(2, '0');
    const minutes = current.getMinutes().toString().padStart(2, '0');
    slots.push(`${hours}:${minutes}`);
    
    // Добавляем интервал
    current.setMinutes(current.getMinutes() + intervalMinutes);
  }
  
  return slots;
};

// Проверка, есть ли запись на данное время
const isSlotOccupied = (slotTime, appointments, intervalMinutes = 30) => {
  return appointments.some(apt => {
    const aptDate = new Date(apt.appointment_date);
    const aptHours = aptDate.getHours().toString().padStart(2, '0');
    const aptMinutes = aptDate.getMinutes().toString().padStart(2, '0');
    
    // Проверяем, попадает ли время записи в этот слот
    const [slotHour, slotMinute] = slotTime.split(':').map(Number);
    const slotStart = new Date();
    slotStart.setHours(slotHour, slotMinute, 0, 0);
    
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + intervalMinutes);
    
    const aptDateTime = new Date();
    aptDateTime.setHours(parseInt(aptHours), parseInt(aptMinutes), 0, 0);
    
    // Запись попадает в слот, если время записи >= начала слота и < конца слота
    return aptDateTime >= slotStart && aptDateTime < slotEnd;
  });
};

// Получить информацию о записи для слота
const getSlotAppointment = (slotTime, appointments, intervalMinutes = 30) => {
  return appointments.find(apt => {
    const aptDate = new Date(apt.appointment_date);
    const aptHours = aptDate.getHours().toString().padStart(2, '0');
    const aptMinutes = aptDate.getMinutes().toString().padStart(2, '0');
    
    const [slotHour, slotMinute] = slotTime.split(':').map(Number);
    const slotStart = new Date();
    slotStart.setHours(slotHour, slotMinute, 0, 0);
    
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + intervalMinutes);
    
    const aptDateTime = new Date();
    aptDateTime.setHours(parseInt(aptHours), parseInt(aptMinutes), 0, 0);
    
    return aptDateTime >= slotStart && aptDateTime < slotEnd;
  });
};

const TimeSlots = ({ doctorId, date, startTime, endTime, intervalMinutes = 30 }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSlot, setExpandedSlot] = useState(null);

  useEffect(() => {
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, date]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/doctors/${doctorId}/daily-appointments?date=${date}`
      );
      setAppointments(response.data);
    } catch (error) {
      console.error('Ошибка загрузки записей:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="time-slots-loading">⏳ Загрузка слотов...</div>;
  }

  if (!startTime || !endTime) {
    return <div className="time-slots-empty">Нет расписания на этот день</div>;
  }

  const slots = generateTimeSlots(startTime, endTime, intervalMinutes);

  return (
    <div className="time-slots-container">
      <div className="time-slots-header">
        <h4>⏰ Временные слоты ({slots.length})</h4>
        <div className="time-slots-legend">
          <div className="legend-item">
            <div className="legend-dot free"></div>
            <span>Свободно</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot occupied"></div>
            <span>Занято</span>
          </div>
        </div>
      </div>
      
      <div className="time-slots-grid">
        {slots.map((slot, index) => {
          const occupied = isSlotOccupied(slot, appointments, intervalMinutes);
          const appointment = occupied ? getSlotAppointment(slot, appointments, intervalMinutes) : null;
          const isExpanded = expandedSlot === slot;
          
          // Проверяем, является ли слот прошедшим
          const [slotHour, slotMinute] = slot.split(':').map(Number);
          let slotDateTime;
          if (typeof date === 'string') {
            // Если date - строка в формате YYYY-MM-DD
            const [year, month, day] = date.split('-').map(Number);
            slotDateTime = new Date(year, month - 1, day, slotHour, slotMinute, 0, 0);
          } else {
            slotDateTime = new Date(date);
            slotDateTime.setHours(slotHour, slotMinute, 0, 0);
          }
          const now = new Date();
          const isPast = slotDateTime < now;
          
          return (
            <div 
              key={index} 
              className={`time-slot ${occupied ? 'occupied' : 'free'} ${isExpanded ? 'expanded' : ''} ${isPast ? 'past' : ''}`}
              onClick={() => occupied && setExpandedSlot(isExpanded ? null : slot)}
              title={occupied && appointment ? 
                `${appointment.client_last_name} ${appointment.client_first_name}\nТел: ${appointment.client_phone}` : 
                'Свободный слот'}
            >
              <div className="time-slot-time">
                {slot}
              </div>
              {occupied && appointment && (
                <>
                  <div className="time-slot-status">
                    {appointment.status === 'scheduled' && '📅'}
                    {appointment.status === 'completed' && '✅'}
                    {appointment.status === 'cancelled' && '❌'}
                    {appointment.status === 'in_progress' && '🔄'}
                  </div>
                  {isExpanded && (
                    <div className="time-slot-details">
                      <div className="client-name">
                        {appointment.client_last_name} {appointment.client_first_name}
                      </div>
                      <div className="client-phone">
                        📞 {appointment.client_phone}
                      </div>
                      {appointment.notes && (
                        <div className="appointment-notes-small">
                          {appointment.notes}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimeSlots;

