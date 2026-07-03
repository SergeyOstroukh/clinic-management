import React, { useState } from 'react';
import { formatTime, getStatusColor, getStatusText } from '../../shared/lib';
import './AppointmentTable.css';

const AppointmentTable = ({ 
  appointments, 
  clients,
  onClientClick,
  onCallStatusToggle,
  onStatusChange,
  onEditAppointment,
  onCancelAppointment,
  getServiceNames,
  getDoctorName,
  calculateTotal,
  showPhoneIcon = true,
  showDoctor = true,
  showPrice = true,
  currentUser
}) => {
  const [selectedAuditAppointment, setSelectedAuditAppointment] = useState(null);

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return 'Неизвестный';
    return `${client.lastName || ''} ${client.firstName || ''} ${client.middleName || ''}`.trim() || client.name || 'Неизвестный';
  };

  const getClientPhone = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.phone || '-';
  };

  const formatAuditDateTime = (dateTime) => {
    if (!dateTime) return '—';

    const raw = String(dateTime).trim();
    const normalized = raw.replace('T', ' ').replace('Z', '').trim();
    const localMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})(?::\d{2})?/);
    if (localMatch) {
      const [, datePart, hours, minutes] = localMatch;
      return `${datePart} ${hours}:${minutes}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw.length >= 16 ? raw.substring(0, 16) : raw;
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const getAuditCreatedAt = (appointment) => appointment.created_at_local;

  const getAuditCancelledAt = (appointment) => appointment.cancelled_at_local;

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

  if (appointments.length === 0) {
    return (
      <div className="empty-state">
        <p>Нет записей</p>
      </div>
    );
  }

  return (
    <div className="appointments-table">
      <table>
        <thead>
          <tr>
            <th className="number-column">№</th>
            <th>Время</th>
            <th>ФИО клиента</th>
            <th>Телефон</th>
            <th>Услуги</th>
            {showDoctor && <th>Врач</th>}
            {showPrice && <th>Стоимость</th>}
            <th>Статус</th>
            {currentUser && (currentUser.role === 'administrator' || currentUser.role === 'superadmin') && <th>Оплата</th>}
            {currentUser && (currentUser.role === 'administrator' || currentUser.role === 'superadmin') && <th style={{ width: '50px' }}></th>}
          </tr>
        </thead>
        <tbody>
          {appointments.map((apt, index) => (
            <tr 
              key={apt.id}
              className={
                apt.paid === true || apt.paid === 1 || apt.status === 'completed'
                  ? 'paid-appointment'
                  : apt.status === 'ready_for_payment' 
                    ? 'ready-for-payment' 
                    : apt.status === 'cancelled' 
                      ? 'cancelled' 
                      : ''
              }
            >
              <td className="number-cell">{index + 1}</td>
              <td className="time-cell">
                {formatTimeRange(apt.appointment_date, apt.duration)}
              </td>
              <td className="client-cell">
                <span
                  className="client-name-link"
                  onClick={() => onClientClick(apt.client_id, apt)}
                >
                  {getClientName(apt.client_id)}
                </span>
              </td>
              <td className="phone-cell">
                {showPhoneIcon ? (
                  <div className="phone-with-icon">
                    <button
                      className={`phone-icon ${apt.called_today === 1 ? 'called' : 'not-called'}`}
                      onClick={() => onCallStatusToggle(apt.id, apt.called_today === 1)}
                      title={apt.called_today === 1 ? 'Позвонили' : 'Не звонили'}
                    >
                      📞
                    </button>
                    <span>{getClientPhone(apt.client_id)}</span>
                  </div>
                ) : (
                  <span>{getClientPhone(apt.client_id)}</span>
                )}
              </td>
              <td className="services-cell">
                {apt.notes ? (
                  <span title={apt.notes} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {apt.notes}
                  </span>
                ) : (
                  <span style={{ color: '#999', fontStyle: 'italic' }}>Нет примечаний</span>
                )}
              </td>
              {showDoctor && (
                <td className="doctor-cell">{getDoctorName(apt)}</td>
              )}
              {showPrice && (
                <td className="price-cell">
                  {(() => {
                    const baseTotal = (apt.total_price != null && apt.total_price !== '')
                      ? parseFloat(apt.total_price)
                      : calculateTotal(apt.services, apt.materials);
                    const discount = parseFloat(apt.discount_amount) || 0;
                    const displayTotal = Math.max(0, baseTotal - discount);
                    return `${displayTotal.toFixed(2)} BYN`;
                  })()}
                </td>
              )}
              <td className="status-cell">
                {currentUser && currentUser.role === 'doctor' ? (
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(apt.status) }}
                  >
                    {getStatusText(apt.status)}
                  </span>
                ) : (
                  <select
                    value={apt.status}
                    onChange={(e) => onStatusChange(apt.id, e.target.value)}
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
                )}
              </td>
              {currentUser && (currentUser.role === 'administrator' || currentUser.role === 'superadmin') && (
                <td className="payment-cell">
                  {apt.paid === true || apt.paid === 1 ? (
                    <span className="payment-badge paid">✅ Оплачено</span>
                  ) : (
                    <span className="payment-badge not-paid">⏳ Не оплачено</span>
                  )}
                </td>
              )}
              {currentUser && (currentUser.role === 'administrator' || currentUser.role === 'superadmin') && (
                <td className="actions-cell" style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                    {(apt.paid !== true && apt.paid !== 1) && (
                      <span
                        className="edit-icon"
                        onClick={() => onEditAppointment && onEditAppointment(apt)}
                        title="Редактировать запись"
                        style={{ 
                          cursor: 'pointer', 
                          fontSize: '18px',
                          padding: '5px',
                          display: 'inline-block'
                        }}
                      >
                        ✏️
                      </span>
                    )}
                    <span
                      className="info-icon"
                      onClick={() => setSelectedAuditAppointment(apt)}
                      title="Информация по записи"
                      style={{
                        cursor: 'pointer',
                        fontSize: '18px',
                        padding: '5px',
                        display: 'inline-block',
                        color: '#3f51b5'
                      }}
                    >
                      ℹ️
                    </span>
                    {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                      <span
                        className="cancel-icon"
                        onClick={() => {
                          if (window.confirm(`Отменить запись на ${formatTime(apt.appointment_date)}?\n\nКлиент: ${getClientName(apt.client_id)}`)) {
                            onCancelAppointment && onCancelAppointment(apt.id);
                          }
                        }}
                        title="Отменить запись"
                        style={{ 
                          cursor: 'pointer', 
                          fontSize: '18px',
                          padding: '5px',
                          display: 'inline-block',
                          color: '#f44336'
                        }}
                      >
                        ❌
                      </span>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {selectedAuditAppointment && (
        <div className="audit-modal-overlay" onClick={() => setSelectedAuditAppointment(null)}>
          <div className="audit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="audit-modal-header">
              <h3>Информация по записи</h3>
              <button
                type="button"
                className="audit-modal-close"
                onClick={() => setSelectedAuditAppointment(null)}
              >
                ×
              </button>
            </div>

            <table className="audit-info-table">
              <tbody>
                <tr>
                  <th>Дата/время записи</th>
                  <td>{formatTimeRange(selectedAuditAppointment.appointment_date, selectedAuditAppointment.duration)}</td>
                </tr>
                <tr>
                  <th>Кто создал</th>
                  <td>{selectedAuditAppointment.created_by_user_name || '—'}</td>
                </tr>
                <tr>
                  <th>Когда создана</th>
                  <td>{formatAuditDateTime(getAuditCreatedAt(selectedAuditAppointment))}</td>
                </tr>
                <tr>
                  <th>Статус</th>
                  <td>{getStatusText(selectedAuditAppointment.status)}</td>
                </tr>
                <tr>
                  <th>Кто отменил</th>
                  <td>{selectedAuditAppointment.cancelled_by_user_name || '—'}</td>
                </tr>
                <tr>
                  <th>Когда отменена</th>
                  <td>{formatAuditDateTime(getAuditCancelledAt(selectedAuditAppointment))}</td>
                </tr>
                <tr>
                  <th>Причина отмены</th>
                  <td>{selectedAuditAppointment.cancellation_reason || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentTable;

