import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDate, getFullName } from '../../shared/lib';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import './ClientHistoryCard.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

const ClientHistoryCard = ({ 
  clientId, 
  clients, 
  onClose, 
  onEditAppointment,
  onCancelAppointment,
  showConfirm: externalShowConfirm
}) => {
  // Используем внешний showConfirm или создаем свой
  const { confirmModal, showConfirm: internalShowConfirm } = useConfirmModal();
  const showConfirm = externalShowConfirm || internalShowConfirm;
  
  const [clientHistory, setClientHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const client = clients.find(c => c.id === clientId);

  const loadClientHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/clients/${clientId}/appointments`);
      // Сортируем по дате (новые сверху)
      const sorted = response.data.sort((a, b) => 
        new Date(b.appointment_date) - new Date(a.appointment_date)
      );
      setClientHistory(sorted);
    } catch (error) {
      console.error('Ошибка загрузки истории клиента:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const getDoctorName = (doctor) => {
    if (!doctor) return '-';
    if (typeof doctor === 'string') return doctor;
    return getFullName(doctor.lastName, doctor.firstName, doctor.middleName);
  };

  const getServicesText = (services) => {
    if (!services || services.length === 0) return '-';
    return services.map(s => `${s.name} (x${s.quantity})`).join(', ');
  };

  const calculateVisitTotal = (visit) => {
    let total = 0;
    
    // Сумма услуг
    if (visit.services && visit.services.length > 0) {
      total += visit.services.reduce((sum, s) => sum + (s.price * s.quantity), 0);
    }
    
    // Сумма материалов
    if (visit.materials && visit.materials.length > 0) {
      total += visit.materials.reduce((sum, m) => sum + (m.price * m.quantity), 0);
    }
    
    // Учитываем скидку
    if (visit.discount_amount) {
      total -= visit.discount_amount;
    }
    
    return total;
  };

  const getStatusText = (status) => {
    const statuses = {
      'scheduled': 'Запланирован',
      'waiting': 'Ожидает',
      'in-progress': 'На приеме',
      'ready_for_payment': 'Готов к оплате',
      'completed': 'Завершен',
      'cancelled': 'Отменен'
    };
    return statuses[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'scheduled': '#3498db',
      'waiting': '#f39c12',
      'in-progress': '#9b59b6',
      'ready_for_payment': '#e67e22',
      'completed': '#27ae60',
      'cancelled': '#95a5a6'
    };
    return colors[status] || '#95a5a6';
  };

  if (loading) {
    return (
      <div className="client-history-overlay" onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}>
        <div className="client-history-card">
          <div className="loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="client-history-overlay" onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}>
        <div className="client-history-card">
          <p>Клиент не найден</p>
          <button className="btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    );
  }

  // Подсчет общей статистики
  const completedVisits = clientHistory.filter(v => v.status === 'completed');
  const totalSpent = completedVisits.reduce((sum, v) => sum + calculateVisitTotal(v), 0);

  return (
    <div className="client-history-overlay" onMouseDown={(e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    }}>
      <div className="client-history-card">
        <div className="client-history-header">
          <div>
            <h2>📋 Карточка клиента</h2>
            <h3>{getFullName(client.lastName, client.firstName, client.middleName)}</h3>
            <div className="client-contacts">
              {client.phone && <p>📞 {client.phone}</p>}
              {client.email && <p>📧 {client.email}</p>}
              {client.address && <p>📍 {client.address}</p>}
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {/* Статистика */}
        <div className="client-stats">
          <div className="stat-item">
            <div className="stat-label">Всего визитов</div>
            <div className="stat-value">{clientHistory.length}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Завершено</div>
            <div className="stat-value">{completedVisits.length}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Всего оплачено</div>
            <div className="stat-value">{totalSpent.toFixed(2)} BYN</div>
          </div>
        </div>

        {/* История посещений */}
        <div className="client-history-content">
          <h4>История посещений</h4>
          
          {clientHistory.length === 0 ? (
            <div className="empty-state">
              <p>Нет записей о посещениях</p>
            </div>
          ) : (
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th style={{ width: '12%' }}>Дата</th>
                    <th style={{ width: '18%' }}>Врач</th>
                    <th style={{ width: '25%' }}>Услуги</th>
                    <th style={{ width: '15%' }}>Диагноз</th>
                    <th style={{ width: '10%' }}>Сумма</th>
                    <th style={{ width: '10%' }}>Статус</th>
                    <th style={{ width: '10%' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {clientHistory.map((visit) => (
                    <tr key={visit.id}>
                      <td className="visit-date">
                        {formatDate(visit.appointment_date, 'dd.MM.yyyy HH:mm')}
                      </td>
                      <td>{getDoctorName(visit.doctor)}</td>
                      <td className="visit-services">
                        {getServicesText(visit.services)}
                      </td>
                      <td className="visit-diagnosis">
                        {visit.diagnosis || '-'}
                      </td>
                      <td className="visit-total">
                        {visit.status === 'completed' 
                          ? `${calculateVisitTotal(visit).toFixed(2)} BYN`
                          : '-'}
                      </td>
                      <td>
                        <span 
                          className="status-badge-small"
                          style={{ backgroundColor: getStatusColor(visit.status) }}
                        >
                          {getStatusText(visit.status)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          {visit.status !== 'cancelled' && visit.status !== 'completed' && (
                            <>
                              <button
                                className="btn-icon"
                                onClick={() => onEditAppointment && onEditAppointment(visit)}
                                title="Редактировать запись"
                                style={{
                                  padding: '5px 10px',
                                  background: '#667eea',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '14px'
                                }}
                              >
                                ✏️ Редактировать
                              </button>
                              <button
                                className="btn-icon"
                                onClick={async () => {
                                  if (showConfirm) {
                                    const confirmed = await showConfirm({
                                      title: 'Отмена записи',
                                      message: `Отменить запись на ${formatDate(visit.appointment_date, 'dd.MM.yyyy HH:mm')}?`,
                                      confirmText: 'Да, отменить',
                                      cancelText: 'Нет',
                                      confirmButtonClass: 'btn-danger'
                                    });
                                    
                                    if (confirmed && onCancelAppointment) {
                                      await onCancelAppointment(visit.id);
                                      // Перезагружаем историю после отмены
                                      loadClientHistory();
                                    }
                                  } else if (window.confirm(`Отменить запись на ${formatDate(visit.appointment_date, 'dd.MM.yyyy HH:mm')}?`)) {
                                    if (onCancelAppointment) {
                                      await onCancelAppointment(visit.id);
                                      // Перезагружаем историю после отмены
                                      loadClientHistory();
                                    }
                                  }
                                }}
                                title="Отменить запись"
                                style={{
                                  padding: '5px 10px',
                                  background: '#f44336',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '14px'
                                }}
                              >
                                ❌ Отменить
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="client-history-actions">
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
      
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

export default ClientHistoryCard;

