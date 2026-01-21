import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ServiceMaterialSelector from '../../components/ServiceMaterialSelector/ServiceMaterialSelector';
import './CompleteVisit.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

const CompleteVisit = ({ visit, services, materials, onSuccess, onCancel, toast }) => {
  // Проверяем, оплачен ли прием
  const isPaid = visit.status === 'completed' || visit.paid === true || visit.paid === 1 || visit.paid === 'true';
  
  const [diagnosis, setDiagnosis] = useState(visit.diagnosis || '');
  const [selectedServices, setSelectedServices] = useState(visit.services || []);
  const [selectedMaterials, setSelectedMaterials] = useState(visit.materials || []);
  /** Составные услуги: при применении добавляются сюда, а не разворачиваются в services/materials */
  const [selectedComposites, setSelectedComposites] = useState([]);
  /** Какие составные услуги развёрнуты (аккордеон подуслуг) */
  const [expandedCompositeIds, setExpandedCompositeIds] = useState([]);
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [compositeServices, setCompositeServices] = useState([]);
  const [compositeServiceSearch, setCompositeServiceSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState('services'); // 'services', 'materials' или 'composite'

  // Загружаем составные услуги
  useEffect(() => {
    const loadCompositeServices = async () => {
      try {
        const response = await axios.get(`${API_URL}/composite-services`);
        // Фильтруем только активные
        setCompositeServices(response.data.filter(cs => cs.is_active !== false));
      } catch (error) {
        console.error('Ошибка загрузки составных услуг:', error);
      }
    };
    loadCompositeServices();
  }, []);

  // Загружаем план лечения клиента
  useEffect(() => {
    const loadTreatmentPlan = async () => {
      if (visit.client_id || visit.client?.id) {
        const clientId = visit.client_id || visit.client?.id;
        try {
          const response = await axios.get(`${API_URL}/clients/${clientId}`);
          // Всегда обновляем план лечения, даже если он пустой
          setTreatmentPlan(response.data.treatment_plan || '');
        } catch (error) {
          console.error('Ошибка загрузки плана лечения:', error);
        }
      }
    };
    loadTreatmentPlan();
  }, [visit.client_id, visit.client?.id, visit.id]); // Перезагружаем при изменении записи

  // Обновляем данные при изменении visit (восстанавливаем составные услуги как до завершения)
  useEffect(() => {
    setDiagnosis(visit.diagnosis || '');
    const rawComposites = visit.applied_composites;
    const composites = Array.isArray(rawComposites)
      ? rawComposites
          .filter(c => c && typeof c === 'object' && c.composite_service_id != null)
          .map(c => ({ composite_service_id: c.composite_service_id, quantity: c.quantity || 1 }))
      : [];
    setSelectedComposites(composites);
    setSelectedServices(visit.services || []);
    setSelectedMaterials(visit.materials || []);
    setExpandedCompositeIds([]);
  }, [visit]);

  const toggleService = (serviceId) => {
    const existing = selectedServices.find(s => s.service_id === serviceId);
    if (existing) {
      setSelectedServices(selectedServices.filter(s => s.service_id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, { service_id: serviceId, quantity: 1 }]);
    }
  };


  const removeService = (serviceId) => {
    setSelectedServices(selectedServices.filter(s => s.service_id !== serviceId));
  };

  const updateServiceQuantity = (serviceId, quantity) => {
    setSelectedServices(selectedServices.map(s => 
      s.service_id === serviceId ? { ...s, quantity: parseInt(quantity) || 1 } : s
    ));
  };

  const toggleMaterial = (materialId) => {
    const existing = selectedMaterials.find(m => m.material_id === materialId);
    if (existing) {
      setSelectedMaterials(selectedMaterials.filter(m => m.material_id !== materialId));
    } else {
      setSelectedMaterials([...selectedMaterials, { material_id: materialId, quantity: 1 }]);
    }
  };


  const removeMaterial = (materialId) => {
    setSelectedMaterials(selectedMaterials.filter(m => m.material_id !== materialId));
  };

  const updateMaterialQuantity = (materialId, quantity) => {
    setSelectedMaterials(selectedMaterials.map(m => 
      m.material_id === materialId ? { ...m, quantity: parseFloat(quantity) || 1 } : m
    ));
  };

  // Применить составную услугу — добавляем в selectedComposites, не разворачиваем в services/materials
  const handleApplyCompositeService = (compositeService) => {
    setSelectedComposites(prev => {
      const existing = prev.find(c => c.composite_service_id === compositeService.id);
      if (existing) {
        return prev.map(c =>
          c.composite_service_id === compositeService.id
            ? { ...c, quantity: (c.quantity || 1) + 1 }
            : c
        );
      }
      return [...prev, { composite_service_id: compositeService.id, quantity: 1 }];
    });
    setActiveSection('services');
    setCompositeServiceSearch('');
    if (toast) toast.info(`✅ Составная услуга «${compositeService.name}» добавлена`);
    else alert(`✅ Составная услуга «${compositeService.name}» добавлена`);
  };

  const removeComposite = (compositeServiceId) => {
    setSelectedComposites(prev => prev.filter(c => c.composite_service_id !== compositeServiceId));
    setExpandedCompositeIds(prev => prev.filter(id => id !== compositeServiceId));
  };

  const updateCompositeQuantity = (compositeServiceId, qty) => {
    const v = parseInt(qty, 10);
    if (isNaN(v) || v < 1) return;
    setSelectedComposites(prev =>
      prev.map(c =>
        c.composite_service_id === compositeServiceId ? { ...c, quantity: v } : c
      )
    );
  };

  const toggleCompositeExpanded = (id) => {
    setExpandedCompositeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Стоимость составной услуги (подуслуги + материалы) с учётом quantity
  const getCompositeTotal = (composite, qty = 1) => {
    let total = 0;
    (composite.services || []).forEach(cs => {
      const s = services.find(x => x.id === (cs.service_id || cs.id));
      total += (s?.price || cs.price || 0) * (cs.quantity || 1) * qty;
    });
    (composite.materials || []).forEach(cm => {
      const m = materials.find(x => x.id === (cm.material_id || cm.id));
      total += (m?.price || cm.price || 0) * (cm.quantity || 1) * qty;
    });
    return total.toFixed(2);
  };

  const handleSubmit = async () => {
    if (!diagnosis.trim()) {
      if (toast) toast.warning('Пожалуйста, введите диагноз');
      else alert('Пожалуйста, введите диагноз');
      return;
    }
    const hasServices = selectedServices.length > 0 || selectedComposites.length > 0;
    if (!hasServices) {
      if (toast) toast.warning('Пожалуйста, выберите хотя бы одну услугу');
      else alert('Пожалуйста, выберите хотя бы одну услугу');
      return;
    }

    // Разворачиваем составные в услуги и материалы, объединяем с выбранными вручную
    const servicesByKey = {}; // { service_id: quantity }
    selectedServices.forEach(s => {
      const id = parseInt(s.service_id, 10);
      if (isNaN(id)) return;
      servicesByKey[id] = (servicesByKey[id] || 0) + (parseInt(s.quantity, 10) || 1);
    });
    selectedComposites.forEach(item => {
      const cs = compositeServices.find(c => c.id === item.composite_service_id);
      if (!cs) return;
      const qty = parseInt(item.quantity, 10) || 1;
      (cs.services || []).forEach(s => {
        const id = parseInt(s.service_id || s.id, 10);
        if (isNaN(id)) return;
        const add = (parseInt(s.quantity, 10) || 1) * qty;
        servicesByKey[id] = (servicesByKey[id] || 0) + add;
      });
    });

    const materialsByKey = {}; // { material_id: quantity }
    (selectedMaterials || []).forEach(m => {
      const id = parseInt(m.material_id, 10);
      if (isNaN(id)) return;
      materialsByKey[id] = (materialsByKey[id] || 0) + (parseFloat(m.quantity) || 1);
    });
    selectedComposites.forEach(item => {
      const cs = compositeServices.find(c => c.id === item.composite_service_id);
      if (!cs) return;
      const qty = parseInt(item.quantity, 10) || 1;
      (cs.materials || []).forEach(m => {
        const id = parseInt(m.material_id || m.id, 10);
        if (isNaN(id)) return;
        const add = (parseFloat(m.quantity) || 1) * qty;
        materialsByKey[id] = (materialsByKey[id] || 0) + add;
      });
    });

    const normalizedServices = Object.entries(servicesByKey).map(([id, q]) => ({
      service_id: parseInt(id, 10),
      quantity: q
    }));
    const normalizedMaterials = Object.entries(materialsByKey).map(([id, q]) => ({
      material_id: parseInt(id, 10),
      quantity: parseFloat(q)
    }));

    if (normalizedServices.length === 0) {
      if (toast) toast.error('Ошибка: нет валидных услуг для сохранения. Пожалуйста, выберите услуги заново.');
      else alert('Ошибка: нет валидных услуг для сохранения. Пожалуйста, выберите услуги заново.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Сохраняем прием
      await axios.patch(`${API_URL}/appointments/${visit.id}/complete-visit`, {
        diagnosis,
        services: normalizedServices,
        materials: normalizedMaterials,
        treatment_plan: treatmentPlan,
        applied_composites: selectedComposites
      });
      
      // Отправляем событие для обновления списка записей
      window.dispatchEvent(new Event('appointmentUpdated'));
      // Отправляем событие для обновления данных клиента (включая план лечения)
      window.dispatchEvent(new Event('clientDataUpdated'));
      
      onSuccess();
    } catch (error) {
      console.error('Ошибка завершения приема:', error);
      console.error('Отправленные данные:', { 
        services: normalizedServices, 
        materials: normalizedMaterials 
      });
      if (toast) toast.error(`Ошибка завершения приема: ${error.response?.data?.error || error.message}`);
      else alert(`Ошибка завершения приема: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="complete-visit-form">
      <h3>👨‍⚕️ Завершение приема</h3>

      {isPaid && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: '#e8f5e9', 
          borderRadius: '8px',
          border: '2px solid #4caf50'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '2em', marginRight: '10px' }}>✅</span>
            <strong style={{ fontSize: '1.2em', color: '#2e7d32' }}>Прием оплачен</strong>
          </div>
          <p style={{ textAlign: 'center', color: '#666', margin: 0 }}>
            Прием успешно оплачен. Изменения недоступны.
          </p>
        </div>
      )}

      {/* Диагноз */}
      <div className="form-section">
        <label className="form-label">Диагноз *</label>
        <textarea
          className="diagnosis-input"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="Введите диагноз..."
          rows={4}
          required
          disabled={isPaid}
        />
      </div>

      {/* План лечения */}
      <div className="form-section">
        <label className="form-label">📋 План лечения</label>
        <textarea
          className="diagnosis-input"
          value={treatmentPlan}
          onChange={(e) => setTreatmentPlan(e.target.value)}
          placeholder="Введите план лечения пациента (каждый пункт с новой строки)..."
          rows={8}
          disabled={isPaid}
        />
        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '8px' }}>
          💡 Каждый пункт плана лечения будет автоматически пронумерован
        </div>
      </div>

      {/* Услуги и материалы с вкладками */}
      <div className="form-section">
        <div className="services-materials-tabs">
          <button
            type="button"
            className={`section-tab ${activeSection === 'composite' ? 'active' : ''}`}
            onClick={() => setActiveSection('composite')}
          >
            🔧 Готовые услуги
          </button>
          <button
            type="button"
            className={`section-tab ${activeSection === 'services' ? 'active' : ''}`}
            onClick={() => setActiveSection('services')}
          >
            📋 Услуги
            {(selectedServices.length + selectedComposites.length) > 0 && (
              <span className="tab-badge">{selectedServices.length + selectedComposites.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`section-tab ${activeSection === 'materials' ? 'active' : ''}`}
            onClick={() => setActiveSection('materials')}
          >
            📦 Материалы
            {selectedMaterials.length > 0 && (
              <span className="tab-badge">{selectedMaterials.length}</span>
            )}
          </button>
        </div>

        {/* Контент составных услуг */}
        {activeSection === 'composite' && (
          <div className="section-content">
            <label className="form-label">Готовые составные услуги</label>
            <p className="form-hint">Выберите готовую услугу, чтобы автоматически добавить все подуслуги и материалы</p>
            
            <div className="search-box" style={{ marginBottom: '15px' }}>
              <input
                type="text"
                placeholder="🔍 Поиск готовой услуги..."
                value={compositeServiceSearch}
                onChange={(e) => setCompositeServiceSearch(e.target.value)}
                className="page-search-input"
              />
            </div>

            <div className="composite-services-selector">
              {compositeServices
                .filter(cs => {
                  const search = compositeServiceSearch.toLowerCase();
                  return cs.name.toLowerCase().includes(search) ||
                         (cs.category && cs.category.toLowerCase().includes(search));
                })
                .map(cs => (
                  <div 
                    key={cs.id} 
                    className="composite-service-option" 
                    onClick={() => !isPaid && handleApplyCompositeService(cs)}
                    style={isPaid ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                  >
                    <div className="composite-service-header">
                      <h4>{cs.name}</h4>
                      {cs.category && <span className="composite-service-category">{cs.category}</span>}
                    </div>
                    {cs.description && <p className="composite-service-description">{cs.description}</p>}
                    <div className="composite-service-details">
                      <span>📋 {cs.services?.length || 0} подуслуг</span>
                      {cs.materials && cs.materials.length > 0 && (
                        <span>📦 {cs.materials.length} материалов</span>
                      )}
                    </div>
                    <button type="button" className="btn btn-primary btn-small" style={{ marginTop: '10px' }}>
                      ➕ Применить
                    </button>
                  </div>
                ))}
              
              {compositeServices.filter(cs => {
                const search = compositeServiceSearch.toLowerCase();
                return cs.name.toLowerCase().includes(search) ||
                       (cs.category && cs.category.toLowerCase().includes(search));
              }).length === 0 && (
                <div className="empty-state">
                  <p>{compositeServiceSearch ? 'Готовые услуги не найдены' : 'Нет готовых составных услуг'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Контент услуг */}
        {activeSection === 'services' && (
          <div className="section-content">
            <label className="form-label">Проведенные услуги *</label>
            <ServiceMaterialSelector
              items={services}
              selectedItems={selectedServices}
              onToggleItem={toggleService}
              onUpdateQuantity={updateServiceQuantity}
              onRemoveItem={removeService}
              type="service"
              searchQuery={serviceSearch}
              onSearchChange={setServiceSearch}
            />
            
            {/* Список выбранных: составные (название + стоимость, по клику — аккордеон), потом точечные */}
            {(selectedComposites.length > 0 || selectedServices.length > 0) && (
              <div className="selected-items-simple">
                {/* Составные услуги: одна строка — название и сумма, по клику раскрываются подуслуги */}
                {selectedComposites.map(item => {
                  const cs = compositeServices.find(c => c.id === item.composite_service_id);
                  if (!cs) return null;
                  const total = getCompositeTotal(cs, item.quantity || 1);
                  const isExpanded = expandedCompositeIds.includes(cs.id);
                  const qty = item.quantity || 1;
                  return (
                    <div key={'composite-' + cs.id} className="selected-item-simple selected-item-composite">
                      <div
                        className="composite-row-main"
                        onClick={() => toggleCompositeExpanded(cs.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCompositeExpanded(cs.id)}
                      >
                        <span className="item-name-simple">
                          🔧 {cs.name}
                          <span className="composite-chevron">{isExpanded ? ' ▼' : ' ▶'}</span>
                        </span>
                        <div className="item-controls-simple" onClick={e => e.stopPropagation()}>
                          <label className="quantity-label-inline">
                            Кол-во:
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity || 1}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => updateCompositeQuantity(cs.id, e.target.value)}
                              className="quantity-input-simple"
                              disabled={isPaid}
                            />
                          </label>
                          <div className="item-total-simple">Итого: {total} BYN</div>
                          <button
                            type="button"
                            className="btn-remove-simple"
                            onClick={() => removeComposite(cs.id)}
                            title="Удалить"
                            disabled={isPaid}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="composite-accordion-body">
                          {(cs.services || []).length > 0 && (
                            <>
                              <div className="composite-sub-title">Подуслуги</div>
                              <ul className="composite-sub-list">
                                {(cs.services || []).map(s => {
                                  const svc = services.find(x => x.id === (s.service_id || s.id));
                                  const name = svc?.name || s.name || '—';
                                  const price = svc?.price ?? s.price ?? 0;
                                  const subQty = (s.quantity || 1) * qty;
                                  const subTotal = (price * subQty).toFixed(2);
                                  return (
                                    <li key={s.service_id || s.id}>
                                      {name} × {subQty} — {subTotal} BYN
                                    </li>
                                  );
                                })}
                              </ul>
                            </>
                          )}
                          {(cs.materials || []).length > 0 && (
                            <>
                              <div className="composite-sub-title">Материалы</div>
                              <ul className="composite-sub-list">
                                {(cs.materials || []).map(m => {
                                  const mat = materials.find(x => x.id === (m.material_id || m.id));
                                  const name = mat?.name || m.name || '—';
                                  const unit = mat?.unit || m.unit || 'шт';
                                  const price = mat?.price ?? m.price ?? 0;
                                  const subQty = (m.quantity || 1) * qty;
                                  const subTotal = (price * subQty).toFixed(2);
                                  return (
                                    <li key={m.material_id || m.id}>
                                      {name} × {subQty} {unit} — {subTotal} BYN
                                    </li>
                                  );
                                })}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Точечные услуги — как раньше */}
                {selectedServices.map(item => {
                  const service = services.find(s => s.id === item.service_id);
                  if (!service) return null;
                  const itemTotal = (service.price || 0) * (item.quantity || 1);
                  return (
                    <div key={item.service_id} className="selected-item-simple">
                      <span className="item-name-simple">{service.name}</span>
                      <div className="item-controls-simple">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateServiceQuantity(item.service_id, e.target.value)}
                          className="quantity-input-simple"
                        />
                        <div style={{ 
                          fontWeight: 'bold', 
                          color: '#667eea',
                          marginLeft: '10px',
                          minWidth: '100px',
                          textAlign: 'right'
                        }}>
                          <div style={{ fontSize: '0.85rem', marginBottom: '2px' }}>
                            Кол-во: {item.quantity || 1}
                          </div>
                          <div>
                            Итого: {itemTotal.toFixed(2)} BYN
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-simple"
                          onClick={() => removeService(item.service_id)}
                          title="Удалить"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Контент материалов */}
        {activeSection === 'materials' && (
          <div className="section-content">
            <label className="form-label">Использованные материалы</label>
            <ServiceMaterialSelector
              items={materials}
              selectedItems={selectedMaterials}
              onToggleItem={isPaid ? () => {} : toggleMaterial}
              onUpdateQuantity={isPaid ? () => {} : updateMaterialQuantity}
              onRemoveItem={isPaid ? () => {} : removeMaterial}
              type="material"
              searchQuery={materialSearch}
              onSearchChange={isPaid ? () => {} : setMaterialSearch}
              disabled={isPaid}
            />
            
            {/* Простой список выбранных материалов */}
            {selectedMaterials.length > 0 && (
              <div className="selected-items-simple">
                {selectedMaterials.map(item => {
                  const material = materials.find(m => m.id === item.material_id);
                  if (!material) return null;
                  const itemTotal = (material.price || 0) * (item.quantity || 1);
                  return (
                    <div key={item.material_id} className="selected-item-simple">
                      <span className="item-name-simple">
                        {material.name} <span className="unit-label-simple">({material.unit})</span>
                      </span>
                      <div className="item-controls-simple">
                        <input
                          type="number"
                          min="0.1"
                          step="1"
                          value={item.quantity}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateMaterialQuantity(item.material_id, e.target.value)}
                          className="quantity-input-simple"
                          disabled={isPaid}
                        />
                        <div style={{ 
                          fontWeight: 'bold', 
                          color: '#667eea',
                          marginLeft: '10px',
                          minWidth: '100px',
                          textAlign: 'right'
                        }}>
                          <div style={{ fontSize: '0.85rem', marginBottom: '2px' }}>
                            Кол-во: {item.quantity || 1}
                          </div>
                          <div>
                            Итого: {itemTotal.toFixed(2)} BYN
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-simple"
                          onClick={() => removeMaterial(item.material_id)}
                          title="Удалить"
                          disabled={isPaid}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Общая сумма */}
      {((selectedServices.length > 0) || (selectedMaterials.length > 0) || (selectedComposites.length > 0)) && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '10px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.1rem', marginBottom: '5px' }}>💰 Общая сумма:</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
            {(() => {
              const servicesTotal = selectedServices.reduce((sum, item) => {
                const service = services.find(s => s.id === item.service_id);
                return sum + ((service?.price || 0) * (item.quantity || 1));
              }, 0);
              const materialsTotal = selectedMaterials.reduce((sum, item) => {
                const material = materials.find(m => m.id === item.material_id);
                return sum + ((material?.price || 0) * (item.quantity || 1));
              }, 0);
              const compositesTotal = selectedComposites.reduce((sum, item) => {
                const cs = compositeServices.find(c => c.id === item.composite_service_id);
                return sum + (cs ? parseFloat(getCompositeTotal(cs, item.quantity || 1)) : 0);
              }, 0);
              return (servicesTotal + materialsTotal + compositesTotal).toFixed(2);
            })()} BYN
          </div>
        </div>
      )}

      {/* Кнопки */}
      <div className="form-actions">
        <button className="btn btn-secondary" onClick={onCancel} disabled={isSubmitting || isPaid}>
          Отмена
        </button>
        {isPaid ? (
          <button className="btn btn-primary" disabled style={{ opacity: 0.6 }}>
            ✅ Прием оплачен
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Сохранение...' : '✅ Завершить прием'}
          </button>
        )}
      </div>
    </div>
  );
};

export default CompleteVisit;

