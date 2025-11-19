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
  const [activeCategory, setActiveCategory] = useState(null);

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

  const categories = Object.keys(groupedItems).sort();

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

  // При открытии модального окна выбираем первую категорию
  useEffect(() => {
    if (showList && categories.length > 0) {
      // Если активной категории нет или она не в отфильтрованном списке, выбираем первую
      const filteredCategories = Object.keys(filteredGroupedItems).sort();
      if (!activeCategory || !filteredCategories.includes(activeCategory)) {
        if (filteredCategories.length > 0) {
          setActiveCategory(filteredCategories[0]);
        }
      }
    }
  }, [showList, categories, activeCategory, filteredGroupedItems]);

  // При закрытии модального окна сбрасываем активную категорию
  useEffect(() => {
    if (!showList) {
      setActiveCategory(null);
    }
  }, [showList]);


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

            {/* Горизонтальный список категорий */}
            <div className="modal-categories-tabs">
              {Object.keys(filteredGroupedItems)
                .sort()
                .map(category => {
                  const itemsInCategory = filteredGroupedItems[category];
                  const selectedCount = itemsInCategory.filter(item =>
                    isItemSelected(item.id)
                  ).length;
                  const isActive = activeCategory === category;

                  return (
                    <button
                      key={category}
                      type="button"
                      className={`category-tab ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveCategory(category)}
                    >
                      <span className="tab-name">{category}</span>
                      <span className="tab-count">({selectedCount}/{itemsInCategory.length})</span>
                    </button>
                  );
                })}
            </div>

            <div className="modal-controls">
              <div className="selected-count">
                Выбрано: {selectedItems.length}
              </div>
            </div>

            {/* Основной контент с двумя колонками */}
            <div className="modal-body">
              {/* Контент выбранной категории */}
              <div className="modal-content">
              {activeCategory && filteredGroupedItems[activeCategory] ? (
                <div className="category-items-list">
                  {filteredGroupedItems[activeCategory].map(item => {
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
                            <span className="item-price">{item.price} ₽</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="no-results">
                  {searchQuery ? 'Ничего не найдено' : 'Выберите категорию'}
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

                        return (
                          <div key={itemId} className="selected-panel-item">
                            <div className="selected-item-info">
                              <div className="selected-item-name">{fullItem.name}</div>
                              {type === 'material' && fullItem.unit && (
                                <div className="selected-item-unit">{fullItem.unit}</div>
                              )}
                              {fullItem.price && (
                                <div className="selected-item-price">{fullItem.price} ₽</div>
                              )}
                            </div>
                            <div className="selected-item-controls">
                              <label className="quantity-label">
                                Кол-во:
                                <input
                                  type="number"
                                  min={type === 'service' ? '1' : '0.1'}
                                  step={type === 'service' ? '1' : '0.1'}
                                  value={item.quantity}
                                  onChange={(e) => {
                                    if (onUpdateQuantity) {
                                      onUpdateQuantity(itemId, e.target.value);
                                    }
                                  }}
                                  className="selected-quantity-input"
                                />
                              </label>
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

