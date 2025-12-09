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
      let normalized = dateStr.replace('T', ' ');
      if (normalized.includes('Z')) {
        normalized = normalized.replace('Z', '');
      }
      if (normalized.includes('+')) {
        normalized = normalized.split('+')[0];
      }
      if (normalized.includes('-', 10) && normalized.length >= 16) {
        // Формат 'YYYY-MM-DD HH:MM:SS' или 'YYYY-MM-DD HH:MM'
        const timePart = normalized.split(' ')[1];
        if (timePart) {
          const [hours, minutes] = timePart.split(':');
          if (hours && minutes) {
            return `${String(parseInt(hours, 10)).padStart(2, '0')}:${String(parseInt(minutes, 10)).padStart(2, '0')}`;
          }
        }
      }
    }
    // Для других форматов используем стандартный парсинг
    const date = new Date(dateStr);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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
                  <span className="appointment-time">{formatTime(apt.appointment_date)}</span>
                  <span className="client-name-link">{getClientName(apt.client_id)}</span>
                  <span className={`status-dot status-${apt.status || 'scheduled'}`}></span>
                </div>
                <div className="appointment-row2">
                  <span className="appointment-phone">{getClientPhone(apt.client_id)}</span>
                  {apt.services && apt.services.length > 0 && (
                    <span className="appointment-services"> • {getServiceNames(apt.services)}</span>
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

