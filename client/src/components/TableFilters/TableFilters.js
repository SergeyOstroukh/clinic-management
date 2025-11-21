import React from 'react';
import './TableFilters.css';

const TableFilters = ({ filters, onFilterChange, onClearFilters }) => {
  if (!filters || filters.length === 0) return null;

  const hasActiveFilters = filters.some(f => f.value !== '' && f.value !== null && f.value !== undefined);

  return (
    <div className="table-filters">
      <div className="filters-header">
        <h4>🔍 Фильтры</h4>
        {hasActiveFilters && (
          <button className="btn-clear-filters" onClick={onClearFilters}>
            Очистить все
          </button>
        )}
      </div>
      
      <div className="filters-grid">
        {filters.map((filter, index) => (
          <div key={index} className="filter-item">
            <label>{filter.label}</label>
            {filter.type === 'select' ? (
              <select
                value={filter.value || ''}
                onChange={(e) => onFilterChange(filter.key, e.target.value)}
                className="filter-select"
              >
                <option value="">Все</option>
                {filter.options?.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : filter.type === 'date' ? (
              <input
                type="date"
                value={filter.value || ''}
                onChange={(e) => onFilterChange(filter.key, e.target.value)}
                className="filter-input"
              />
            ) : (
              <input
                type="text"
                placeholder={filter.placeholder || 'Введите значение...'}
                value={filter.value || ''}
                onChange={(e) => onFilterChange(filter.key, e.target.value)}
                className="filter-input"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TableFilters;

