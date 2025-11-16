import React, { useState } from 'react';
import axios from 'axios';
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
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addService = (serviceId) => {
    const existing = selectedServices.find(s => s.service_id === serviceId);
    if (!existing) {
      setSelectedServices([...selectedServices, { service_id: serviceId, quantity: 1 }]);
    }
    setServiceSearch('');
  };

  const removeService = (serviceId) => {
    setSelectedServices(selectedServices.filter(s => s.service_id !== serviceId));
  };

  const updateServiceQuantity = (serviceId, quantity) => {
    setSelectedServices(selectedServices.map(s => 
      s.service_id === serviceId ? { ...s, quantity: parseInt(quantity) || 1 } : s
    ));
  };

  const addMaterial = (materialId) => {
    const existing = selectedMaterials.find(m => m.material_id === materialId);
    if (!existing) {
      setSelectedMaterials([...selectedMaterials, { material_id: materialId, quantity: 1 }]);
    }
    setMaterialSearch('');
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
      onSuccess();
    } catch (error) {
      alert('Ошибка завершения приема');
      console.error(error);
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

      {/* Услуги */}
      <div className="form-section">
        <label className="form-label">Проведенные процедуры *</label>
        
        <div className="search-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Поиск процедуры..."
            value={serviceSearch}
            onChange={(e) => setServiceSearch(e.target.value)}
          />
          {serviceSearch && (
            <div className="search-dropdown">
              {services.filter(s => 
                s.name.toLowerCase().includes(serviceSearch.toLowerCase())
              ).map(service => {
                const alreadyAdded = selectedServices.find(s => s.service_id === service.id);
                return (
                  <div
                    key={service.id}
                    className={`dropdown-item ${alreadyAdded ? 'disabled' : ''}`}
                    onClick={() => !alreadyAdded && addService(service.id)}
                  >
                    <strong>{service.name}</strong>
                    {alreadyAdded && <span className="added-mark">✓</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedServices.length > 0 && (
          <div className="selected-items">
            {selectedServices.map(item => {
              const service = services.find(s => s.id === item.service_id);
              if (!service) return null;
              return (
                <div key={item.service_id} className="selected-item">
                  <div className="item-name">{service.name}</div>
                  <div className="item-controls">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateServiceQuantity(item.service_id, e.target.value)}
                      className="quantity-input"
                    />
                    <button
                      className="btn-remove"
                      onClick={() => removeService(item.service_id)}
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

      {/* Материалы */}
      <div className="form-section">
        <label className="form-label">Использованные материалы</label>
        
        <div className="search-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Поиск материала..."
            value={materialSearch}
            onChange={(e) => setMaterialSearch(e.target.value)}
          />
          {materialSearch && (
            <div className="search-dropdown">
              {materials.filter(m => 
                m.name.toLowerCase().includes(materialSearch.toLowerCase())
              ).map(material => {
                const alreadyAdded = selectedMaterials.find(m => m.material_id === material.id);
                return (
                  <div
                    key={material.id}
                    className={`dropdown-item ${alreadyAdded ? 'disabled' : ''}`}
                    onClick={() => !alreadyAdded && addMaterial(material.id)}
                  >
                    <strong>{material.name}</strong>
                    <span className="material-unit"> ({material.unit})</span>
                    {alreadyAdded && <span className="added-mark">✓</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedMaterials.length > 0 && (
          <div className="selected-items">
            {selectedMaterials.map(item => {
              const material = materials.find(m => m.id === item.material_id);
              if (!material) return null;
              return (
                <div key={item.material_id} className="selected-item">
                  <div className="item-name">
                    {material.name} <span className="unit-label">({material.unit})</span>
                  </div>
                  <div className="item-controls">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) => updateMaterialQuantity(item.material_id, e.target.value)}
                      className="quantity-input"
                    />
                    <button
                      className="btn-remove"
                      onClick={() => removeMaterial(item.material_id)}
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

