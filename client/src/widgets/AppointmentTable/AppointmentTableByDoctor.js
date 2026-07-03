import React from 'react';
import './AppointmentTableByDoctor.css';

const AppointmentTableByDoctor = ({ 
  appointments, 
  clients,
  doctors,
  onClientClick,
  onCallStatusToggle,
  onStatusChange,
  onEditAppointment,
  onCancelAppointment,
  getServiceNames,
  calculateTotal,
  currentUser
}) => {
  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return 'Неизвестный';
    return `${client.lastName || ''} ${client.firstName || ''}`.trim() || client.name || 'Неизвестный';
  };

  const getClientPhone = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.phone || '';
  };

  const formatTime = (dateStr) => {
    // Если это строка в формате 'YYYY-MM-DD HH:MM:SS' или 'YYYY-MM-DD HH:MM',
    // парсим время напрямую без конвертации timezone
    if (typeof dateStr === 'string') {
      // Нормализуем формат: убираем 'T', заменяем на пробел, убираем timezone
      let normalized = dateStr.replace('T', ' ').trim();
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
      
      // Проверяем формат 'YYYY-MM-DD HH:MM:SS' или 'YYYY-MM-DD HH:MM'
      const dateTimeMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
      if (dateTimeMatch) {
        const [, , hours, minutes] = dateTimeMatch;
        // ВАЖНО: убеждаемся, что minutes не undefined и не пустая строка
        const hoursNum = parseInt(hours, 10) || 0;
        const minutesNum = parseInt(minutes, 10) || 0;
        
        // Возвращаем время в формате HH:MM, сохраняя минуты как есть
        return `${String(hoursNum).padStart(2, '0')}:${String(minutesNum).padStart(2, '0')}`;
      }
    }
    // Для других форматов используем стандартный парсинг
    // ВАЖНО: new Date() может конвертировать timezone, поэтому стараемся избегать этого
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        // Используем getHours и getMinutes напрямую
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      }
    } catch (e) {
      console.error('Ошибка форматирования времени:', e, dateStr);
    }
    return '--:--';
  };

  // Функция для форматирования диапазона времени
  const formatTimeRange = (appointmentDate, duration) => {
    const startTime = formatTime(appointmentDate);
    const appointmentDuration = duration || 30;

    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + appointmentDuration;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    return `${startTime} — ${endTime}`;
  };

  // Группируем записи по врачам
  const appointmentsByDoctor = {};
  
  doctors.forEach(doctor => {
    appointmentsByDoctor[doctor.id] = {
      doctor,
      appointments: appointments
        .filter(apt => apt.doctor_id === doctor.id)
        .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))
    };
  });

  // Фильтруем только врачей с записями
  const doctorsWithAppointments = Object.values(appointmentsByDoctor)
    .filter(group => group.appointments.length > 0);

  if (doctorsWithAppointments.length === 0) {
    return (
      <div className="empty-state">
        <p>Нет записей</p>
      </div>
    );
  }

  return (
    <div className="appointments-by-doctor">
      {doctorsWithAppointments.map(({ doctor, appointments: doctorAppointments }) => (
        <div key={doctor.id} className="doctor-column">
          <div className="doctor-column-header">
            <div className="doctor-avatar">👤</div>
            <div className="doctor-info">
              <span className="doctor-name">{doctor.lastName} {doctor.firstName}</span>
              <span className="doctor-specialization">{doctor.specialization || ''}</span>
            </div>
            <span className="doctor-count">{doctorAppointments.length}</span>
          </div>
          
          <div className="doctor-appointments-list">
              {doctorAppointments.map(apt => (
              <div 
                key={apt.id} 
                className={`appointment-card ${apt.status || 'scheduled'}`}
                onClick={() => onClientClick(apt.client_id, apt)}
              >
                <div className="appointment-row1">
                  <span 
                    className={`phone-icon ${apt.called_today === 1 ? 'called' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onCallStatusToggle(apt.id, apt.called_today === 1); }}
                  >📞</span>
                  <span className="appointment-time">{formatTimeRange(apt.appointment_date, apt.duration)}</span>
                  <span className="client-name-link">{getClientName(apt.client_id)}</span>
                  <span className={`status-dot status-${apt.status || 'scheduled'}`}></span>
                </div>
                <div className="appointment-row2">
                  <span className="appointment-phone">{getClientPhone(apt.client_id)}</span>
                  {apt.notes && (
                    <span className="appointment-notes" title={apt.notes} style={{ 
                      marginLeft: '8px', 
                      color: '#666',
                      fontSize: '0.9em',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      • {apt.notes}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AppointmentTableByDoctor;

