import React from 'react';
import { formatTime, getStatusColor, getStatusText } from '../../shared/lib';
import './AppointmentTable.css';

const AppointmentTable = ({ 
  appointments, 
  clients,
  onClientClick,
  onCallStatusToggle,
  onStatusChange,
  onEditAppointment,
  getServiceNames,
  getDoctorName,
  calculateTotal,
  showPhoneIcon = true,
  showDoctor = true,
  showPrice = true,
  currentUser
}) => {
  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return 'Неизвестный';
    return `${client.lastName || ''} ${client.firstName || ''} ${client.middleName || ''}`.trim() || client.name || 'Неизвестный';
  };

  const getClientPhone = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.phone || '-';
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
              className={apt.status === 'ready_for_payment' ? 'ready-for-payment' : ''}
            >
              <td className="number-cell">{index + 1}</td>
              <td className="time-cell">
                {formatTime(apt.appointment_date)}
              </td>
              <td className="client-cell">
                <span
                  className="client-name-link"
                  onClick={() => onClientClick(apt.client_id)}
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
              <td className="services-cell">{getServiceNames(apt.services)}</td>
              {showDoctor && (
                <td className="doctor-cell">{getDoctorName(apt.doctor)}</td>
              )}
              {showPrice && (
                <td className="price-cell">{calculateTotal(apt.services).toFixed(2)} BYN</td>
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
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AppointmentTable;

