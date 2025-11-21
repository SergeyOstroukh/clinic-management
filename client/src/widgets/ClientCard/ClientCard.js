import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDate, getFullName, calculateServicesTotal, calculateMaterialsTotal } from '../../shared/lib';
import { CompleteVisit } from '../../features/CompleteVisit';
import { ApplyDiscount } from '../../features/ApplyDiscount';
import { PaymentCalculator } from '../../features/PaymentCalculator';
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
  toast
}) => {
  const [clientHistory, setClientHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompleteVisit, setShowCompleteVisit] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  const client = clients.find(c => c.id === clientId);

  const loadClientHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/clients/${clientId}/appointments`);
      setClientHistory(response.data);
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

  const getTodayVisit = () => {
    const today = new Date().toISOString().split('T')[0];
    return clientHistory.find(visit => {
      const visitDate = new Date(visit.appointment_date).toISOString().split('T')[0];
      return visitDate === today && visit.status !== 'completed' && visit.status !== 'cancelled';
    });
  };

  const handleCompleteVisit = async () => {
    setShowCompleteVisit(false);
    // Обновляем историю клиента
    await loadClientHistory();
    // Обновляем данные в родительском компоненте
    if (onUpdate) {
      onUpdate();
    }
  };

  const handleMarkAsCompleted = async (visitId) => {
    try {
      await axios.patch(`${API_URL}/appointments/${visitId}/complete-payment`, { 
        discount_amount: discountAmount 
      });
      loadClientHistory();
      if (onUpdate) onUpdate();
      if (toast) toast.success('✅ Оплата завершена!');
    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
      if (toast) toast.error('Ошибка завершения оплаты');
    }
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

  const todayVisit = getTodayVisit();

  // Расчет сумм
  let todayTotal = 0;
  if (todayVisit) {
    todayTotal = calculateServicesTotal(todayVisit.services, services) +
                 calculateMaterialsTotal(todayVisit.materials || [], materials);
  }

  const finalTodayTotal = todayTotal - discountAmount;

  return (
    <div 
      className="client-card-overlay" 
      onClick={showCompleteVisit ? undefined : onClose}
    >
      <div className="client-card" onClick={(e) => e.stopPropagation()}>
        <div className="client-card-header">
          <h2>💰 Оплата приема</h2>
          <button 
            className="btn-close" 
            onClick={showCompleteVisit ? undefined : onClose}
            disabled={showCompleteVisit}
          >
            ✕
          </button>
        </div>

        {/* Информация о клиенте */}
        <div className="client-info-section">
          <h3>{getFullName(client.lastName, client.firstName, client.middleName)}</h3>
          <div className="client-details">
            {client.phone && <p>📞 {client.phone}</p>}
          </div>
        </div>

        {/* Текущий визит */}
        {todayVisit ? (
          <>
            {showCompleteVisit && currentUser.role === 'doctor' ? (
              <CompleteVisit
                visit={todayVisit}
                services={services}
                materials={materials}
                onSuccess={handleCompleteVisit}
                onCancel={() => setShowCompleteVisit(false)}
                toast={toast}
              />
            ) : (
              <>
                <div className="visit-summary">
                  <div className="visit-meta">
                    <p><strong>Врач:</strong> {getDoctorName(todayVisit.doctor)}</p>
                    <p><strong>Время:</strong> {formatDate(todayVisit.appointment_date, 'HH:mm')}</p>
                    {todayVisit.diagnosis && <p><strong>Диагноз:</strong> {todayVisit.diagnosis}</p>}
                  </div>
                </div>

                {/* Кнопка для врача - заполнить или редактировать */}
                {currentUser.role === 'doctor' && todayVisit.status !== 'completed' && (
                  <>
                    {todayVisit.status !== 'ready_for_payment' ? (
                      <button 
                        className="btn btn-primary btn-block"
                        onClick={() => setShowCompleteVisit(true)}
                      >
                        ✏️ Заполнить информацию о приеме
                      </button>
                    ) : (
                      <>
                        {/* Информация о завершенном приеме для врача */}
                        <div className="payment-details">
                          {/* Услуги */}
                          {todayVisit.services && todayVisit.services.length > 0 && (
                            <div className="details-section">
                              <h4>📋 Услуги:</h4>
                              <div className="details-list">
                                {todayVisit.services.map((s, idx) => {
                                  const service = services.find(serv => serv.id === s.service_id);
                                  return (
                                    <div key={idx} className="detail-item">
                                      <span className="detail-name">
                                        {service ? service.name : 'Неизвестная услуга'} ×{s.quantity}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Материалы */}
                          {todayVisit.materials && todayVisit.materials.length > 0 && (
                            <div className="details-section">
                              <h4>💊 Материалы:</h4>
                              <div className="details-list">
                                {todayVisit.materials.map((m, idx) => {
                                  const material = materials.find(mat => mat.id === m.material_id);
                                  return (
                                    <div key={idx} className="detail-item">
                                      <span className="detail-name">
                                        {material ? material.name : 'Неизвестный материал'} ×{m.quantity}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Кнопка редактирования */}
                        <button 
                          className="btn btn-primary btn-block"
                          onClick={() => setShowCompleteVisit(true)}
                        >
                          ✏️ Редактировать информацию о приеме
                        </button>
                      </>
                    )}
                  </>
                )}

                {/* Информация о завершенной оплате для врача (только просмотр) */}
                {currentUser.role === 'doctor' && todayVisit.status === 'completed' && (
                  <div className="payment-details">
                    <div className="info-message">
                      <p><strong>✅ Оплата завершена</strong></p>
                      <p>Редактирование записи недоступно после завершения оплаты.</p>
                    </div>
                    {/* Услуги */}
                    {todayVisit.services && todayVisit.services.length > 0 && (
                      <div className="details-section">
                        <h4>📋 Услуги:</h4>
                        <div className="details-list">
                          {todayVisit.services.map((s, idx) => {
                            const service = services.find(serv => serv.id === s.service_id);
                            return (
                              <div key={idx} className="detail-item">
                                <span className="detail-name">
                                  {service ? service.name : 'Неизвестная услуга'} ×{s.quantity}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Материалы */}
                    {todayVisit.materials && todayVisit.materials.length > 0 && (
                      <div className="details-section">
                        <h4>💊 Материалы:</h4>
                        <div className="details-list">
                          {todayVisit.materials.map((m, idx) => {
                            const material = materials.find(mat => mat.id === m.material_id);
                            return (
                              <div key={idx} className="detail-item">
                                <span className="detail-name">
                                  {material ? material.name : 'Неизвестный материал'} ×{m.quantity}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Детализация для администратора */}
                {currentUser.role !== 'doctor' && todayVisit.status === 'ready_for_payment' && (
                  <div className="payment-details">
                    {/* Услуги */}
                    {todayVisit.services && todayVisit.services.length > 0 && (
                      <div className="details-section">
                        <h4>📋 Услуги:</h4>
                        <div className="details-list">
                          {todayVisit.services.map((s, idx) => {
                            const service = services.find(serv => serv.id === s.service_id);
                            return (
                              <div key={idx} className="detail-item">
                                <span className="detail-name">
                                  {service ? service.name : 'Неизвестная услуга'} ×{s.quantity}
                                </span>
                                <span className="detail-price">
                                  {service ? (service.price * s.quantity).toFixed(2) : '0.00'} BYN
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Материалы */}
                    {todayVisit.materials && todayVisit.materials.length > 0 && (
                      <div className="details-section">
                        <h4>💊 Материалы:</h4>
                        <div className="details-list">
                          {todayVisit.materials.map((m, idx) => {
                            const material = materials.find(mat => mat.id === m.material_id);
                            return (
                              <div key={idx} className="detail-item">
                                <span className="detail-name">
                                  {material ? material.name : 'Неизвестный материал'} ×{m.quantity}
                                </span>
                                <span className="detail-price">
                                  {material ? (material.price * m.quantity).toFixed(2) : '0.00'} BYN
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Общая сумма */}
                    <div className="total-amount">
                      <span>Итого:</span>
                      <strong>{todayTotal.toFixed(2)} BYN</strong>
                    </div>

                    {/* Применение скидки */}
                    {currentUser.role === 'administrator' && (
                      <ApplyDiscount
                        originalTotal={todayTotal}
                        onDiscountApplied={setDiscountAmount}
                      />
                    )}

                    {/* Сумма к оплате */}
                    {discountAmount > 0 && (
                      <div className="final-amount">
                        <span>К оплате:</span>
                        <strong className="final-price">{finalTodayTotal.toFixed(2)} BYN</strong>
                      </div>
                    )}

                    {/* Калькулятор сдачи */}
                    {currentUser.role === 'administrator' && (
                      <>
                        <PaymentCalculator totalAmount={finalTodayTotal} />
                        
                        <button
                          className="btn btn-success btn-block btn-large"
                          onClick={() => handleMarkAsCompleted(todayVisit.id)}
                        >
                          ✅ Завершить оплату
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Сообщение если запись еще не готова к оплате */}
                {currentUser.role !== 'doctor' && todayVisit.status !== 'ready_for_payment' && (
                  <div className="info-message">
                    <p>⏳ Запись еще не готова к оплате. Дождитесь завершения приема врачом.</p>
                    <p><strong>Текущий статус:</strong> {todayVisit.status}</p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="info-message">
            <p>ℹ️ У клиента нет текущих визитов на сегодня</p>
          </div>
        )}

        <div className="client-card-actions">
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

export default ClientCard;

