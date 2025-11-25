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

  // Обновляем данные при изменении visit (для редактирования)
  useEffect(() => {
    setDiagnosis(visit.diagnosis || '');
    setSelectedServices(visit.services || []);
    setSelectedMaterials(visit.materials || []);
    // План лечения не обновляем здесь, он загружается отдельно из базы данных
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

  // Применить составную услугу
  const handleApplyCompositeService = (compositeService) => {
    // Добавляем все подуслуги
    const newServices = [...selectedServices];
    compositeService.services.forEach(csService => {
      // API может возвращать данные с полем id вместо service_id
      const serviceId = csService.service_id || csService.id;
      if (!serviceId) {
        console.warn('Пропущена услуга без ID:', csService);
        return;
      }
      
      const existing = newServices.find(s => s.service_id === serviceId);
      if (existing) {
        // Если услуга уже есть, увеличиваем количество
        existing.quantity = (existing.quantity || 1) + (csService.quantity || 1);
      } else {
        // Добавляем новую услугу
        newServices.push({
          service_id: parseInt(serviceId),
          quantity: parseInt(csService.quantity) || 1
        });
      }
    });
    setSelectedServices(newServices);

    // Добавляем все материалы
    if (compositeService.materials && compositeService.materials.length > 0) {
      const newMaterials = [...selectedMaterials];
      compositeService.materials.forEach(csMaterial => {
        // API может возвращать данные с полем id вместо material_id
        const materialId = csMaterial.material_id || csMaterial.id;
        if (!materialId) {
          console.warn('Пропущен материал без ID:', csMaterial);
          return;
        }
        
        const existing = newMaterials.find(m => m.material_id === materialId);
        if (existing) {
          // Если материал уже есть, увеличиваем количество
          existing.quantity = (existing.quantity || 1) + (csMaterial.quantity || 1);
        } else {
          // Добавляем новый материал
          newMaterials.push({
            material_id: parseInt(materialId),
            quantity: parseFloat(csMaterial.quantity) || 1
          });
        }
      });
      setSelectedMaterials(newMaterials);
    }

    // Переключаемся на вкладку услуг, чтобы показать добавленные
    setActiveSection('services');
    setCompositeServiceSearch('');
    
    // Показываем информацию о добавленных элементах
    const addedServicesCount = compositeService.services?.length || 0;
    const addedMaterialsCount = compositeService.materials?.length || 0;
    let message = `✅ Составная услуга "${compositeService.name}" применена!\n\n`;
    message += `Добавлено:\n`;
    message += `- Подуслуг: ${addedServicesCount}\n`;
    if (addedMaterialsCount > 0) {
      message += `- Материалов: ${addedMaterialsCount}`;
    }
    if (toast) {
      toast.info(message);
    } else {
      alert(message);
    }
  };

  const handleSubmit = async () => {
    if (!diagnosis.trim()) {
      if (toast) toast.warning('Пожалуйста, введите диагноз');
      else alert('Пожалуйста, введите диагноз');
      return;
    }
    if (selectedServices.length === 0) {
      if (toast) toast.warning('Пожалуйста, выберите хотя бы одну услугу');
      else alert('Пожалуйста, выберите хотя бы одну услугу');
      return;
    }

    // Валидация и нормализация данных перед отправкой
    const normalizedServices = selectedServices
      .filter(s => s.service_id != null) // Убираем записи без service_id
      .map(s => ({
        service_id: parseInt(s.service_id),
        quantity: parseInt(s.quantity) || 1
      }))
      .filter(s => !isNaN(s.service_id)); // Убираем записи с невалидным ID
    
    const normalizedMaterials = (selectedMaterials || [])
      .filter(m => m.material_id != null) // Убираем записи без material_id
      .map(m => ({
        material_id: parseInt(m.material_id),
        quantity: parseFloat(m.quantity) || 1
      }))
      .filter(m => !isNaN(m.material_id)); // Убираем записи с невалидным ID

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
        treatment_plan: treatmentPlan
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
            {selectedServices.length > 0 && (
              <span className="tab-badge">{selectedServices.length}</span>
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
            
            {/* Простой список выбранных услуг */}
            {selectedServices.length > 0 && (
              <div className="selected-items-simple">
                {selectedServices.map(item => {
                  const service = services.find(s => s.id === item.service_id);
                  if (!service) return null;
                  return (
                    <div key={item.service_id} className="selected-item-simple">
                      <span className="item-name-simple">{service.name}</span>
                      <div className="item-controls-simple">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateServiceQuantity(item.service_id, e.target.value)}
                          className="quantity-input-simple"
                        />
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
                  return (
                    <div key={item.material_id} className="selected-item-simple">
                      <span className="item-name-simple">
                        {material.name} <span className="unit-label-simple">({material.unit})</span>
                      </span>
                      <div className="item-controls-simple">
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={item.quantity}
                          onChange={(e) => updateMaterialQuantity(item.material_id, e.target.value)}
                          className="quantity-input-simple"
                          disabled={isPaid}
                        />
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

