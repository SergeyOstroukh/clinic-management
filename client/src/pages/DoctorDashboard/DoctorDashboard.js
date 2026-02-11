import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import DoctorCalendar from '../../components/DoctorCalendar/DoctorCalendar';
import './DoctorDashboard.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

// === Константы формы 037/у (дублируем из CompleteVisit для использования в отложенных) ===
const VISIT_TYPES = [
  { value: 'primary', label: 'Первичное' },
  { value: 'repeat', label: 'Повторное' },
  { value: 'preventive', label: 'Профилактическое' },
  { value: 'consultation', label: 'Консультация' },
  { value: 'emergency', label: 'Неотложное' },
];

const PREVENTIVE_CODES = [
  { value: '3', label: '3 — Профосмотр (самостоятельно)' },
  { value: '4', label: '4 — Здоровые, ранее санированные' },
  { value: '5', label: '5 — Санированы по обращению' },
  { value: '6', label: '6 — Осмотрены в плановом порядке' },
  { value: '7', label: '7 — Здоровые, ранее санированные (плановые)' },
  { value: '8', label: '8 — Санированы в плановом порядке' },
];

const DIAGNOSIS_CODES_039 = [
  { code: '10',  label: 'Зубные отложения (К03.6)' },
  { code: '20',  label: 'Некариозные поражения постоянных зубов' },
  { code: '21',  label: 'Некариозные поражения временных зубов' },
  { code: '30',  label: 'Кариес постоянных зубов (К02)' },
  { code: '31',  label: 'Кариес временных зубов' },
  { code: '40',  label: 'Пульпит постоянных зубов (К04.0-К04.3)' },
  { code: '41',  label: 'Пульпит временных зубов' },
  { code: '50',  label: 'Апикальный периодонтит постоянных зубов' },
  { code: '51',  label: 'Апикальный периодонтит временных зубов' },
  { code: '60',  label: 'Болезни пародонта (К05)' },
  { code: '61',  label: 'Другие изменения десны (К06)' },
  { code: '70',  label: 'Заболевания слизистой рта (К12-К14)' },
  { code: '80',  label: 'Кисты корневые (К04.8)' },
  { code: '90',  label: 'Воспалительные заболевания кожи (L)' },
  { code: '91',  label: 'Воспалительные заболевания челюстей' },
  { code: '100', label: 'Поражения нервов (G50, G51, S04)' },
  { code: '101', label: 'Болезни ВНЧС (K07.6)' },
  { code: '103', label: 'Травмы костей, перелом зуба (S02)' },
  { code: '106', label: 'Новообразования (C00-C06, D00)' },
  { code: '108', label: 'Нарушение развития зубов (К00, К01)' },
  { code: '109', label: 'Частичная адентия' },
  { code: '110', label: 'Полная адентия' },
  { code: '111', label: 'Оставшийся корень зуба (К08.3)' },
  { code: '117', label: 'Стоматологическое обследование (Z01.2)' },
  { code: '120', label: 'Прочие заболевания' },
];

const TREATMENT_STAGES = [
  { value: 'Л1', label: 'Л1 — Первый этап лечения' },
  { value: 'Л2', label: 'Л2 — Второй этап лечения' },
  { value: 'Л3', label: 'Л3 — Третий этап лечения' },
];

const TREATMENT_CODES_039 = [
  { code: '210', label: 'Беседа, мотивация, обучение гигиене' },
  { code: '230', label: 'Применение фторпрепаратов местно' },
  { code: '240', label: 'Герметизация фиссур' },
  { code: '300', label: 'Удаление зубных отложений' },
  { code: '310', label: 'Шинирование зубов' },
  { code: '320', label: 'Другое лечение пародонта' },
  { code: '330', label: 'Запломбировано постоянных зубов' },
  { code: '340', label: 'Запломбировано временных зубов' },
  { code: '350', label: 'Наложено пломб (всего)' },
  { code: '360', label: 'Эндодонтическое лечение постоянных зубов' },
  { code: '370', label: 'Эндодонтическое лечение временных зубов' },
  { code: '375', label: 'Закончено терапевтическое лечение' },
  { code: '380', label: 'Закончено пародонтологическое лечение' },
  { code: '395', label: 'Отбеливание зубов' },
  { code: '400', label: 'Удалено постоянных зубов' },
  { code: '410', label: 'Удалено временных зубов' },
  { code: '420', label: 'Амбулаторно-хирургическая операция' },
  { code: '436', label: 'Операция дентальной имплантации' },
  { code: '460', label: 'Закончено хирургическое лечение' },
  { code: '510', label: 'Изготовлено ортодонтических аппаратов' },
  { code: '610', label: 'Одиночная коронка' },
  { code: '620', label: 'Мостовидный протез' },
  { code: '650', label: 'Съемный протез' },
  { code: '660', label: 'Закончено ортопедическое лечение' },
  { code: '700', label: 'Обезболивание общее' },
  { code: '710', label: 'Обезболивание местное' },
];

const DoctorDashboard = ({ currentUser, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('schedule');
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

  // Состояние для вкладки «Отложенные»
  const [deferredList, setDeferredList] = useState([]);
  const [deferredLoading, setDeferredLoading] = useState(false);
  const [editingId, setEditingId] = useState(null); // какой прием сейчас редактируем
  const [formData, setFormData] = useState({
    visit_type: '', preventive_work: '', diagnosis_code: '',
    treatment_stage: '', treatment_code: '', treatment_description: '',
  });
  const [submittingForm, setSubmittingForm] = useState(false);
  const [deferredCount, setDeferredCount] = useState(0);

  useEffect(() => {
    if (currentUser?.doctor_id) {
      loadDoctorData();
      loadDeferredCount();
    } else {
      console.error('doctor_id не найден в currentUser:', currentUser);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const loadDoctorData = async () => {
    try {
      setLoading(true);
      if (!currentUser?.doctor_id) {
        throw new Error('doctor_id не найден в данных пользователя');
      }
      const response = await axios.get(`${API_URL}/doctors/${currentUser.doctor_id}`);
      if (response.data) {
        setDoctor(response.data);
      } else {
        throw new Error('Данные врача не получены');
      }
    } catch (error) {
      console.error('Ошибка загрузки данных врача:', error);
      alert(`Ошибка загрузки данных врача: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка количества отложенных (для бейджа на вкладке)
  const loadDeferredCount = useCallback(async () => {
    if (!currentUser?.doctor_id) return;
    try {
      const res = await axios.get(`${API_URL}/appointments/deferred-forms`, {
        params: { doctor_id: currentUser.doctor_id }
      });
      setDeferredCount(res.data.length);
    } catch (err) {
      console.error('Ошибка загрузки количества отложенных:', err);
    }
  }, [currentUser?.doctor_id]);

  // Загрузка полного списка отложенных
  const loadDeferredList = useCallback(async () => {
    if (!currentUser?.doctor_id) return;
    setDeferredLoading(true);
    try {
      const res = await axios.get(`${API_URL}/appointments/deferred-forms`, {
        params: { doctor_id: currentUser.doctor_id }
      });
      setDeferredList(res.data);
      setDeferredCount(res.data.length);
    } catch (err) {
      console.error('Ошибка загрузки отложенных форм:', err);
    } finally {
      setDeferredLoading(false);
    }
  }, [currentUser?.doctor_id]);

  // Подгружаем при переключении на вкладку
  useEffect(() => {
    if (activeTab === 'deferred') {
      loadDeferredList();
    }
  }, [activeTab, loadDeferredList]);

  // Слушаем real-time обновления (при завершении приема с «заполнить позже»)
  useEffect(() => {
    const handler = () => {
      loadDeferredCount();
      if (activeTab === 'deferred') loadDeferredList();
    };
    window.addEventListener('appointmentUpdated', handler);
    return () => window.removeEventListener('appointmentUpdated', handler);
  }, [activeTab, loadDeferredCount, loadDeferredList]);

  const startEditing = (item) => {
    setEditingId(item.id);
    setFormData({
      visit_type: '', preventive_work: '', diagnosis_code: '',
      treatment_stage: '', treatment_code: '', treatment_description: '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setFormData({
      visit_type: '', preventive_work: '', diagnosis_code: '',
      treatment_stage: '', treatment_code: '', treatment_description: '',
    });
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const submitDeferredForm = async () => {
    setSubmittingForm(true);
    try {
      await axios.patch(`${API_URL}/appointments/${editingId}/fill-deferred-form`, formData);
      setEditingId(null);
      setFormData({
        visit_type: '', preventive_work: '', diagnosis_code: '',
        treatment_stage: '', treatment_code: '', treatment_description: '',
      });
      // Обновляем список — заполненная запись пропадёт
      await loadDeferredList();
      window.dispatchEvent(new Event('appointmentUpdated'));
    } catch (error) {
      console.error('Ошибка сохранения формы:', error);
      alert(`Ошибка: ${error.response?.data?.error || error.message}`);
    } finally {
      setSubmittingForm(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return dateStr; }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      if (dateStr.includes(' ')) return dateStr.split(' ')[1]?.substring(0, 5) || '';
      if (dateStr.includes('T')) return dateStr.split('T')[1]?.substring(0, 5) || '';
      return '';
    } catch { return ''; }
  };

  if (loading) {
    return (
      <div className="doctor-dashboard">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="doctor-dashboard">
        <div className="error">Ошибка: данные врача не найдены</div>
      </div>
    );
  }

  return (
    <div className="doctor-dashboard">
      <div className="dashboard-header">
        <div>
          <h2>👨‍⚕️ Личный кабинет врача</h2>
          <p className="doctor-name">
            {doctor.lastName} {doctor.firstName} {doctor.middleName || ''}
            {doctor.specialization && ` • ${doctor.specialization}`}
          </p>
        </div>
        <button className="btn" onClick={() => onNavigate('home')}>
          ← Назад
        </button>
      </div>

      {/* Вкладки */}
      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          📅 Расписание и записи
        </button>
        <button
          className={`tab ${activeTab === 'deferred' ? 'active' : ''}`}
          onClick={() => setActiveTab('deferred')}
        >
          📋 Отложенные формы
          {deferredCount > 0 && (
            <span className="tab-deferred-badge">{deferredCount}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          🗓️ Сегодня
        </button>
        <button
          className={`tab ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          📊 Статистика
        </button>
      </div>

      {/* Контент вкладок */}
      <div className="dashboard-content">
        {activeTab === 'schedule' && (
          <div className="schedule-tab">
            <DoctorCalendar 
              currentUser={currentUser}
              onAppointmentClick={(appointment) => {
                console.log('Клик на запись:', appointment);
              }}
            />
          </div>
        )}

        {activeTab === 'deferred' && (
          <div className="deferred-tab">
            <h3>📋 Отложенные данные для формы 037/у</h3>
            <p className="deferred-hint">
              Здесь отображаются приёмы, для которых вы отложили заполнение данных формы 037/у. 
              Заполните данные — и запись автоматически исчезнет из этого списка.
            </p>

            {deferredLoading ? (
              <div className="loading">Загрузка...</div>
            ) : deferredList.length === 0 ? (
              <div className="deferred-empty">
                <span className="deferred-empty-icon">✅</span>
                <p>Нет отложенных форм — все данные заполнены!</p>
              </div>
            ) : (
              <div className="deferred-list">
                {deferredList.map(item => {
                  const patientName = [item.lastName, item.firstName, item.middleName].filter(Boolean).join(' ') || 'Без имени';
                  const date = formatDate(item.appointment_date);
                  const time = formatTime(item.appointment_date);
                  const isEditing = editingId === item.id;

                  return (
                    <div key={item.id} className={`deferred-card ${isEditing ? 'deferred-card-editing' : ''}`}>
                      <div className="deferred-card-header">
                        <div className="deferred-card-info">
                          <span className="deferred-card-patient">👤 {patientName}</span>
                          <span className="deferred-card-date">📅 {date}{time ? ` в ${time}` : ''}</span>
                          {item.diagnosis && (
                            <span className="deferred-card-diagnosis">🩺 {item.diagnosis}</span>
                          )}
                        </div>
                        {!isEditing ? (
                          <button className="btn btn-primary btn-small" onClick={() => startEditing(item)}>
                            ✏️ Заполнить
                          </button>
                        ) : (
                          <button className="btn btn-secondary btn-small" onClick={cancelEditing}>
                            ✕ Отмена
                          </button>
                        )}
                      </div>

                      {isEditing && (
                        <div className="deferred-form">
                          <div className="deferred-form-row">
                            <div className="deferred-form-col">
                              <label className="deferred-form-label">Вид посещения</label>
                              <select
                                value={formData.visit_type}
                                onChange={(e) => handleFormChange('visit_type', e.target.value)}
                                className="deferred-form-select"
                              >
                                <option value="">— Не указано —</option>
                                {VISIT_TYPES.map(t => (
                                  <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="deferred-form-col">
                              <label className="deferred-form-label">Лечебно-проф. работа (коды 3-8)</label>
                              <select
                                value={formData.preventive_work}
                                onChange={(e) => handleFormChange('preventive_work', e.target.value)}
                                className="deferred-form-select"
                              >
                                <option value="">— Не указано —</option>
                                {PREVENTIVE_CODES.map(c => (
                                  <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="deferred-form-row">
                            <div className="deferred-form-col">
                              <label className="deferred-form-label">Код диагноза (графа 9)</label>
                              <select
                                value={formData.diagnosis_code}
                                onChange={(e) => handleFormChange('diagnosis_code', e.target.value)}
                                className="deferred-form-select"
                              >
                                <option value="">— Выберите —</option>
                                {DIAGNOSIS_CODES_039.map(d => (
                                  <option key={d.code} value={d.code}>{d.code} — {d.label}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                placeholder="Или введите код вручную"
                                value={formData.diagnosis_code}
                                onChange={(e) => handleFormChange('diagnosis_code', e.target.value)}
                                className="deferred-form-input"
                              />
                            </div>
                            <div className="deferred-form-col">
                              <label className="deferred-form-label">Этап лечения (графа 10)</label>
                              <select
                                value={formData.treatment_stage}
                                onChange={(e) => handleFormChange('treatment_stage', e.target.value)}
                                className="deferred-form-select"
                              >
                                <option value="">— Не указано —</option>
                                {TREATMENT_STAGES.map(s => (
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="deferred-form-row">
                            <div className="deferred-form-col">
                              <label className="deferred-form-label">Код лечения (графа 11)</label>
                              <select
                                value={formData.treatment_code}
                                onChange={(e) => handleFormChange('treatment_code', e.target.value)}
                                className="deferred-form-select"
                              >
                                <option value="">— Выберите —</option>
                                {TREATMENT_CODES_039.map(c => (
                                  <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                placeholder="Или введите код вручную"
                                value={formData.treatment_code}
                                onChange={(e) => handleFormChange('treatment_code', e.target.value)}
                                className="deferred-form-input"
                              />
                            </div>
                            <div className="deferred-form-col">
                              <label className="deferred-form-label">Описание лечения</label>
                              <textarea
                                placeholder="Что было сделано..."
                                value={formData.treatment_description}
                                onChange={(e) => handleFormChange('treatment_description', e.target.value)}
                                className="deferred-form-textarea"
                                rows={2}
                              />
                            </div>
                          </div>

                          <div className="deferred-form-actions">
                            <button
                              className="btn btn-primary"
                              onClick={submitDeferredForm}
                              disabled={submittingForm}
                            >
                              {submittingForm ? 'Сохранение...' : '✅ Сохранить данные формы'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'today' && (
          <div className="today-tab">
            <h3>🗓️ Записи на сегодня</h3>
            <p className="tab-placeholder">
              Функция "Сегодня" будет реализована в следующем обновлении.
              <br />
              Здесь будет отображаться список записей на сегодня с возможностью быстрого доступа к карточке пациента.
            </p>
          </div>
        )}

        {activeTab === 'statistics' && (
          <div className="statistics-tab">
            <h3>📊 Статистика</h3>
            <p className="tab-placeholder">
              Функция "Статистика" будет реализована в следующем обновлении.
              <br />
              Здесь будет отображаться статистика по записям, доходам и другим показателям.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorDashboard;

