import React, { useState } from 'react';
import ServiceMaterialSelector from './ServiceMaterialSelector/ServiceMaterialSelector';
import './DoctorVisitForm.css';

const DoctorVisitForm = ({ visit, services, materials, onComplete, onCancel }) => {
  const [diagnosis, setDiagnosis] = useState(visit.diagnosis || '');
  const [selectedServices, setSelectedServices] = useState(visit.services || []);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');

  const toggleService = (serviceId) => {
    const existing = selectedServices.find(s => s.service_id === serviceId);
    if (existing) {
      setSelectedServices(selectedServices.filter(s => s.service_id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, { service_id: serviceId, quantity: 1 }]);
    }
  };

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

  const toggleMaterial = (materialId) => {
    const existing = selectedMaterials.find(m => m.material_id === materialId);
    if (existing) {
      setSelectedMaterials(selectedMaterials.filter(m => m.material_id !== materialId));
    } else {
      setSelectedMaterials([...selectedMaterials, { material_id: materialId, quantity: 1 }]);
    }
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

  const handleSubmit = () => {
    if (!diagnosis.trim()) {
      alert('Пожалуйста, введите диагноз');
      return;
    }
    if (selectedServices.length === 0) {
      alert('Пожалуйста, выберите хотя бы одну услугу');
      return;
    }
    onComplete({
      diagnosis,
      services: selectedServices,
      materials: selectedMaterials
    });
  };

  return (
    <div className="doctor-visit-form">
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
        
        {/* Селектор услуг с аккордеоном */}
        <ServiceMaterialSelector
          items={services}
          selectedItems={selectedServices}
          onToggleItem={toggleService}
          type="service"
          searchQuery={serviceSearch}
          onSearchChange={setServiceSearch}
        />

        {/* Выбранные услуги */}
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
        
        {/* Селектор материалов с аккордеоном */}
        <ServiceMaterialSelector
          items={materials}
          selectedItems={selectedMaterials}
          onToggleItem={toggleMaterial}
          type="material"
          searchQuery={materialSearch}
          onSearchChange={setMaterialSearch}
        />

        {/* Выбранные материалы */}
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
        <button className="btn btn-secondary" onClick={onCancel}>
          Отмена
        </button>
        <button className="btn btn-primary" onClick={handleSubmit}>
          ✅ Завершить прием
        </button>
      </div>
    </div>
  );
};

export default DoctorVisitForm;

