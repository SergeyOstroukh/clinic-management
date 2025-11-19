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

const CompleteVisit = ({ visit, services, materials, onSuccess, onCancel }) => {
  const [diagnosis, setDiagnosis] = useState(visit.diagnosis || '');
  const [selectedServices, setSelectedServices] = useState(visit.services || []);
  const [selectedMaterials, setSelectedMaterials] = useState(visit.materials || []);
  const [serviceSearch, setServiceSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState('services'); // 'services' или 'materials'

  // Обновляем данные при изменении visit (для редактирования)
  useEffect(() => {
    setDiagnosis(visit.diagnosis || '');
    setSelectedServices(visit.services || []);
    setSelectedMaterials(visit.materials || []);
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

  const handleSubmit = async () => {
    if (!diagnosis.trim()) {
      alert('Пожалуйста, введите диагноз');
      return;
    }
    if (selectedServices.length === 0) {
      alert('Пожалуйста, выберите хотя бы одну услугу');
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.patch(`${API_URL}/appointments/${visit.id}/complete-visit`, {
        diagnosis,
        services: selectedServices,
        materials: selectedMaterials
      });
      
      // Отправляем событие для обновления списка записей
      window.dispatchEvent(new Event('appointmentUpdated'));
      
      onSuccess();
    } catch (error) {
      console.error('Ошибка завершения приема:', error);
      alert(`Ошибка завершения приема: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="complete-visit-form">
      <h3>👨‍⚕️ Завершение приема</h3>

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
        />
      </div>

      {/* Услуги и материалы с вкладками */}
      <div className="form-section">
        <div className="services-materials-tabs">
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
              onToggleItem={toggleMaterial}
              onUpdateQuantity={updateMaterialQuantity}
              onRemoveItem={removeMaterial}
              type="material"
              searchQuery={materialSearch}
              onSearchChange={setMaterialSearch}
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
                        />
                        <button
                          type="button"
                          className="btn-remove-simple"
                          onClick={() => removeMaterial(item.material_id)}
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
      </div>

      {/* Кнопки */}
      <div className="form-actions">
        <button className="btn btn-secondary" onClick={onCancel} disabled={isSubmitting}>
          Отмена
        </button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Сохранение...' : '✅ Завершить прием'}
        </button>
      </div>
    </div>
  );
};

export default CompleteVisit;

