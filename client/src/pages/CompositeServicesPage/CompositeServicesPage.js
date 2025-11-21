import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ServiceMaterialSelector from '../../components/ServiceMaterialSelector/ServiceMaterialSelector';
import './CompositeServicesPage.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

const CompositeServicesPage = ({ onNavigate, services, materials }) => {
  const [compositeServices, setCompositeServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedServiceForDetails, setSelectedServiceForDetails] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Форма составной услуги
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    is_active: true,
    services: [],
    materials: []
  });
  
  // Поиск для выбора услуг и материалов
  const [serviceSearch, setServiceSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');

  // Расчет общей стоимости составной услуги
  const calculateTotalPrice = useMemo(() => {
    return (compositeService) => {
      let total = 0;
      
      // Стоимость подуслуг
      if (compositeService.services && compositeService.services.length > 0) {
        compositeService.services.forEach(csService => {
          // API возвращает данные с полем id в объекте service, но также может быть service_id
          const serviceId = csService.service_id || csService.id;
          const service = services.find(s => s.id === serviceId);
          if (service) {
            total += (service.price || 0) * (csService.quantity || 1);
          } else if (csService.price) {
            // Если не нашли в списке, используем цену из данных API
            total += (csService.price || 0) * (csService.quantity || 1);
          }
        });
      }
      
      // Стоимость материалов
      if (compositeService.materials && compositeService.materials.length > 0) {
        compositeService.materials.forEach(csMaterial => {
          const materialId = csMaterial.material_id || csMaterial.id;
          const material = materials.find(m => m.id === materialId);
          if (material) {
            total += (material.price || 0) * (csMaterial.quantity || 1);
          } else if (csMaterial.price) {
            // Если не нашли в списке, используем цену из данных API
            total += (csMaterial.price || 0) * (csMaterial.quantity || 1);
          }
        });
      }
      
      return total.toFixed(2);
    };
  }, [services, materials]);

  // Расчет стоимости для формы
  const formTotalPrice = useMemo(() => {
    let total = 0;
    
    // Стоимость подуслуг
    formData.services.forEach(item => {
      const service = services.find(s => s.id === item.service_id);
      if (service) {
        total += (service.price || 0) * (item.quantity || 1);
      }
    });
    
    // Стоимость материалов
    formData.materials.forEach(item => {
      const material = materials.find(m => m.id === item.material_id);
      if (material) {
        total += (material.price || 0) * (item.quantity || 1);
      }
    });
    
    return total.toFixed(2);
  }, [formData.services, formData.materials, services, materials]);

  useEffect(() => {
    loadCompositeServices();
  }, []);

  const loadCompositeServices = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/composite-services`);
      setCompositeServices(response.data);
    } catch (error) {
      console.error('Ошибка загрузки составных услуг:', error);
      alert('Ошибка загрузки составных услуг');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (service = null) => {
    if (service) {
      setEditingService(service);
      // Нормализуем данные при загрузке - убеждаемся, что есть service_id и material_id
      const normalizedServices = (service.services || []).map(s => ({
        service_id: parseInt(s.service_id || s.id),
        quantity: parseInt(s.quantity) || 1
      }));
      
      const normalizedMaterials = (service.materials || []).map(m => ({
        material_id: parseInt(m.material_id || m.id),
        quantity: parseFloat(m.quantity) || 1
      }));
      
      setFormData({
        name: service.name,
        description: service.description || '',
        category: service.category || '',
        is_active: service.is_active !== false,
        services: normalizedServices,
        materials: normalizedMaterials
      });
    } else {
      setEditingService(null);
      setFormData({
        name: '',
        description: '',
        category: '',
        is_active: true,
        services: [],
        materials: []
      });
    }
    setServiceSearch('');
    setMaterialSearch('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      category: '',
      is_active: true,
      services: [],
      materials: []
    });
  };

  const handleToggleService = (serviceId) => {
    const existing = formData.services.find(s => s.service_id === serviceId);
    if (existing) {
      setFormData({
        ...formData,
        services: formData.services.filter(s => s.service_id !== serviceId)
      });
    } else {
      setFormData({
        ...formData,
        services: [...formData.services, { service_id: serviceId, quantity: 1 }]
      });
    }
  };

  const handleRemoveService = (serviceId) => {
    setFormData({
      ...formData,
      services: formData.services.filter(s => s.service_id !== serviceId)
    });
  };

  const handleUpdateServiceQuantity = (serviceId, quantity) => {
    setFormData({
      ...formData,
      services: formData.services.map(s =>
        s.service_id === serviceId ? { ...s, quantity: parseInt(quantity) || 1 } : s
      )
    });
  };

  const handleToggleMaterial = (materialId) => {
    const existing = formData.materials.find(m => m.material_id === materialId);
    if (existing) {
      setFormData({
        ...formData,
        materials: formData.materials.filter(m => m.material_id !== materialId)
      });
    } else {
      setFormData({
        ...formData,
        materials: [...formData.materials, { material_id: materialId, quantity: 1 }]
      });
    }
  };

  const handleRemoveMaterial = (materialId) => {
    setFormData({
      ...formData,
      materials: formData.materials.filter(m => m.material_id !== materialId)
    });
  };

  const handleUpdateMaterialQuantity = (materialId, quantity) => {
    setFormData({
      ...formData,
      materials: formData.materials.map(m =>
        m.material_id === materialId ? { ...m, quantity: parseFloat(quantity) || 1 } : m
      )
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Введите название составной услуги');
      return;
    }
    
    if (formData.services.length === 0) {
      alert('Добавьте хотя бы одну подуслугу');
      return;
    }
    
    // Проверяем и нормализуем данные перед отправкой
    const normalizedServices = formData.services
      .filter(s => s.service_id != null) // Убираем записи без service_id
      .map(s => ({
        service_id: parseInt(s.service_id),
        quantity: parseInt(s.quantity) || 1
      }));
    
    const normalizedMaterials = (formData.materials || [])
      .filter(m => m.material_id != null) // Убираем записи без material_id
      .map(m => ({
        material_id: parseInt(m.material_id),
        quantity: parseFloat(m.quantity) || 1
      }));
    
    if (normalizedServices.length === 0) {
      alert('Добавьте хотя бы одну подуслугу');
      return;
    }
    
    const dataToSend = {
      ...formData,
      services: normalizedServices,
      materials: normalizedMaterials
    };
    
    try {
      if (editingService) {
        await axios.put(`${API_URL}/composite-services/${editingService.id}`, dataToSend);
      } else {
        await axios.post(`${API_URL}/composite-services`, dataToSend);
      }
      
      handleCloseModal();
      loadCompositeServices();
    } catch (error) {
      console.error('Ошибка сохранения составной услуги:', error);
      alert(`Ошибка сохранения: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить составную услугу?')) return;
    
    try {
      await axios.delete(`${API_URL}/composite-services/${id}`);
      loadCompositeServices();
    } catch (error) {
      console.error('Ошибка удаления:', error);
      alert('Ошибка удаления составной услуги');
    }
  };

  const filteredServices = compositeServices.filter(cs => {
    const search = searchQuery.toLowerCase();
    return cs.name.toLowerCase().includes(search) ||
           (cs.category && cs.category.toLowerCase().includes(search));
  });

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="composite-services-page">
      <div className="section-header">
        <h2>🔧 Конструктор составных услуг ({filteredServices.length})</h2>
        <div>
          <button className="btn" onClick={() => onNavigate('home')}>← Назад</button>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            + Создать составную услугу
          </button>
        </div>
      </div>

      {/* Поиск */}
      <div className="page-search-bar">
        <input
          type="text"
          placeholder="🔍 Поиск по названию или категории..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="page-search-input"
        />
        {searchQuery && (
          <button className="btn btn-small" onClick={() => setSearchQuery('')}>
            ✕ Очистить
          </button>
        )}
      </div>

      {/* Список составных услуг */}
      <div className="composite-services-list">
        {filteredServices.length === 0 ? (
          <div className="empty-state">
            <p>{searchQuery ? 'Составные услуги не найдены' : 'Нет составных услуг'}</p>
          </div>
        ) : (
          <div className="composite-services-grid">
            {filteredServices.map(cs => (
              <div key={cs.id} className={`composite-service-card ${!cs.is_active ? 'inactive' : ''}`}>
                <div className="card-header">
                  <h3>{cs.name}</h3>
                  {!cs.is_active && <span className="inactive-badge">Неактивна</span>}
                </div>
                {cs.category && <div className="card-category">{cs.category}</div>}
                {cs.description && <div className="card-description">{cs.description}</div>}
                
                <div className="card-content">
                  <div className="card-section">
                    <strong>Подуслуги ({cs.services?.length || 0}):</strong>
                    <ul>
                      {cs.services?.map(s => {
                        const service = services.find(serv => serv.id === s.service_id);
                        return service ? (
                          <li key={s.service_id}>
                            {service.name} {s.quantity > 1 && `(x${s.quantity})`}
                            <span className="item-price"> - {service.price} BYN</span>
                          </li>
                        ) : null;
                      })}
                    </ul>
                  </div>
                  
                  {cs.materials && cs.materials.length > 0 && (
                    <div className="card-section">
                      <strong>Материалы ({cs.materials.length}):</strong>
                      <ul>
                        {cs.materials.map(m => {
                          const material = materials.find(mat => mat.id === m.material_id);
                          return material ? (
                            <li key={m.material_id}>
                              {material.name} - {m.quantity} {material.unit}
                              <span className="item-price"> ({material.price} BYN/{material.unit})</span>
                            </li>
                          ) : null;
                        })}
                      </ul>
                    </div>
                  )}
                  
                  <div className="card-total-price">
                    <strong>Общая стоимость: {calculateTotalPrice(cs)} BYN</strong>
                  </div>
                </div>
                
                <div className="card-actions">
                  <button className="btn btn-small btn-info" onClick={() => {
                    setSelectedServiceForDetails(cs);
                    setShowDetailsModal(true);
                  }}>
                    👁️ Просмотр
                  </button>
                  <button className="btn btn-small" onClick={() => handleOpenModal(cs)}>
                    ✏️ Редактировать
                  </button>
                  <button className="btn btn-small btn-danger" onClick={() => handleDelete(cs.id)}>
                    🗑️ Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно создания/редактирования */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content composite-service-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-details">
              <h3>{editingService ? 'Редактировать составную услугу' : 'Создать составную услугу'}</h3>
              <button className="modal-close-details" onClick={handleCloseModal} title="Закрыть">
                <span>×</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="composite-service-form">
              <div className="form-group">
                <label>Название *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Например: Гигиена полости рта"
                />
              </div>
              
              <div className="form-group">
                <label>Категория</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Например: Стоматология"
                />
              </div>
              
              <div className="form-group">
                <label>Описание</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Описание составной услуги..."
                />
              </div>
              
              {/* Добавление подуслуг */}
              <div className="form-section">
                <label>Подуслуги *</label>
                <ServiceMaterialSelector
                  items={services}
                  selectedItems={formData.services}
                  onToggleItem={handleToggleService}
                  onUpdateQuantity={handleUpdateServiceQuantity}
                  onRemoveItem={handleRemoveService}
                  type="service"
                  searchQuery={serviceSearch}
                  onSearchChange={setServiceSearch}
                />
              </div>
              
              {/* Добавление материалов */}
              <div className="form-section">
                <label>Материалы</label>
                <ServiceMaterialSelector
                  items={materials}
                  selectedItems={formData.materials}
                  onToggleItem={handleToggleMaterial}
                  onUpdateQuantity={handleUpdateMaterialQuantity}
                  onRemoveItem={handleRemoveMaterial}
                  type="material"
                  searchQuery={materialSearch}
                  onSearchChange={setMaterialSearch}
                />
              </div>
              
              {/* Общая стоимость */}
              {(formData.services.length > 0 || formData.materials.length > 0) && (
                <div className="form-total-price">
                  <strong>Общая стоимость составной услуги: {formTotalPrice} BYN</strong>
                  <div className="form-total-breakdown">
                    {formData.services.length > 0 && (
                      <span>Подуслуги: {formData.services.reduce((sum, item) => {
                        const service = services.find(s => s.id === item.service_id);
                        return sum + ((service?.price || 0) * (item.quantity || 1));
                      }, 0).toFixed(2)} BYN</span>
                    )}
                    {formData.materials.length > 0 && (
                      <span>Материалы: {formData.materials.reduce((sum, item) => {
                        const material = materials.find(m => m.id === item.material_id);
                        return sum + ((material?.price || 0) * (item.quantity || 1));
                      }, 0).toFixed(2)} BYN</span>
                    )}
                  </div>
                </div>
              )}
              
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingService ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно просмотра деталей */}
      {showDetailsModal && selectedServiceForDetails && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content composite-service-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-details">
              <h3>📋 {selectedServiceForDetails.name}</h3>
              <button className="modal-close-details" onClick={() => setShowDetailsModal(false)} title="Закрыть">
                <span>×</span>
              </button>
            </div>
            
            <div className="details-content">
              {selectedServiceForDetails.category && (
                <div className="detail-section">
                  <strong>Категория:</strong> {selectedServiceForDetails.category}
                </div>
              )}
              
              {selectedServiceForDetails.description && (
                <div className="detail-section">
                  <strong>Описание:</strong>
                  <p>{selectedServiceForDetails.description}</p>
                </div>
              )}
              
              <div className="detail-section">
                <strong>Подуслуги ({selectedServiceForDetails.services?.length || 0}):</strong>
                <table className="details-table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Количество</th>
                      <th>Цена за единицу</th>
                      <th>Стоимость</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedServiceForDetails.services && selectedServiceForDetails.services.length > 0 ? (
                      selectedServiceForDetails.services.map(s => {
                        // API возвращает данные с полем id, а не service_id в объекте service
                        const serviceId = s.service_id || s.id;
                        const service = services.find(serv => serv.id === serviceId);
                        if (!service) {
                          // Если не нашли в списке services, используем данные из s (они уже содержат все поля)
                          const itemTotal = (s.price || 0) * (s.quantity || 1);
                          return (
                            <tr key={serviceId || s.id}>
                              <td>{s.name || 'Неизвестная услуга'}</td>
                              <td>{s.quantity || 1}</td>
                              <td>{s.price || 0} BYN</td>
                              <td className="price-cell">{itemTotal.toFixed(2)} BYN</td>
                            </tr>
                          );
                        }
                        const itemTotal = (service.price || 0) * (s.quantity || 1);
                        return (
                          <tr key={serviceId}>
                            <td>{service.name}</td>
                            <td>{s.quantity || 1}</td>
                            <td>{service.price} BYN</td>
                            <td className="price-cell">{itemTotal.toFixed(2)} BYN</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: '#999' }}>
                          Нет подуслуг
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {selectedServiceForDetails.materials && selectedServiceForDetails.materials.length > 0 && (
                <div className="detail-section">
                  <strong>Материалы ({selectedServiceForDetails.materials.length}):</strong>
                  <table className="details-table">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Количество</th>
                        <th>Единица</th>
                        <th>Цена за единицу</th>
                        <th>Стоимость</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedServiceForDetails.materials && selectedServiceForDetails.materials.length > 0 ? (
                        selectedServiceForDetails.materials.map(m => {
                          // API возвращает данные с полем id, а не material_id в объекте material
                          const materialId = m.material_id || m.id;
                          const material = materials.find(mat => mat.id === materialId);
                          if (!material) {
                            // Если не нашли в списке materials, используем данные из m (они уже содержат все поля)
                            const itemTotal = (m.price || 0) * (m.quantity || 1);
                            return (
                              <tr key={materialId || m.id}>
                                <td>{m.name || 'Неизвестный материал'}</td>
                                <td>{m.quantity || 1}</td>
                                <td>{m.unit || '-'}</td>
                                <td>{m.price || 0} BYN/{m.unit || 'шт'}</td>
                                <td className="price-cell">{itemTotal.toFixed(2)} BYN</td>
                              </tr>
                            );
                          }
                          const itemTotal = (material.price || 0) * (m.quantity || 1);
                          return (
                            <tr key={materialId}>
                              <td>{material.name}</td>
                              <td>{m.quantity || 1}</td>
                              <td>{material.unit || '-'}</td>
                              <td>{material.price} BYN/{material.unit || 'шт'}</td>
                              <td className="price-cell">{itemTotal.toFixed(2)} BYN</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: '#999' }}>
                            Нет материалов
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              
              <div className="detail-total">
                <strong>Общая стоимость: {calculateTotalPrice(selectedServiceForDetails)} BYN</strong>
                {(() => {
                  const servicesTotal = selectedServiceForDetails.services?.reduce((sum, s) => {
                    const serviceId = s.service_id || s.id;
                    const service = services.find(serv => serv.id === serviceId);
                    return sum + ((service?.price || s.price || 0) * (s.quantity || 1));
                  }, 0) || 0;
                  const materialsTotal = selectedServiceForDetails.materials?.reduce((sum, m) => {
                    const materialId = m.material_id || m.id;
                    const material = materials.find(mat => mat.id === materialId);
                    return sum + ((material?.price || m.price || 0) * (m.quantity || 1));
                  }, 0) || 0;
                  return (
                    <div className="detail-total-breakdown">
                      {servicesTotal > 0 && <span>Подуслуги: {servicesTotal.toFixed(2)} BYN</span>}
                      {materialsTotal > 0 && <span>Материалы: {materialsTotal.toFixed(2)} BYN</span>}
                    </div>
                  );
                })()}
              </div>
            </div>
            
            <div className="modal-footer-details">
              <button className="btn btn-primary" onClick={() => setShowDetailsModal(false)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompositeServicesPage;

