import React, { useState, useMemo, useEffect } from 'react';
import './ServiceMaterialSelector.css';

const ServiceMaterialSelector = ({ 
  items, 
  selectedItems, 
  onToggleItem,
  onUpdateQuantity,
  onRemoveItem,
  type = 'service', // 'service' или 'material'
  searchQuery = '',
  onSearchChange = () => {}
}) => {
  const [showList, setShowList] = useState(false);
  // Какие категории развёрнуты (аккордеон). Set для быстрого toggle.
  const [expandedCategories, setExpandedCategories] = useState(() => new Set());

  // Группировка по категориям
  const groupedItems = useMemo(() => {
    const grouped = {};
    
    items.forEach(item => {
      // Для услуг используем category, для материалов - если нет категории, группируем по первой букве
      let category;
      if (type === 'service') {
        category = item.category || 'Без категории';
      } else {
        // Для материалов: если есть category - используем, иначе группируем по первой букве
        if (item.category) {
          category = item.category;
        } else {
          const firstLetter = item.name.charAt(0).toUpperCase();
          category = /[А-ЯA-Z]/.test(firstLetter) ? firstLetter : '#';
        }
      }
      
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });
    
    // Сортируем категории и элементы внутри
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => a.name.localeCompare(b.name));
    });
    
    return grouped;
  }, [items, type]);

  // Фильтрация по поиску
  const filteredGroupedItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedItems;
    }
    
    const filtered = {};
    const query = searchQuery.toLowerCase();
    
    Object.keys(groupedItems).forEach(category => {
      const filteredItems = groupedItems[category].filter(item =>
        item.name.toLowerCase().includes(query)
      );
      if (filteredItems.length > 0) {
        filtered[category] = filteredItems;
      }
    });
    
    return filtered;
  }, [groupedItems, searchQuery]);

  // При открытии модального окна — все категории свёрнуты
  // При закрытии — сбрасываем развёрнутые
  useEffect(() => {
    if (!showList) {
      setExpandedCategories(new Set());
    }
  }, [showList]);

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };


  const isItemSelected = (itemId) => {
    return selectedItems.some(sel => 
      (type === 'service' ? sel.service_id : sel.material_id) === itemId
    );
  };

  const handleItemToggle = (itemId) => {
    onToggleItem(itemId);
  };

  return (
    <>
      <div className="service-material-selector">
        {/* Кнопка открытия списка */}
        <div className="selector-header">
          <input
            type="text"
            className="search-input"
            placeholder={type === 'service' ? 'Поиск услуги...' : 'Поиск материала...'}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <button
            type="button"
            className="btn-toggle-list"
            onClick={() => setShowList(!showList)}
          >
            {showList ? '▲ Скрыть список' : '▼ Открыть список'}
          </button>
        </div>
      </div>

      {/* Модальное окно с полным списком */}
      {showList && (
        <div 
          className="selector-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowList(false);
            }
          }}
        >
          <div className="selector-modal">
            <div className="modal-header">
              <h3>
                {type === 'service' ? '📋 Выбор услуг' : '📦 Выбор материалов'}
              </h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowList(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-search">
              <input
                type="text"
                className="modal-search-input"
                placeholder={type === 'service' ? 'Поиск услуги...' : 'Поиск материала...'}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                autoFocus
              />
            </div>

            <div className="modal-controls">
              <div className="selected-count">
                Выбрано: {selectedItems.length}
              </div>
            </div>

            {/* Основной контент: слева — аккордеон категорий, справа — выбранные */}
            <div className="modal-body">
              <div className="modal-content">
                {Object.keys(filteredGroupedItems).length === 0 ? (
                  <div className="no-results">
                    {searchQuery ? 'Ничего не найдено' : 'Нет категорий'}
                  </div>
                ) : (
                  <div className="categories-accordion">
                    {Object.keys(filteredGroupedItems)
                      .sort()
                      .map(category => {
                        const itemsInCategory = filteredGroupedItems[category];
                        const selectedCount = itemsInCategory.filter(item =>
                          isItemSelected(item.id)
                        ).length;
                        const isExpanded = expandedCategories.has(category);

                        return (
                          <div key={category} className="accordion-section">
                            <button
                              type="button"
                              className={`accordion-header ${isExpanded ? 'expanded' : ''}`}
                              onClick={() => toggleCategory(category)}
                            >
                              <span className="accordion-title">{category}</span>
                              <span className="accordion-meta">
                                ({selectedCount}/{itemsInCategory.length})
                              </span>
                              <span className="accordion-chevron">{isExpanded ? '▼' : '▶'}</span>
                            </button>
                            {isExpanded && (
                              <div className="accordion-body">
                                <div className="category-items-list">
                                  {itemsInCategory.map(item => {
                                    const isSelected = isItemSelected(item.id);
                                    return (
                                      <label
                                        key={item.id}
                                        className={`item-checkbox ${isSelected ? 'selected' : ''}`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => handleItemToggle(item.id)}
                                        />
                                        <div className="item-info">
                                          <span className="item-name">{item.name}</span>
                                          {type === 'material' && item.unit && (
                                            <span className="item-unit">({item.unit})</span>
                                          )}
                                          {item.price && (
                                            <span className="item-price">{item.price} BYN</span>
                                          )}
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Панель выбранных позиций справа */}
              <div className="modal-selected-panel">
                <div className="selected-panel-header">
                  <h4>Выбранные позиции</h4>
                  <span className="selected-count-badge">{selectedItems.length}</span>
                </div>
                <div className="selected-panel-content">
                  {selectedItems.length === 0 ? (
                    <div className="no-selected-items">
                      Нет выбранных позиций
                    </div>
                  ) : (
                    <div className="selected-items-list">
                      {selectedItems.map(item => {
                        const itemId = type === 'service' ? item.service_id : item.material_id;
                        const fullItem = items.find(i => i.id === itemId);
                        if (!fullItem) return null;

                        const itemTotal = (fullItem.price || 0) * (item.quantity || 1);
                        return (
                          <div key={itemId} className="selected-panel-item">
                            <div className="selected-item-info">
                              <div className="selected-item-name">{fullItem.name}</div>
                              {type === 'material' && fullItem.unit && (
                                <div className="selected-item-unit">{fullItem.unit}</div>
                              )}
                              {fullItem.price && (
                                <div className="selected-item-price">{fullItem.price} BYN</div>
                              )}
                            </div>
                            <div className="selected-item-controls">
                              <label className="quantity-label">
                                Кол-во:
                                <input
                                  type="number"
                                  min={type === 'service' ? '1' : '0.1'}
                                  step="1"
                                  value={item.quantity}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    if (onUpdateQuantity) {
                                      onUpdateQuantity(itemId, e.target.value);
                                    }
                                  }}
                                  className="selected-quantity-input"
                                />
                              </label>
                              <div className="selected-item-total" style={{ 
                                fontWeight: 'bold', 
                                color: '#667eea',
                                marginTop: '5px'
                              }}>
                                <div style={{ fontSize: '0.85rem', marginBottom: '2px' }}>
                                  Кол-во: {item.quantity || 1}
                                </div>
                                <div>
                                  Итого: {itemTotal.toFixed(2)} BYN
                                </div>
                              </div>
                              {onRemoveItem && (
                                <button
                                  type="button"
                                  className="btn-remove-selected"
                                  onClick={() => onRemoveItem(itemId)}
                                  title="Удалить"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              {selectedItems.length > 0 && (
                <div style={{
                  marginBottom: '15px',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '8px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.9rem', marginBottom: '5px' }}>
                    💰 Общая сумма {type === 'service' ? 'услуг' : 'материалов'}:
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {(() => {
                      const total = selectedItems.reduce((sum, item) => {
                        const itemId = type === 'service' ? item.service_id : item.material_id;
                        const fullItem = items.find(i => i.id === itemId);
                        if (!fullItem) return sum;
                        return sum + ((fullItem.price || 0) * (item.quantity || 1));
                      }, 0);
                      return total.toFixed(2);
                    })()} BYN
                  </div>
                </div>
              )}
              <button
                type="button"
                className="btn-close-footer"
                onClick={() => setShowList(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ServiceMaterialSelector;

