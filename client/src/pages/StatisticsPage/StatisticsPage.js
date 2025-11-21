import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './StatisticsPage.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

const StatisticsPage = ({ onNavigate, currentUser }) => {
  const [activeTab, setActiveTab] = useState('writeoff');
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Для списания материалов
  const [writeoffForm, setWriteoffForm] = useState({
    material_id: '',
    quantity: '',
    notes: ''
  });
  
  // Для статистики
  const [statistics, setStatistics] = useState({
    currentStock: [],
    receipts: [],
    usage: [],
    writeoffs: [],
    doctors: [],
    totals: { receipts: 0, usage: 0, writeoffs: 0 }
  });
  const [dateFilter, setDateFilter] = useState({
    type: 'all', // 'all', 'day', 'month', 'range'
    date: new Date().toISOString().split('T')[0],
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    startDate: '',
    endDate: '',
    doctor_id: '' // Фильтр по врачу
  });
  const [reportType, setReportType] = useState('receipts'); // 'receipts' или 'writeoffs'
  const [stockSortOrder, setStockSortOrder] = useState(null); // null, 'asc', 'desc'
  const [expandedSections, setExpandedSections] = useState({
    receipts: false,
    writeoffs: false,
    usage: false
  });

  const loadMaterials = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/materials`);
      setMaterials(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки материалов:', error);
      setLoading(false);
    }
  }, []);

  const loadStatistics = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFilter.type === 'day') {
        params.append('date', dateFilter.date);
      } else if (dateFilter.type === 'month') {
        params.append('month', dateFilter.month);
        params.append('year', dateFilter.year);
      }
      if (dateFilter.doctor_id) {
        params.append('doctor_id', dateFilter.doctor_id);
      }
      
      const response = await axios.get(`${API_URL}/statistics/materials?${params.toString()}`);
      setStatistics(response.data);
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    loadMaterials();
    loadStatistics();
  }, [loadMaterials, loadStatistics]);

  const handleWriteoff = async (e) => {
    e.preventDefault();
    if (!writeoffForm.material_id || !writeoffForm.quantity) {
      alert('Заполните все обязательные поля');
      return;
    }

    try {
      await axios.post(`${API_URL}/materials/writeoff`, {
        material_id: parseInt(writeoffForm.material_id),
        quantity: parseFloat(writeoffForm.quantity),
        notes: writeoffForm.notes
      });
      
      alert('✅ Материал успешно списан');
      setWriteoffForm({ material_id: '', quantity: '', notes: '' });
      loadMaterials();
      loadStatistics();
    } catch (error) {
      console.error('Ошибка списания материала:', error);
      alert(`Ошибка списания материала: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      params.append('type', reportType);
      if (dateFilter.type === 'day') {
        params.append('date', dateFilter.date);
      } else if (dateFilter.type === 'month') {
        params.append('month', dateFilter.month);
        params.append('year', dateFilter.year);
      }
      
      const response = await axios.get(`${API_URL}/statistics/materials/export?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      }));
      const link = document.createElement('a');
      link.href = url;
      
      // Формируем имя файла
      let fileName = `отчет_${reportType === 'receipts' ? 'приходы' : 'использование'}`;
      if (dateFilter.type === 'day') {
        fileName += `_${dateFilter.date}`;
      } else if (dateFilter.type === 'month') {
        fileName += `_${dateFilter.year}-${String(dateFilter.month).padStart(2, '0')}`;
      } else {
        fileName += '_все_время';
      }
      fileName += '.xlsx';
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка выгрузки отчета:', error);
      alert('Ошибка выгрузки отчета');
    }
  };

  const handleExportAppointments = async () => {
    try {
      const params = new URLSearchParams();
      if (dateFilter.type === 'day') {
        params.append('date', dateFilter.date);
      } else if (dateFilter.type === 'month') {
        params.append('month', dateFilter.month);
        params.append('year', dateFilter.year);
      } else if (dateFilter.type === 'range') {
        if (dateFilter.startDate) {
          params.append('startDate', dateFilter.startDate);
        }
        if (dateFilter.endDate) {
          params.append('endDate', dateFilter.endDate);
        }
      }
      
      const response = await axios.get(`${API_URL}/statistics/appointments/export?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      }));
      const link = document.createElement('a');
      link.href = url;
      
      // Формируем имя файла
      let fileName = 'отчет_записи';
      if (dateFilter.type === 'day') {
        fileName += `_${dateFilter.date}`;
      } else if (dateFilter.type === 'range') {
        if (dateFilter.startDate && dateFilter.endDate) {
          fileName += `_${dateFilter.startDate}_${dateFilter.endDate}`;
        }
      } else if (dateFilter.type === 'month') {
        fileName += `_${dateFilter.year}-${String(dateFilter.month).padStart(2, '0')}`;
      } else {
        fileName += '_все_время';
      }
      fileName += '.xlsx';
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка выгрузки записей:', error);
      alert(`Ошибка выгрузки записей: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleExportClients = async () => {
    try {
      const response = await axios.get(`${API_URL}/statistics/clients/export`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      }));
      const link = document.createElement('a');
      link.href = url;
      
      const fileName = `база_клиентов_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка выгрузки клиентов:', error);
      alert(`Ошибка выгрузки клиентов: ${error.response?.data?.error || error.message}`);
    }
  };

  if (loading && materials.length === 0) {
    return (
      <div className="statistics-page">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="statistics-page">
      <div className="statistics-header">
        <div>
          <h2>📊 Статистика и отчеты</h2>
          <p>Управление материалами, статистика и отчеты</p>
        </div>
        <button className="btn" onClick={() => onNavigate('home')}>
          ← Назад
        </button>
      </div>

      {/* Вкладки */}
      <div className="statistics-tabs">
        <button
          className={`tab ${activeTab === 'writeoff' ? 'active' : ''}`}
          onClick={() => setActiveTab('writeoff')}
        >
          📝 Списание материалов
        </button>
        <button
          className={`tab ${activeTab === 'stock' ? 'active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          📦 Остатки материалов
        </button>
        <button
          className={`tab ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          📈 Статистика
        </button>
        <button
          className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          📄 Отчеты
        </button>
      </div>

      {/* Контент вкладок */}
      <div className="statistics-content">
        {/* Списание материалов */}
        {activeTab === 'writeoff' && (
          <div className="tab-content">
            <h3>Списание материалов</h3>
            <form onSubmit={handleWriteoff} className="writeoff-form">
              <div className="form-group">
                <label>Материал *</label>
                <select
                  value={writeoffForm.material_id}
                  onChange={(e) => setWriteoffForm({ ...writeoffForm, material_id: e.target.value })}
                  required
                >
                  <option value="">Выберите материал</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit}) - Остаток: {m.stock} {m.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Количество *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={writeoffForm.quantity}
                  onChange={(e) => setWriteoffForm({ ...writeoffForm, quantity: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Примечание</label>
                <textarea
                  value={writeoffForm.notes}
                  onChange={(e) => setWriteoffForm({ ...writeoffForm, notes: e.target.value })}
                  rows="3"
                  placeholder="Причина списания..."
                />
              </div>

              <button type="submit" className="btn btn-primary">
                ✅ Списать материал
              </button>
            </form>
          </div>
        )}

        {/* Остатки материалов */}
        {activeTab === 'stock' && (
          <div className="tab-content">
            <h3>Остатки материалов на текущий момент</h3>
            <div className="stock-table-container">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Наименование</th>
                    <th>Единица измерения</th>
                    <th>Цена за единицу</th>
                    <th 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => {
                        if (stockSortOrder === null) {
                          setStockSortOrder('asc');
                        } else if (stockSortOrder === 'asc') {
                          setStockSortOrder('desc');
                        } else {
                          setStockSortOrder(null);
                        }
                      }}
                      title="Нажмите для сортировки по остатку"
                    >
                      Остаток {stockSortOrder === 'asc' ? '↑' : stockSortOrder === 'desc' ? '↓' : ''}
                    </th>
                    <th>Стоимость остатка</th>
                  </tr>
                </thead>
                <tbody>
                  {materials
                    .slice() // Создаем копию массива для сортировки
                    .sort((a, b) => {
                      if (stockSortOrder === null) return 0;
                      if (stockSortOrder === 'asc') {
                        return a.stock - b.stock;
                      } else {
                        return b.stock - a.stock;
                      }
                    })
                    .map((material, idx) => (
                    <tr key={material.id}>
                      <td>{idx + 1}</td>
                      <td>{material.name}</td>
                      <td>{material.unit || '-'}</td>
                      <td>{material.price.toFixed(2)} BYN</td>
                      <td className={material.stock <= 0 ? 'stock-zero' : (material.stock <= 10 ? 'stock-low' : '')}>
                        {material.stock} {material.unit || ''}
                      </td>
                      <td>{(material.price * material.stock).toFixed(2)} BYN</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'right', fontWeight: 'bold' }}>Общая стоимость остатков:</td>
                    <td style={{ fontWeight: 'bold' }}>
                      {materials.reduce((sum, m) => sum + (m.price * m.stock), 0).toFixed(2)} BYN
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Статистика */}
        {activeTab === 'statistics' && (
          <div className="tab-content">
            <h3>Статистика по материалам</h3>
            
            {/* Фильтры */}
            <div className="statistics-filters">
              <div className="filter-group">
                <label>Период:</label>
                <select
                  value={dateFilter.type}
                  onChange={(e) => setDateFilter({ ...dateFilter, type: e.target.value })}
                >
                  <option value="all">За все время</option>
                  <option value="day">За день</option>
                  <option value="month">За месяц</option>
                </select>
              </div>

              {dateFilter.type === 'day' && (
                <div className="filter-group">
                  <label>Дата:</label>
                  <input
                    type="date"
                    value={dateFilter.date}
                    onChange={(e) => setDateFilter({ ...dateFilter, date: e.target.value })}
                  />
                </div>
              )}

              {dateFilter.type === 'month' && (
                <>
                  <div className="filter-group">
                    <label>Месяц:</label>
                    <select
                      value={dateFilter.month}
                      onChange={(e) => setDateFilter({ ...dateFilter, month: parseInt(e.target.value) })}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                        <option key={m} value={m}>
                          {new Date(2000, m - 1).toLocaleString('ru-RU', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Год:</label>
                    <input
                      type="number"
                      min="2020"
                      max="2100"
                      value={dateFilter.year}
                      onChange={(e) => setDateFilter({ ...dateFilter, year: parseInt(e.target.value) })}
                    />
                  </div>
                </>
              )}

              <div className="filter-group">
                <label>Врач:</label>
                <select
                  value={dateFilter.doctor_id}
                  onChange={(e) => setDateFilter({ ...dateFilter, doctor_id: e.target.value })}
                >
                  <option value="">Все врачи</option>
                  {statistics.doctors && statistics.doctors.map(doctor => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.lastName} {doctor.firstName} {doctor.middleName || ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Приходы */}
            <div className="statistics-section">
              <h4 
                style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}
                onClick={() => setExpandedSections({ ...expandedSections, receipts: !expandedSections.receipts })}
              >
                <span>{expandedSections.receipts ? '▼' : '▶'}</span>
                <span>📥 Приходы материалов</span>
              </h4>
              {expandedSections.receipts && (
              <div className="statistics-table-container">
                <table className="statistics-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Материал</th>
                      <th>Количество</th>
                      <th>Цена</th>
                      <th>Сумма</th>
                      <th>Примечание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statistics.receipts.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: '#999' }}>
                          Нет данных за выбранный период
                        </td>
                      </tr>
                    ) : (
                      statistics.receipts.map((item, idx) => (
                        <tr key={idx}>
                          <td>{new Date(item.date).toLocaleDateString('ru-RU')}</td>
                          <td>{item.material_name}</td>
                          <td>{item.quantity} {item.unit}</td>
                          <td>{item.price ? item.price.toFixed(2) : '-'} BYN</td>
                          <td>{item.total ? item.total.toFixed(2) : '-'} BYN</td>
                          <td>{item.notes || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold' }}>Итого:</td>
                      <td style={{ fontWeight: 'bold' }}>{statistics.totals.receipts.toFixed(2)} BYN</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              )}
            </div>

            {/* Списания */}
            <div className="statistics-section">
              <h4 
                style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}
                onClick={() => setExpandedSections({ ...expandedSections, writeoffs: !expandedSections.writeoffs })}
              >
                <span>{expandedSections.writeoffs ? '▼' : '▶'}</span>
                <span>📝 Списания материалов</span>
              </h4>
              {expandedSections.writeoffs && (
              <div className="statistics-table-container">
                <table className="statistics-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Материал</th>
                      <th>Количество</th>
                      <th>Цена</th>
                      <th>Сумма</th>
                      <th>Примечание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statistics.writeoffs && statistics.writeoffs.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: '#999' }}>
                          Нет данных за выбранный период
                        </td>
                      </tr>
                    ) : (
                      statistics.writeoffs && statistics.writeoffs.map((item, idx) => (
                        <tr key={idx}>
                          <td>{new Date(item.date).toLocaleDateString('ru-RU')}</td>
                          <td>{item.material_name}</td>
                          <td>{item.quantity} {item.unit}</td>
                          <td>{item.price ? item.price.toFixed(2) : '-'} BYN</td>
                          <td>{item.total ? item.total.toFixed(2) : '-'} BYN</td>
                          <td>{item.appointment_id ? '' : (item.notes || '-')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold' }}>Итого:</td>
                      <td style={{ fontWeight: 'bold' }}>{statistics.totals.writeoffs ? statistics.totals.writeoffs.toFixed(2) : '0.00'} BYN</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              )}
            </div>

            {/* Использование */}
            <div className="statistics-section">
              <h4 
                style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}
                onClick={() => setExpandedSections({ ...expandedSections, usage: !expandedSections.usage })}
              >
                <span>{expandedSections.usage ? '▼' : '▶'}</span>
                <span>📤 Использованные материалы</span>
              </h4>
              {expandedSections.usage && (
              <div className="statistics-table-container">
                <table className="statistics-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Материал</th>
                      <th>Количество</th>
                      <th>Цена</th>
                      <th>Сумма</th>
                      <th>Примечание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statistics.usage.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: '#999' }}>
                          Нет данных за выбранный период
                        </td>
                      </tr>
                    ) : (
                      statistics.usage.map((item, idx) => (
                        <tr key={idx}>
                          <td>{new Date(item.date).toLocaleDateString('ru-RU')}</td>
                          <td>{item.material_name}</td>
                          <td>{item.quantity} {item.unit}</td>
                          <td>{item.price ? item.price.toFixed(2) : '-'} BYN</td>
                          <td>{item.total ? item.total.toFixed(2) : '-'} BYN</td>
                          <td>{item.notes || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold' }}>Итого:</td>
                      <td style={{ fontWeight: 'bold' }}>{statistics.totals.usage.toFixed(2)} BYN</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              )}
            </div>
          </div>
        )}

        {/* Отчеты */}
        {activeTab === 'reports' && (
          <div className="tab-content">
            <h3>Выгрузка отчетов</h3>
            
            <div className="reports-section">
              <div className="report-filters">
                <div className="filter-group">
                  <label>Тип отчета:</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                  >
                    <option value="receipts">По приходам</option>
                    <option value="writeoffs">По списаниям</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Период:</label>
                  <select
                    value={dateFilter.type}
                    onChange={(e) => setDateFilter({ ...dateFilter, type: e.target.value })}
                  >
                    <option value="all">За все время</option>
                    <option value="day">За день</option>
                    <option value="month">За месяц</option>
                  </select>
                </div>

                {dateFilter.type === 'day' && (
                  <div className="filter-group">
                    <label>Дата:</label>
                    <input
                      type="date"
                      value={dateFilter.date}
                      onChange={(e) => setDateFilter({ ...dateFilter, date: e.target.value })}
                    />
                  </div>
                )}

                {dateFilter.type === 'month' && (
                  <>
                    <div className="filter-group">
                      <label>Месяц:</label>
                      <select
                        value={dateFilter.month}
                        onChange={(e) => setDateFilter({ ...dateFilter, month: parseInt(e.target.value) })}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                          <option key={m} value={m}>
                            {new Date(2000, m - 1).toLocaleString('ru-RU', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-group">
                      <label>Год:</label>
                      <input
                        type="number"
                        min="2020"
                        max="2100"
                        value={dateFilter.year}
                        onChange={(e) => setDateFilter({ ...dateFilter, year: parseInt(e.target.value) })}
                      />
                    </div>
                  </>
                )}
              </div>

              <button className="btn btn-primary btn-large" onClick={handleExportExcel}>
                📥 Выгрузить отчет в Excel
              </button>
            </div>

            {/* Экспорт записей */}
            <div className="export-section">
            <h3>📋 Экспорт записей</h3>
            <p>Выгрузить все записи за выбранный период с информацией о приеме, враче, клиенте и услугах</p>
            <div className="export-controls">
              <div className="date-filters">
                <div className="filter-group">
                  <label>Период:</label>
                  <select
                    value={dateFilter.type}
                    onChange={(e) => setDateFilter({ ...dateFilter, type: e.target.value })}
                  >
                    <option value="all">Все время</option>
                    <option value="day">День</option>
                    <option value="month">Месяц</option>
                    <option value="range">Диапазон</option>
                  </select>
                </div>

                {dateFilter.type === 'day' && (
                  <div className="filter-group">
                    <label>Дата:</label>
                    <input
                      type="date"
                      value={dateFilter.date}
                      onChange={(e) => setDateFilter({ ...dateFilter, date: e.target.value })}
                    />
                  </div>
                )}

                {dateFilter.type === 'range' && (
                  <>
                    <div className="filter-group">
                      <label>С:</label>
                      <input
                        type="date"
                        value={dateFilter.startDate || ''}
                        onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
                      />
                    </div>
                    <div className="filter-group">
                      <label>По:</label>
                      <input
                        type="date"
                        value={dateFilter.endDate || ''}
                        onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {dateFilter.type === 'month' && (
                  <>
                    <div className="filter-group">
                      <label>Месяц:</label>
                      <select
                        value={dateFilter.month}
                        onChange={(e) => setDateFilter({ ...dateFilter, month: parseInt(e.target.value) })}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                          <option key={m} value={m}>
                            {new Date(2000, m - 1).toLocaleString('ru-RU', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-group">
                      <label>Год:</label>
                      <input
                        type="number"
                        min="2020"
                        max="2100"
                        value={dateFilter.year}
                        onChange={(e) => setDateFilter({ ...dateFilter, year: parseInt(e.target.value) })}
                      />
                    </div>
                  </>
                )}
              </div>

              <button className="btn btn-primary" onClick={handleExportAppointments}>
                📥 Выгрузить записи в Excel
              </button>
            </div>
            </div>

            {/* Экспорт клиентов */}
            <div className="export-section">
              <h3>👥 Экспорт базы клиентов</h3>
              <p>Выгрузить всю базу клиентов с полной информацией</p>
              <button className="btn btn-primary" onClick={handleExportClients}>
                📥 Выгрузить базу клиентов в Excel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatisticsPage;

