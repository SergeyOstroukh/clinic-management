import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDate, getFullName } from '../../shared/lib';
import Tabs from '../../components/Tabs';
import './ClientCard.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

const ClientCard = ({ 
  clientId, 
  clients, 
  services, 
  materials, 
  doctors,
  currentUser,
  onClose,
  onUpdate,
  toast,
  onEditAppointment,
  onCancelAppointment,
  showConfirm
}) => {
  const [clientHistory, setClientHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [editingTreatmentPlan, setEditingTreatmentPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

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

  const loadClientData = async () => {
    try {
      const response = await axios.get(`${API_URL}/clients/${clientId}`);
      if (response.data.treatment_plan) {
        setTreatmentPlan(response.data.treatment_plan);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных клиента:', error);
    }
  };

  useEffect(() => {
    if (clientId) {
      loadClientHistory();
      loadClientData();
    }
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
    
    if (visit.services && visit.services.length > 0) {
      total += visit.services.reduce((sum, s) => sum + (s.price * s.quantity), 0);
    }
    
    if (visit.materials && visit.materials.length > 0) {
      total += visit.materials.reduce((sum, m) => sum + (m.price * m.quantity), 0);
    }
    
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

  const handleSaveTreatmentPlan = async () => {
    try {
      setSavingPlan(true);
      await axios.put(`${API_URL}/clients/${clientId}`, {
        treatment_plan: treatmentPlan,
        currentUser: currentUser
      });
      setEditingTreatmentPlan(false);
      if (onUpdate) onUpdate();
      if (toast) toast.success('✅ План лечения сохранен');
    } catch (error) {
      console.error('Ошибка сохранения плана лечения:', error);
      if (toast) toast.error('Ошибка сохранения плана лечения');
    } finally {
      setSavingPlan(false);
    }
  };

  const handlePrintTreatmentPlan = () => {
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>План лечения - ${getFullName(client?.lastName, client?.firstName, client?.middleName)}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
            }
            .header h1 {
              margin: 0;
              color: #333;
            }
            .patient-info {
              margin-bottom: 30px;
            }
            .patient-info h2 {
              color: #667eea;
              border-bottom: 1px solid #ddd;
              padding-bottom: 10px;
            }
            .patient-info p {
              margin: 8px 0;
            }
            .treatment-plan {
              margin-top: 30px;
            }
            .treatment-plan h2 {
              color: #667eea;
              border-bottom: 1px solid #ddd;
              padding-bottom: 10px;
            }
            .treatment-plan-content {
              display: flex;
              flex-direction: column;
              gap: 12px;
              padding: 20px;
            }
            .treatment-plan-item-print {
              display: flex;
              gap: 15px;
              padding: 12px;
              background: #f5f5f5;
              border-radius: 6px;
              border-left: 3px solid #4caf50;
              margin-bottom: 8px;
            }
            .item-number {
              font-weight: 700;
              color: #4caf50;
              min-width: 25px;
            }
            .item-text {
              flex: 1;
              line-height: 1.6;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>План лечения</h1>
          </div>
          
          <div class="patient-info">
            <h2>Информация о пациенте</h2>
            <p><strong>ФИО:</strong> ${getFullName(client?.lastName, client?.firstName, client?.middleName)}</p>
            ${client?.phone ? `<p><strong>Телефон:</strong> ${client.phone}</p>` : ''}
            ${client?.address ? `<p><strong>Адрес:</strong> ${client.address}</p>` : ''}
            ${client?.email ? `<p><strong>Email:</strong> ${client.email}</p>` : ''}
            <p><strong>Дата:</strong> ${formatDate(new Date(), 'dd.MM.yyyy')}</p>
          </div>
          
          <div class="treatment-plan">
            <h2>План лечения</h2>
            <div class="treatment-plan-content">
              ${treatmentPlan 
                ? treatmentPlan
                    .split('\n')
                    .filter(line => line.trim().length > 0)
                    .map((line, idx) => {
                      const trimmedLine = line.trim();
                      const isNumbered = /^\d+[\.\)]\s/.test(trimmedLine);
                      const displayText = isNumbered 
                        ? trimmedLine.replace(/^\d+[\.\)]\s/, '')
                        : trimmedLine;
                      return `
                        <div class="treatment-plan-item-print">
                          <span class="item-number">${idx + 1}.</span>
                          <span class="item-text">${displayText}</span>
                        </div>
                      `;
                    }).join('')
                : '<p>План лечения не указан</p>'
              }
            </div>
          </div>
          
          <div class="footer">
            <p>Документ создан: ${formatDate(new Date(), 'dd.MM.yyyy HH:mm')}</p>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  if (loading) {
    return (
      <div className="client-card-overlay" onClick={onClose}>
        <div className="client-card" onClick={(e) => e.stopPropagation()}>
          <div className="loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="client-card-overlay" onClick={onClose}>
        <div className="client-card" onClick={(e) => e.stopPropagation()}>
          <p>Клиент не найден</p>
          <button className="btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    );
  }

  // Подсчет общей статистики
  const completedVisits = clientHistory.filter(v => v.status === 'completed');
  const totalSpent = completedVisits.reduce((sum, v) => sum + calculateVisitTotal(v), 0);

  // Получаем последний диагноз
  const lastDiagnosis = clientHistory
    .filter(v => v.diagnosis)
    .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))[0]?.diagnosis || null;

  const tabs = [
    { label: 'История визитов', icon: '📋' },
    { label: 'Карточка пациента', icon: '👤' }
  ];

  return (
    <div className="client-card-overlay" onClick={onClose}>
      <div className="client-card" onClick={(e) => e.stopPropagation()}>
        <div className="client-card-header">
          <div>
            <h2>📋 Карточка клиента</h2>
            <h3>{getFullName(client.lastName, client.firstName, client.middleName)}</h3>
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

        {/* Вкладки */}
        <div className="client-card-tabs-wrapper">
          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
            {activeTab === 0 && (
              <div className="tab-content-history">
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
                                        const confirmed = showConfirm 
                                          ? await showConfirm({
                                              title: 'Отмена записи',
                                              message: `Отменить запись на ${formatDate(visit.appointment_date, 'dd.MM.yyyy HH:mm')}?`,
                                              confirmText: 'Да, отменить',
                                              cancelText: 'Нет',
                                              confirmButtonClass: 'btn-danger'
                                            })
                                          : window.confirm(`Отменить запись на ${formatDate(visit.appointment_date, 'dd.MM.yyyy HH:mm')}?`);
                                        
                                        if (confirmed && onCancelAppointment) {
                                          await onCancelAppointment(visit.id);
                                          loadClientHistory();
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
            )}

            {activeTab === 1 && (
              <div className="tab-content-patient-card">
                <div className="patient-card-section">
                  <h4>👤 Личная информация</h4>
                  <div className="patient-info-grid">
                    <div className="info-item">
                      <span className="info-label">ФИО:</span>
                      <span className="info-value">
                        {getFullName(client.lastName, client.firstName, client.middleName)}
                      </span>
                    </div>
                    {client.phone && (
                      <div className="info-item">
                        <span className="info-label">Телефон:</span>
                        <span className="info-value">{client.phone}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className="info-item">
                        <span className="info-label">Адрес:</span>
                        <span className="info-value">{client.address}</span>
                      </div>
                    )}
                    {client.email && (
                      <div className="info-item">
                        <span className="info-label">Email:</span>
                        <span className="info-value">{client.email}</span>
                      </div>
                    )}
                    {client.notes && (
                      <div className="info-item">
                        <span className="info-label">Примечания:</span>
                        <span className="info-value">{client.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="patient-card-section">
                  <h4>🏥 Диагноз</h4>
                  <div className="diagnosis-display">
                    {lastDiagnosis ? (
                      <p className="diagnosis-text">{lastDiagnosis}</p>
                    ) : (
                      <p className="diagnosis-empty">Диагноз не указан</p>
                    )}
                    <p className="diagnosis-note">
                      <small>Показывается последний указанный диагноз из истории визитов</small>
                    </p>
                  </div>
                </div>

                <div className="patient-card-section">
                  <div className="treatment-plan-header">
                    <h4>📋 План лечения</h4>
                    {!editingTreatmentPlan && (
                      <button
                        className="btn btn-small btn-primary"
                        onClick={() => setEditingTreatmentPlan(true)}
                      >
                        {treatmentPlan ? '✏️ Редактировать' : '➕ Добавить'}
                      </button>
                    )}
                  </div>
                  
                  {editingTreatmentPlan ? (
                    <div className="treatment-plan-editor">
                      <textarea
                        value={treatmentPlan}
                        onChange={(e) => setTreatmentPlan(e.target.value)}
                        placeholder="Введите план лечения пациента..."
                        rows={10}
                        className="treatment-plan-textarea"
                      />
                      <div className="treatment-plan-actions">
                        <button
                          className="btn btn-primary"
                          onClick={handleSaveTreatmentPlan}
                          disabled={savingPlan}
                        >
                          {savingPlan ? '💾 Сохранение...' : '💾 Сохранить'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setTreatmentPlan(client.treatment_plan || '');
                            setEditingTreatmentPlan(false);
                          }}
                          disabled={savingPlan}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="treatment-plan-display">
                      {treatmentPlan ? (
                        <>
                          <div className="treatment-plan-content">
                            {treatmentPlan
                              .split('\n')
                              .filter(line => line.trim().length > 0)
                              .map((line, idx) => {
                                const trimmedLine = line.trim();
                                // Определяем тип пункта по началу строки
                                const isNumbered = /^\d+[\.\)]\s/.test(trimmedLine);
                                const isBullet = /^[-•*]\s/.test(trimmedLine);
                                
                                return (
                                  <div 
                                    key={idx} 
                                    className="treatment-plan-item"
                                  >
                                    <div className="treatment-plan-item-number">
                                      {isNumbered ? '' : `${idx + 1}.`}
                                    </div>
                                    <div className="treatment-plan-item-text">
                                      {isNumbered || isBullet 
                                        ? trimmedLine.replace(/^[-•*\d+\.\)]\s/, '')
                                        : trimmedLine
                                      }
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                          <button
                            className="btn btn-primary btn-block"
                            onClick={handlePrintTreatmentPlan}
                            style={{ marginTop: '15px' }}
                          >
                            🖨️ Распечатать план лечения
                          </button>
                        </>
                      ) : (
                        <p className="treatment-plan-empty">
                          План лечения не указан. Нажмите "Добавить" чтобы создать план лечения.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Tabs>
        </div>

        <div className="client-card-actions">
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

export default ClientCard;
