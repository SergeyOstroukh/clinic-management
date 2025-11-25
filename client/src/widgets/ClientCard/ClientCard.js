import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDate, getFullName, calculateServicesTotal, calculateMaterialsTotal } from '../../shared/lib';
import Tabs from '../../components/Tabs';
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
  toast,
  onEditAppointment,
  onCancelAppointment,
  showConfirm,
  mode = 'card' // 'card' - карточка с вкладками, 'payment' - окно оплаты
}) => {
  const [clientHistory, setClientHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [editingTreatmentPlan, setEditingTreatmentPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

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
      // Обновляем план лечения (даже если он пустой), гарантируем что это строка
      const plan = response.data.treatment_plan 
        ? String(response.data.treatment_plan).trim() 
        : '';
      setTreatmentPlan(plan);
      console.log('План лечения загружен:', plan ? 'есть' : 'пустой', plan);
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
  }, [clientId, mode]); // Перезагружаем данные при изменении режима
  
  // Дополнительная загрузка плана лечения при открытии модалки оплаты
  useEffect(() => {
    if (mode === 'payment' && clientId) {
      loadClientData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, clientId]);

  // Слушаем событие обновления приема для перезагрузки данных
  useEffect(() => {
    const handleAppointmentUpdate = () => {
      if (clientId) {
        // Перезагружаем данные клиента, включая план лечения
        loadClientData();
        loadClientHistory();
      }
    };
    
    const handleClientDataUpdate = () => {
      if (clientId) {
        // Перезагружаем данные клиента при обновлении
        loadClientData();
      }
    };
    
    window.addEventListener('appointmentUpdated', handleAppointmentUpdate);
    window.addEventListener('clientDataUpdated', handleClientDataUpdate);
    return () => {
      window.removeEventListener('appointmentUpdated', handleAppointmentUpdate);
      window.removeEventListener('clientDataUpdated', handleClientDataUpdate);
    };
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

  const handlePrintTreatmentPlan = async (planToPrint = null) => {
    // Проверяем, что clientId существует
    if (!clientId) {
      console.error('❌ clientId не определен для печати плана лечения');
      if (toast) toast.error('Ошибка: ID клиента не определен');
      return;
    }
    
    // ИГНОРИРУЕМ параметр planToPrint - всегда используем состояние
    // (React может передать event объект, поэтому игнорируем параметр)
    let planValue = '';
    let clientDataForPrint = client; // Используем текущие данные клиента как fallback
    
    // Функция для безопасного извлечения строки из значения
    const extractString = (value) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') {
        const trimmed = value.trim();
        // Проверяем, что это не '[object Object]'
        if (trimmed === '[object Object]') return '';
        return trimmed;
      }
      if (typeof value === 'object') {
        // Если это объект, не используем его
        return '';
      }
      const str = String(value).trim();
      if (str === '[object Object]') return '';
      return str;
    };
    
    // ПРЯМО используем treatmentPlan из состояния, если он есть
    const statePlanStr = extractString(treatmentPlan);
    console.log('📋 Проверяем план лечения из состояния:', {
      treatmentPlan: treatmentPlan,
      treatmentPlanType: typeof treatmentPlan,
      treatmentPlanLength: treatmentPlan?.length,
      statePlanStr: statePlanStr,
      statePlanStrLength: statePlanStr.length,
      hasTreatmentPlan: statePlanStr.length > 0
    });
    
    // Проверяем напрямую treatmentPlan из состояния
    if (statePlanStr && statePlanStr.length > 0) {
      // Используем план из состояния напрямую
      planValue = statePlanStr;
      console.log('✅ Используем план из состояния для печати:', planValue.substring(0, 100) + '...');
      
      // Загружаем данные клиента для печати
      try {
        const clientResponse = await axios.get(`${API_URL}/clients/${clientId}`);
        clientDataForPrint = clientResponse.data;
        
        // Если в базе есть более свежий план, используем его
        const rawPlan = clientResponse.data.treatment_plan;
        const dbPlanStr = extractString(rawPlan);
        if (dbPlanStr && dbPlanStr.length > 0) {
          planValue = dbPlanStr;
          setTreatmentPlan(dbPlanStr); // Обновляем состояние
          console.log('✅ Обновлен план из базы (более свежий):', planValue.substring(0, 100) + '...');
        }
      } catch (error) {
        console.warn('⚠️ Не удалось загрузить данные клиента, используем текущие:', error);
      }
    } else {
      // Если в состоянии пусто, загружаем из базы
      console.log('🔄 План в состоянии пустой, загружаем из базы...', { clientId });
      try {
        const clientResponse = await axios.get(`${API_URL}/clients/${clientId}`);
        clientDataForPrint = clientResponse.data;
        
        const rawPlan = clientResponse.data.treatment_plan;
        const dbPlanStr = extractString(rawPlan);
        if (dbPlanStr && dbPlanStr.length > 0) {
          planValue = dbPlanStr;
          setTreatmentPlan(planValue); // Обновляем состояние
          console.log('✅ План лечения загружен из базы для печати:', planValue.substring(0, 100) + '...');
        } else {
          planValue = '';
          console.log('❌ План лечения пустой в базе');
        }
      } catch (error) {
        console.error('Ошибка загрузки плана лечения для печати:', error);
        planValue = '';
      }
    }
    
    // Финальное преобразование в строку - гарантируем что это строка
    let plan = '';
    if (planValue) {
      if (typeof planValue === 'string') {
        plan = planValue.trim();
      } else {
        console.error('❌ planValue не является строкой!', typeof planValue, planValue);
        plan = '';
      }
    }
    
    console.log('Печать плана лечения (ФИНАЛЬНЫЕ данные):', { 
      plan: plan.substring(0, 200) + (plan.length > 200 ? '...' : ''), 
      planLength: plan.length, 
      clientId,
      planValue: planValue ? planValue.substring(0, 200) + (planValue.length > 200 ? '...' : '') : '',
      planValueType: typeof planValue,
      planType: typeof plan,
      treatmentPlanFromState: treatmentPlan ? treatmentPlan.substring(0, 100) + '...' : '',
      treatmentPlanFromStateLength: treatmentPlan?.length,
      willShowPlan: plan && plan.length > 0,
      clientDataExists: !!clientDataForPrint
    });
    
    // Если план пустой, выводим предупреждение
    if (!plan || plan.length === 0) {
      console.warn('⚠️ ВНИМАНИЕ: План лечения пустой! Проверьте базу данных для clientId:', clientId);
      if (toast) toast.warning('План лечения пустой. Проверьте, что план лечения заполнен врачом.');
    }
    
    // Проверяем, что данные клиента доступны
    if (!clientDataForPrint) {
      console.error('❌ Данные клиента не загружены для печати');
      if (toast) toast.error('Ошибка: данные клиента не загружены');
      return;
    }
    
    // Формируем HTML для плана лечения ДО создания шаблонной строки
    let planHtml = '';
    if (plan && plan.length > 0) {
      const planLines = plan
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map((line, idx) => {
          const trimmedLine = line.trim();
          const isNumbered = /^\d+[.)]\s/.test(trimmedLine);
          const displayText = isNumbered 
            ? trimmedLine.replace(/^\d+[.)]\s/, '')
            : trimmedLine;
          // Экранируем HTML для безопасности
          const escapedText = displayText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
          return `
            <div class="treatment-plan-item-print">
              <span class="item-number">${idx + 1}.</span>
              <span class="item-text">${escapedText}</span>
            </div>
          `;
        });
      planHtml = planLines.join('');
    } else {
      planHtml = '<p>План лечения не указан</p>';
    }
    
    // Экранируем данные клиента для безопасности (используем загруженные данные)
    const clientName = getFullName(clientDataForPrint?.lastName, clientDataForPrint?.firstName, clientDataForPrint?.middleName)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const clientPhone = clientDataForPrint?.phone ? String(clientDataForPrint.phone).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    const clientAddress = clientDataForPrint?.address ? String(clientDataForPrint.address).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    const clientEmail = clientDataForPrint?.email ? String(clientDataForPrint.email).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>План лечения - ${clientName}</title>
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
            <p><strong>ФИО:</strong> ${clientName}</p>
            ${clientPhone ? `<p><strong>Телефон:</strong> ${clientPhone}</p>` : ''}
            ${clientAddress ? `<p><strong>Адрес:</strong> ${clientAddress}</p>` : ''}
            ${clientEmail ? `<p><strong>Email:</strong> ${clientEmail}</p>` : ''}
            <p><strong>Дата:</strong> ${formatDate(new Date(), 'dd.MM.yyyy')}</p>
          </div>
          
          <div class="treatment-plan">
            <h2>План лечения</h2>
            <div class="treatment-plan-content">
              ${planHtml}
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

  // Получаем сегодняшний визит для режима оплаты
  const getTodayVisit = () => {
    // Сначала ищем неоплаченные визиты (готовые к оплате или сегодняшние активные)
    const readyForPayment = clientHistory.find(visit => visit.status === 'ready_for_payment');
    if (readyForPayment) return readyForPayment;
    
    // Ищем сегодняшний визит с активными статусами (не оплаченный)
    const today = new Date().toISOString().split('T')[0];
    const todayActiveVisit = clientHistory.find(visit => {
      const visitDate = new Date(visit.appointment_date).toISOString().split('T')[0];
      const isNotPaid = visit.status !== 'completed' && visit.paid !== true && visit.paid !== 1;
      return visitDate === today && isNotPaid && (visit.status === 'scheduled' || visit.status === 'waiting' || visit.status === 'in-progress');
    });
    if (todayActiveVisit) return todayActiveVisit;
    
    // Если нет неоплаченных, ищем оплаченный визит (completed или paid === true)
    const paidVisit = clientHistory.find(visit => 
      visit.status === 'completed' || visit.paid === true || visit.paid === 1
    );
    return paidVisit;
  };

  const todayVisit = getTodayVisit();

  // Расчет сумм для сегодняшнего визита
  let todayTotal = 0;
  if (todayVisit) {
    todayTotal = calculateServicesTotal(todayVisit.services || [], services) +
                 calculateMaterialsTotal(todayVisit.materials || [], materials);
  }
  const finalTodayTotal = todayTotal - discountAmount;

  const handleMarkAsCompleted = async (visitId) => {
    try {
      await axios.patch(`${API_URL}/appointments/${visitId}/complete-payment`, { 
        discount_amount: discountAmount 
      });
      setDiscountAmount(0);
      // Перезагружаем данные после оплаты
      await loadClientHistory();
      
      // Получаем актуальные данные клиента для проверки плана лечения
      const clientResponse = await axios.get(`${API_URL}/clients/${clientId}`);
      console.log('Данные клиента после оплаты:', {
        treatment_plan: clientResponse.data.treatment_plan,
        treatment_plan_type: typeof clientResponse.data.treatment_plan,
        treatment_plan_length: clientResponse.data.treatment_plan?.length
      });
      
      const rawPlan = clientResponse.data.treatment_plan;
      const updatedTreatmentPlan = rawPlan !== null && rawPlan !== undefined
        ? String(rawPlan).trim()
        : '';
      
      console.log('Обновленный план лечения:', {
        updatedTreatmentPlan,
        length: updatedTreatmentPlan.length
      });
      
      setTreatmentPlan(updatedTreatmentPlan);
      
      if (toast) toast.success('✅ Оплата завершена!');
      if (onUpdate) onUpdate();
      
      // Оставляем модалку открытой в режиме оплаты, чтобы показать план лечения
      // Модалка автоматически переключится в режим просмотра оплаченного приема
    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
      if (toast) toast.error('Ошибка завершения оплаты');
    }
  };

  const tabs = [
    { label: 'История визитов', icon: '📋' },
    { label: 'Карточка пациента', icon: '👤' }
  ];

  // Режим оплаты - показываем форму оплаты для сегодняшнего визита
  if (mode === 'payment') {
    // Строгая проверка оплаты: статус completed ИЛИ paid === true/1
    const isPaid = todayVisit && (
      todayVisit.status === 'completed' || 
      todayVisit.paid === true || 
      todayVisit.paid === 1 ||
      todayVisit.paid === 'true'
    );
    const visitTotal = todayVisit ? (calculateServicesTotal(todayVisit.services || [], services) +
                                     calculateMaterialsTotal(todayVisit.materials || [], materials) -
                                     (todayVisit.discount_amount || 0)) : 0;

    return (
      <div className="client-card-overlay" onClick={onClose}>
        <div className="client-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
          <div className="client-card-header" style={isPaid ? { background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)' } : {}}>
            <div>
              <h2>{isPaid ? '✅ Прием оплачен' : '💰 Оплата приема'}</h2>
              <h3>{getFullName(client.lastName, client.firstName, client.middleName)}</h3>
            </div>
            <button className="btn-close" onClick={onClose}>✕</button>
          </div>

          {!todayVisit ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <p>Нет активных визитов на сегодня</p>
              <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
            </div>
          ) : isPaid ? (
            // Режим просмотра для оплаченного приема
            <div style={{ padding: '20px' }}>
              <div style={{ 
                marginBottom: '20px', 
                padding: '15px', 
                backgroundColor: '#e8f5e9', 
                borderRadius: '8px',
                border: '2px solid #4caf50'
              }}>
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '2em', marginRight: '10px' }}>✅</span>
                  <strong style={{ fontSize: '1.2em', color: '#2e7d32' }}>Оплата завершена</strong>
                </div>
                <p style={{ textAlign: 'center', color: '#666', margin: 0 }}>
                  Прием успешно оплачен. Изменения недоступны.
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4>📅 Дата приема: {formatDate(todayVisit.appointment_date, 'dd.MM.yyyy HH:mm')}</h4>
                <p><strong>Врач:</strong> {getDoctorName(todayVisit.doctor)}</p>
                {todayVisit.diagnosis && (
                  <p><strong>Диагноз:</strong> {todayVisit.diagnosis}</p>
                )}
              </div>

              {/* Услуги */}
              {todayVisit.services && todayVisit.services.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4>🛠️ Услуги:</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ddd' }}>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Услуга</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Кол-во</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Цена</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayVisit.services.map((s, idx) => {
                        const service = services.find(sv => sv.id === s.service_id);
                        if (!service) return null;
                        const itemTotal = service.price * s.quantity;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px' }}>{service.name}</td>
                            <td style={{ textAlign: 'right', padding: '8px' }}>{s.quantity}</td>
                            <td style={{ textAlign: 'right', padding: '8px' }}>{service.price.toFixed(2)} BYN</td>
                            <td style={{ textAlign: 'right', padding: '8px' }}>{itemTotal.toFixed(2)} BYN</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Материалы */}
              {todayVisit.materials && todayVisit.materials.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4>🧪 Материалы:</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ddd' }}>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Материал</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Кол-во</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Цена</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayVisit.materials.map((m, idx) => {
                        const material = materials.find(mat => mat.id === m.material_id);
                        if (!material) return null;
                        const itemTotal = material.price * m.quantity;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px' }}>{material.name}</td>
                            <td style={{ textAlign: 'right', padding: '8px' }}>{m.quantity} {material.unit || 'шт'}</td>
                            <td style={{ textAlign: 'right', padding: '8px' }}>{material.price.toFixed(2)} BYN</td>
                            <td style={{ textAlign: 'right', padding: '8px' }}>{itemTotal.toFixed(2)} BYN</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Итого */}
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                {todayVisit.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span>Скидка:</span>
                    <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>-{todayVisit.discount_amount.toFixed(2)} BYN</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '2px solid #ddd' }}>
                  <strong>Итого оплачено:</strong>
                  <strong style={{ fontSize: '1.2em', color: '#2e7d32' }}>{visitTotal.toFixed(2)} BYN</strong>
                </div>
              </div>

              {/* План лечения */}
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff3e0', borderRadius: '8px', border: '1px solid #ffb74d' }}>
                <h4 style={{ marginTop: 0, marginBottom: '10px' }}>📋 План лечения</h4>
                {treatmentPlan && treatmentPlan.trim() ? (
                  <>
                    <p style={{ color: '#666', fontSize: '0.9em', marginBottom: '10px' }}>
                      План лечения заполнен врачом. Вы можете распечатать его для пациента.
                    </p>
                    <button 
                      className="btn btn-primary" 
                      onClick={handlePrintTreatmentPlan}
                      style={{ width: '100%' }}
                    >
                      🖨️ Распечатать план лечения
                    </button>
                  </>
                ) : (
                  <p style={{ color: '#999', fontSize: '0.9em', fontStyle: 'italic' }}>
                    План лечения не заполнен врачом.
                  </p>
                )}
              </div>

              {/* Кнопки */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h4>📅 Дата приема: {formatDate(todayVisit.appointment_date, 'dd.MM.yyyy HH:mm')}</h4>
                <p><strong>Врач:</strong> {getDoctorName(todayVisit.doctor)}</p>
                {todayVisit.diagnosis && (
                  <p><strong>Диагноз:</strong> {todayVisit.diagnosis}</p>
                )}
              </div>

              {/* Услуги */}
              {todayVisit.services && todayVisit.services.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4>🛠️ Услуги:</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ddd' }}>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Услуга</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Кол-во</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Цена</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayVisit.services.map((s, idx) => {
                        const service = services.find(sv => sv.id === s.service_id);
                        if (!service) return null;
                        const itemTotal = service.price * s.quantity;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px' }}>{service.name}</td>
                            <td style={{ textAlign: 'right', padding: '8px' }}>{s.quantity}</td>
                            <td style={{ textAlign: 'right', padding: '8px' }}>{service.price.toFixed(2)} BYN</td>
                            <td style={{ textAlign: 'right', padding: '8px' }}>{itemTotal.toFixed(2)} BYN</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Материалы */}
              {todayVisit.materials && todayVisit.materials.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4>🧪 Материалы:</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ddd' }}>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Материал</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Кол-во</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Цена</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayVisit.materials.map((m, idx) => {
                        const material = materials.find(mat => mat.id === m.material_id);
                        if (!material) return null;
                        const itemTotal = material.price * m.quantity;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px' }}>{material.name}</td>
                            <td style={{ textAlign: 'right', padding: '8px' }}>{m.quantity} {material.unit || 'шт'}</td>
                            <td style={{ textAlign: 'right', padding: '8px' }}>{material.price.toFixed(2)} BYN</td>
                            <td style={{ textAlign: 'right', padding: '8px' }}>{itemTotal.toFixed(2)} BYN</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Итого */}
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <strong>Итого:</strong>
                  <strong>{todayTotal.toFixed(2)} BYN</strong>
                </div>
              </div>

              {/* Скидка */}
              <div style={{ marginBottom: '20px' }}>
                <ApplyDiscount 
                  originalTotal={todayTotal}
                  onDiscountApplied={(amount) => setDiscountAmount(amount)}
                />
              </div>

              {/* Итого с учетом скидки */}
              {discountAmount > 0 && (
                <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>Скидка:</span>
                    <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>-{discountAmount.toFixed(2)} BYN</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '2px solid #4caf50' }}>
                    <strong>К оплате:</strong>
                    <strong style={{ fontSize: '1.2em', color: '#2e7d32' }}>{finalTodayTotal.toFixed(2)} BYN</strong>
                  </div>
                </div>
              )}

              {/* Калькулятор сдачи */}
              <div style={{ marginBottom: '20px' }}>
                <PaymentCalculator totalAmount={finalTodayTotal} />
              </div>

              {/* Кнопка завершения оплаты */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleMarkAsCompleted(todayVisit.id)}
                  disabled={todayVisit.status === 'completed' || todayVisit.paid === true || todayVisit.paid === 1}
                >
                  {todayVisit.status === 'completed' || todayVisit.paid === true || todayVisit.paid === 1
                    ? '✅ Оплачено' 
                    : '✅ Завершить оплату'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Режим карточки - показываем вкладки
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
                                const isNumbered = /^\d+[.)]\s/.test(trimmedLine);
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
                                        ? trimmedLine.replace(/^[-•*\d+.)]\s/, '')
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
