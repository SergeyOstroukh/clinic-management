import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import FORM_039_ROWS from './form039rows';
import './ReportsFormsPage.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

// Виды посещений для формы 037/у
const VISIT_TYPES = [
  { value: 'primary', label: 'Первичное' },
  { value: 'repeat', label: 'Повторное' },
  { value: 'preventive', label: 'Профилактическое' },
  { value: 'consultation', label: 'Консультация' },
  { value: 'emergency', label: 'Неотложное' },
];

// Коды лечебно-профилактической работы (коды 3-8 из формы 039/у)
const PREVENTIVE_CODES = [
  { value: '3', label: '3 — Профосмотр (самостоятельно)' },
  { value: '4', label: '4 — Здоровые, ранее санированные' },
  { value: '5', label: '5 — Санированы по обращению' },
  { value: '6', label: '6 — Осмотрены в плановом порядке' },
  { value: '7', label: '7 — Здоровые, ранее санированные (плановые)' },
  { value: '8', label: '8 — Санированы в плановом порядке' },
];

// Коды диагнозов формы 039/у (числовые) — полный список из приложения 2
const DIAGNOSIS_CODES_039 = [
  { code: '10',  label: 'Зубные отложения (К03.6)' },
  { code: '20',  label: 'Некариозные поражения постоянных зубов (К00.3-К00.5, К03.1, К03.2)' },
  { code: '21',  label: 'Некариозные поражения временных зубов' },
  { code: '30',  label: 'Кариес постоянных зубов (К02)' },
  { code: '31',  label: 'Кариес временных зубов' },
  { code: '40',  label: 'Пульпит постоянных зубов (К04.0-К04.3)' },
  { code: '41',  label: 'Пульпит временных зубов' },
  { code: '50',  label: 'Апикальный периодонтит постоянных зубов (К04.4-К04.7, К04.9)' },
  { code: '51',  label: 'Апикальный периодонтит временных зубов' },
  { code: '60',  label: 'Болезни пародонта (К05)' },
  { code: '61',  label: 'Другие изменения десны и беззубого альвеолярного края (К06)' },
  { code: '62',  label: 'Атрофия беззубого альвеолярного отростка (К08.2)' },
  { code: '70',  label: 'Заболевания слизистой оболочки рта (К12-К12.1, К13, К14)' },
  { code: '80',  label: 'Кисты корневые (К04.8)' },
  { code: '81',  label: 'Кисты полости рта (К09)' },
  { code: '90',  label: 'Воспалительные заболевания кожи и подкожной клетчатки (L)' },
  { code: '91',  label: 'Воспалительные заболевания челюстей (К10.2, К10.3, К10.9)' },
  { code: '92',  label: 'Флегмона и абсцессы (К12.2)' },
  { code: '100', label: 'Поражения тройничного и лицевого нервов (G50, G51, S04)' },
  { code: '101', label: 'Болезни височно-нижнечелюстного сустава (K07.6)' },
  { code: '102', label: 'Болезни слюнных желез (К11)' },
  { code: '103', label: 'Травмы лицевых костей, челюстей, перелом зуба (S02)' },
  { code: '104', label: 'Травмы головы (S00.5, S01.4, S01.5, S03.0, S03.2, S03.4)' },
  { code: '105', label: 'Другие уточненные болезни челюсти, экзостозы (К10.8)' },
  { code: '106', label: 'Новообразования (C00-C06, D00, D10.0-D10.3, D37)' },
  { code: '107', label: 'Челюстно-лицевые и врожденные аномалии (К07.1-К07.5, К10.0, Q35-Q38)' },
  { code: '108', label: 'Нарушение развития и прорезывания зубов (К00.1-К00.2, К00.6-К01)' },
  { code: '109', label: 'Частичная адентия (К00.00, К08.1)' },
  { code: '110', label: 'Полная адентия (К00.01, К08.1)' },
  { code: '111', label: 'Оставшийся корень зуба (К08.3)' },
  { code: '112', label: 'Повышенное стирание зубов (К03.0)' },
  { code: '113', label: 'Патологическая резорбция зубов (К03.3)' },
  { code: '114', label: 'Другие болезни твердых тканей зубов (К03.7, К03.80)' },
  { code: '115', label: 'Другие уточненные болезни твердых тканей зубов (К03.88)' },
  { code: '116', label: 'Верхнечелюстной синусит (J01.0, J01.8, J32.0)' },
  { code: '117', label: 'Стоматологическое обследование (Z01.2)' },
  { code: '118', label: 'Наличие имплантатов зубов и челюсти (Z96.5)' },
  { code: '119', label: 'Наличие зубного протезного устройства (Z97.2)' },
  { code: '120', label: 'Прочие заболевания' },
];

// Этапы лечения (графа 10)
const TREATMENT_STAGES = [
  { value: 'Л1', label: 'Л1 — Первый этап лечения' },
  { value: 'Л2', label: 'Л2 — Второй этап лечения' },
  { value: 'Л3', label: 'Л3 — Третий этап лечения' },
];

// Коды лечения формы 039/у — полный список из приложения 2 (Постановление МЗ РБ №203 от 16.12.2025)
const TREATMENT_CODES_039 = [
  { code: '200', label: 'Проведено консультаций (с выдачей заключения)' },
  { code: '210', label: 'Беседа, мотивация, обучение гигиене' },
  { code: '220', label: 'Контроль гигиены' },
  { code: '230', label: 'Применение фторпрепаратов местно' },
  { code: '231', label: 'Профилактические мероприятия, связанные с лечением начального кариеса' },
  { code: '240', label: 'Проведено герметизаций фиссур (всего)' },
  { code: '241', label: 'Герметизация фиссур инвазивным методом' },
  { code: '300', label: 'Удаление зубных отложений' },
  { code: '301', label: 'Удаление зубных отложений аппаратными методами' },
  { code: '310', label: 'Шинирование зубов' },
  { code: '320', label: 'Другое лечение заболеваний пародонта' },
  { code: '321', label: 'Лечение пародонта с применением лазерных технологий' },
  { code: '330', label: 'Запломбировано постоянных зубов (всего зубов)' },
  { code: '340', label: 'Запломбировано временных зубов (всего зубов)' },
  { code: '350', label: 'Наложено пломб (всего)' },
  { code: '360', label: 'Законченное эндодонтическое лечение постоянных зубов (всего)' },
  { code: '361', label: 'Эндодонтическое лечение по ортопедическим показаниям' },
  { code: '362', label: 'Повторное эндодонтическое лечение' },
  { code: '370', label: 'Законченное эндодонтическое лечение временных зубов (всего)' },
  { code: '375', label: 'Число лиц, закончивших терапевтическое лечение' },
  { code: '380', label: 'Число лиц, закончивших пародонтологическое лечение' },
  { code: '390', label: 'Число лиц, закончивших лечение заболеваний слизистой оболочки рта' },
  { code: '395', label: 'Отбеливание зубов' },
  { code: '400', label: 'Удалено постоянных зубов (всего)' },
  { code: '402', label: 'Удаление по ортодонтическим показаниям' },
  { code: '404', label: 'Удалено дентальных имплантатов (всего)' },
  { code: '410', label: 'Удалено временных зубов (всего)' },
  { code: '411', label: 'Удаление временных зубов по физиологической смене' },
  { code: '420', label: 'Число амбулаторно-хирургических операций (всего)' },
  { code: '430', label: 'Операция в плановом порядке' },
  { code: '432', label: 'Операция на мягких тканях' },
  { code: '434', label: 'Операция на костях лицевого скелета' },
  { code: '435', label: 'Костная аугментация' },
  { code: '436', label: 'Операция дентальной имплантации' },
  { code: '437', label: 'Синус-лифтинг' },
  { code: '438', label: 'Другие операции (экзостозы, органосохраняющие и др.)' },
  { code: '440', label: 'Операция по экстренным показаниям' },
  { code: '442', label: 'Операция по поводу травм' },
  { code: '444', label: 'Операция по поводу воспалительных заболеваний' },
  { code: '446', label: 'Другие экстренные операции' },
  { code: '450', label: 'Местное лечение открытых ран (перевязки, снятие шин и иное)' },
  { code: '460', label: 'Число лиц, закончивших хирургическое лечение' },
  { code: '500', label: 'Число лиц, взятых на ортодонтическое лечение (всего)' },
  { code: '510', label: 'Изготовлено ортодонтических аппаратов и местосохраняющих конструкций (всего)' },
  { code: '511', label: 'Механический съемный аппарат' },
  { code: '512', label: 'Механический несъемный аппарат' },
  { code: '513', label: 'Функциональный аппарат' },
  { code: '514', label: 'Функционально-направляющий аппарат' },
  { code: '515', label: 'Сочетанный аппарат' },
  { code: '516', label: 'Съемный местосохраняющий' },
  { code: '517', label: 'Несъемный местосохраняющий' },
  { code: '520', label: 'Число лиц, закончивших ортодонтическое лечение (всего)' },
  { code: '522', label: 'С аномалиями отдельных зубов' },
  { code: '523', label: 'С аномалиями зубных рядов' },
  { code: '524', label: 'С аномалиями прикуса' },
  { code: '525', label: 'С нарушением развития и прорезывания зубов' },
  { code: '526', label: 'С частичной адентией' },
  { code: '527', label: 'С полной адентией' },
  { code: '600', label: 'Число посещений на льготном зубопротезировании' },
  { code: '601', label: 'Починка протеза' },
  { code: '602', label: 'Виниры' },
  { code: '603', label: 'Штифтовые, штифтово-культевые вкладки' },
  { code: '604', label: 'Вкладки' },
  { code: '610', label: 'Одиночные коронки (всего)' },
  { code: '611', label: 'Коронка штампованная, комбинированная штампованная' },
  { code: '612', label: 'Коронка пластмассовая' },
  { code: '613', label: 'Коронка литая' },
  { code: '614', label: 'Коронка металлокерамическая' },
  { code: '615', label: 'Коронка прессованная' },
  { code: '616', label: 'Коронка CAD/CAM' },
  { code: '617', label: 'Коронка иная' },
  { code: '620', label: 'Мостовидные протезы (всего)' },
  { code: '621', label: 'Мостовидный протез штампованно-паяный' },
  { code: '622', label: 'Мостовидный протез пластмассовый' },
  { code: '623', label: 'Мостовидный протез литой' },
  { code: '624', label: 'Мостовидный протез металлокерамический' },
  { code: '625', label: 'Мостовидный протез прессованный' },
  { code: '626', label: 'Мостовидный протез CAD/CAM' },
  { code: '627', label: 'Мостовидный протез иной' },
  { code: '630', label: 'В мостовидных протезах коронок (всего)' },
  { code: '640', label: 'Провизорная коронка прямым методом' },
  { code: '650', label: 'Съемные протезы (всего)' },
  { code: '651', label: 'Частичный пластиночный протез' },
  { code: '652', label: 'Полный пластиночный протез' },
  { code: '653', label: 'Бюгельный протез' },
  { code: '654', label: 'Прочие съемные протезы' },
  { code: '655', label: 'Изготовлено капп (всего)' },
  { code: '656', label: 'Каппы от апноэ' },
  { code: '660', label: 'Число лиц, закончивших ортопедическое лечение (всего)' },
  { code: '661', label: 'В том числе граждан льготных категорий' },
  { code: '700', label: 'Обезболивание общее' },
  { code: '710', label: 'Обезболивание местное' },
];

// Компонент мультиселекта кодов — модальное окно с поиском и чекбоксами
const MultiCodeSelect = ({ codes, value, onChange, placeholder, disabled }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];

  const toggle = (code) => {
    if (disabled) return;
    const next = selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code];
    onChange(next.join(','));
  };

  const remove = (code) => {
    if (disabled) return;
    onChange(selected.filter(c => c !== code).join(','));
  };

  const filtered = codes.filter(c =>
    !search || c.code.includes(search) || c.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div
        className="multi-code-trigger"
        onClick={() => !disabled && setOpen(true)}
      >
        {selected.length === 0 ? (
          <span className="multi-code-placeholder">{placeholder || '— Выберите —'}</span>
        ) : (
          <div className="multi-code-tags">
            {selected.map(code => {
              const item = codes.find(c => c.code === code);
              return (
                <span key={code} className="multi-code-tag">
                  {code}{item ? ` — ${item.label.substring(0, 30)}${item.label.length > 30 ? '…' : ''}` : ''}
                  <span className="multi-code-tag-x" onClick={(e) => { e.stopPropagation(); remove(code); }}>×</span>
                </span>
              );
            })}
          </div>
        )}
        <span className="multi-code-arrow">▼</span>
      </div>

      {open && ReactDOM.createPortal(
        <div className="mcs-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="mcs-modal">
            <div className="mcs-header">
              <h3>Выбор кодов</h3>
              <span className="mcs-count">Выбрано: {selected.length}</span>
              <button className="mcs-close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="mcs-search-wrap">
              <input
                className="mcs-search"
                type="text"
                placeholder="Поиск по коду или названию..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {selected.length > 0 && (
              <div className="mcs-selected-bar">
                {selected.map(code => {
                  const item = codes.find(c => c.code === code);
                  return (
                    <span key={code} className="multi-code-tag">
                      {code}{item ? ` — ${item.label.substring(0, 20)}${item.label.length > 20 ? '…' : ''}` : ''}
                      <span className="multi-code-tag-x" onClick={() => remove(code)}>×</span>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="mcs-list">
              {filtered.length === 0 ? (
                <div className="mcs-empty">Ничего не найдено</div>
              ) : (
                filtered.map(c => {
                  const isSelected = selected.includes(c.code);
                  return (
                    <label key={c.code} className={`mcs-item ${isSelected ? 'mcs-item-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(c.code)}
                      />
                      <span className="mcs-item-code">{c.code}</span>
                      <span className="mcs-item-label">{c.label}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="mcs-footer">
              <button className="btn btn-primary" onClick={() => setOpen(false)}>
                Готово ({selected.length})
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const ReportsFormsPage = ({ onNavigate, currentUser }) => {
  const [activeTab, setActiveTab] = useState('037');
  const [doctors, setDoctors] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Фильтры
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  
  // Настройки печати
  const [orgName, setOrgName] = useState(localStorage.getItem('clinic_org_name') || '');
  const [structUnit, setStructUnit] = useState(localStorage.getItem('clinic_struct_unit') || '');
  const [doctorRate, setDoctorRate] = useState(localStorage.getItem('clinic_doctor_rate') || '');
  const [workTimeNorm, setWorkTimeNorm] = useState(localStorage.getItem('clinic_work_time_norm') || '');
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  
  // Модалка создания/редактирования записи 037/у
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [recordForm, setRecordForm] = useState({
    doctor_id: '',
    record_date: new Date().toISOString().split('T')[0],
    record_time: '',
    patient_name: '',
    patient_address: '',
    citizenship_data: '',
    patient_age: '',
    visit_type: '',
    preventive_work: '',
    diagnosis_code: '',
    diagnosis_description: '',
    treatment_code: '',
    treatment_description: '',
    treatment_stage: '',
    population_type: 'city',
  });
  
  // Данные отчёта 039/у
  const [report039, setReport039] = useState(null);

  // Форма администратора для заполнения данных 037/039
  const [showAdminFormModal, setShowAdminFormModal] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const clientDropdownRef = useRef(null);
  const [adminForm, setAdminForm] = useState({
    doctor_id: '',
    record_date: new Date().toISOString().split('T')[0],
    record_time: '',
    visit_type: '',
    preventive_work: '',
    diagnosis_code: '',
    diagnosis_description: '',
    treatment_code: '',
    treatment_description: '',
    treatment_stage: '',
  });
  const [adminFormSubmitting, setAdminFormSubmitting] = useState(false);

  // Загрузка врачей
  const loadDoctors = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/doctors`);
      setDoctors(response.data);
      
      // Если текущий пользователь — врач, автоматически выбираем его
      if (currentUser?.role === 'doctor' && currentUser?.doctor_id) {
        setSelectedDoctorId(String(currentUser.doctor_id));
      }
    } catch (error) {
      console.error('Ошибка загрузки врачей:', error);
    }
  }, [currentUser]);

  // Загрузка клиентов (для формы администратора)
  const loadClients = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('Ошибка загрузки клиентов:', error);
    }
  }, []);

  // Загрузка записей 037/у
  const loadRecords = useCallback(async () => {
    if (!selectedDoctorId) {
      setRecords([]);
      return;
    }
    
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('doctor_id', selectedDoctorId);
      params.append('month', filterMonth);
      params.append('year', filterYear);
      
      const response = await axios.get(`${API_URL}/doctor-work-records?${params.toString()}`);
      setRecords(response.data);
    } catch (error) {
      console.error('Ошибка загрузки записей:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId, filterMonth, filterYear]);

  // Загрузка отчёта 039/у
  const loadReport039 = useCallback(async () => {
    if (!selectedDoctorId) {
      setReport039(null);
      return;
    }
    
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('doctor_id', selectedDoctorId);
      params.append('month', filterMonth);
      params.append('year', filterYear);
      
      const response = await axios.get(`${API_URL}/report-039?${params.toString()}`);
      setReport039(response.data);
    } catch (error) {
      console.error('Ошибка загрузки отчёта 039/у:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId, filterMonth, filterYear]);

  useEffect(() => {
    loadDoctors();
    loadClients();
  }, [loadDoctors, loadClients]);

  useEffect(() => {
    if (activeTab === '037') {
      loadRecords();
    } else {
      loadReport039();
    }
  }, [activeTab, loadRecords, loadReport039]);

  // Создание/обновление записи
  const handleSaveRecord = async (e) => {
    e.preventDefault();
    
    try {
      if (editingRecord) {
        await axios.put(`${API_URL}/doctor-work-records/${editingRecord.id}`, recordForm);
      } else {
        await axios.post(`${API_URL}/doctor-work-records`, recordForm);
      }
      
      setShowRecordModal(false);
      setEditingRecord(null);
      resetForm();
      loadRecords();
    } catch (error) {
      console.error('Ошибка сохранения записи:', error);
      alert('Ошибка сохранения: ' + (error.response?.data?.error || error.message));
    }
  };

  // Удаление записи
  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Удалить эту запись?')) return;
    
    try {
      await axios.delete(`${API_URL}/doctor-work-records/${id}`);
      loadRecords();
    } catch (error) {
      console.error('Ошибка удаления записи:', error);
      alert('Ошибка удаления: ' + (error.response?.data?.error || error.message));
    }
  };

  // Открыть модалку для редактирования
  const handleEditRecord = (record) => {
    setEditingRecord(record);
    setRecordForm({
      doctor_id: record.doctor_id,
      record_date: record.record_date ? record.record_date.split('T')[0] : '',
      record_time: record.record_time || '',
      patient_name: record.patient_name || '',
      patient_address: record.patient_address || '',
      citizenship_data: record.citizenship_data || '',
      patient_age: record.patient_age || '',
      visit_type: record.visit_type || '',
      preventive_work: record.preventive_work || '',
      diagnosis_code: record.diagnosis_code || '',
      diagnosis_description: record.diagnosis_description || '',
      treatment_code: record.treatment_code || '',
      treatment_description: record.treatment_description || '',
      treatment_stage: record.treatment_stage || '',
      population_type: record.population_type || 'city',
    });
    setShowRecordModal(true);
  };

  // Открыть модалку для создания
  const handleNewRecord = () => {
    setEditingRecord(null);
    resetForm();
    setRecordForm(prev => ({
      ...prev,
      doctor_id: selectedDoctorId || '',
      record_date: new Date().toISOString().split('T')[0],
    }));
    setShowRecordModal(true);
  };

  const resetForm = () => {
    setRecordForm({
      doctor_id: selectedDoctorId || '',
      record_date: new Date().toISOString().split('T')[0],
      record_time: '',
      patient_name: '',
      patient_address: '',
      citizenship_data: '',
      patient_age: '',
      visit_type: '',
      preventive_work: '',
      diagnosis_code: '',
      diagnosis_description: '',
      treatment_code: '',
      treatment_description: '',
      treatment_stage: '',
      population_type: 'city',
    });
  };

  // Формирует составной код посещения по инструкции п.14:
  // Первичное: 1.2 (город дети), 1.3 (город взрослые), 1.5 (село дети), 1.6 (село взрослые)
  // Повторное: 2.2, 2.3, 2.5, 2.6
  const getVisitTypeCode = (record) => {
    if (!record.visit_type) return '-';
    const vt = record.visit_type;
    if (vt !== 'primary' && vt !== 'repeat') {
      // Для нестандартных типов (профилактическое, консультация и т.д.) показываем текст
      const type = VISIT_TYPES.find(t => t.value === vt);
      return type ? type.label : vt;
    }
    const prefix = vt === 'primary' ? '1' : '2';
    const isCity = !record.population_type || record.population_type === 'city';
    const isChild = record.patient_age !== null && record.patient_age !== undefined && record.patient_age < 18;
    
    if (isCity) {
      return isChild ? `${prefix}.2` : `${prefix}.3`;
    } else {
      return isChild ? `${prefix}.5` : `${prefix}.6`;
    }
  };

  const getSelectedDoctorName = () => {
    const doctor = doctors.find(d => d.id === parseInt(selectedDoctorId));
    if (!doctor) return '';
    return `${doctor.lastName} ${doctor.firstName} ${doctor.middleName || ''}`.trim();
  };

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  // Сохранение настроек печати
  const savePrintSettings = () => {
    localStorage.setItem('clinic_org_name', orgName);
    localStorage.setItem('clinic_struct_unit', structUnit);
    localStorage.setItem('clinic_doctor_rate', doctorRate);
    localStorage.setItem('clinic_work_time_norm', workTimeNorm);
    setShowPrintSettings(false);
  };

  // Печать
  const handlePrint = () => {
    window.print();
  };

  // Получаем объект выбранного врача
  const getSelectedDoctor = () => {
    return doctors.find(d => d.id === parseInt(selectedDoctorId)) || null;
  };

  // === ЛОГИКА ФОРМЫ АДМИНИСТРАТОРА ===

  // Вычисление возраста по дате рождения
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return '';
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : '';
  };

  // Фильтрация клиентов по поиску
  const filteredClients = clients.filter(c => {
    if (!clientSearch) return false; // не показывать всех при пустом поиске
    const search = clientSearch.toLowerCase();
    const fullName = `${c.lastName || ''} ${c.firstName || ''} ${c.middleName || ''}`.toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    return fullName.includes(search) || phone.includes(search);
  });

  // Выбор клиента
  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSearch(`${client.lastName || ''} ${client.firstName || ''} ${client.middleName || ''}`.trim());
    setShowClientDropdown(false);
  };

  // Сброс выбора клиента
  const handleClearClient = () => {
    setSelectedClient(null);
    setClientSearch('');
  };

  // Открыть форму администратора
  const handleOpenAdminForm = () => {
    setSelectedClient(null);
    setClientSearch('');
    setAdminForm({
      doctor_id: selectedDoctorId || '',
      record_date: new Date().toISOString().split('T')[0],
      record_time: '',
      visit_type: '',
      preventive_work: '',
      diagnosis_code: '',
      diagnosis_description: '',
      treatment_code: '',
      treatment_description: '',
      treatment_stage: '',
    });
    setShowAdminFormModal(true);
  };

  // Отправка формы администратора
  const handleAdminFormSubmit = async (e) => {
    e.preventDefault();

    if (!selectedClient) {
      alert('Выберите пациента из списка');
      return;
    }
    if (!adminForm.doctor_id) {
      alert('Выберите врача');
      return;
    }
    if (!adminForm.record_date) {
      alert('Укажите дату приёма');
      return;
    }

    const patientName = `${selectedClient.lastName || ''} ${selectedClient.firstName || ''} ${selectedClient.middleName || ''}`.trim();
    const patientAge = calculateAge(selectedClient.date_of_birth);
    const populationType = selectedClient.population_type || 'city';

    setAdminFormSubmitting(true);
    try {
      await axios.post(`${API_URL}/doctor-work-records`, {
        doctor_id: adminForm.doctor_id,
        record_date: adminForm.record_date,
        record_time: adminForm.record_time || null,
        patient_name: patientName,
        patient_address: selectedClient.address || null,
        citizenship_data: selectedClient.citizenship_data || null,
        patient_age: patientAge || null,
        visit_type: adminForm.visit_type || null,
        preventive_work: adminForm.preventive_work || null,
        diagnosis_code: adminForm.diagnosis_code || null,
        diagnosis_description: adminForm.diagnosis_description || null,
        treatment_code: adminForm.treatment_code || null,
        treatment_description: adminForm.treatment_description || null,
        treatment_stage: adminForm.treatment_stage || null,
        population_type: populationType,
      });

      setShowAdminFormModal(false);
      alert('Данные для форм 037/039 успешно сохранены!');
      // Обновляем данные таблиц если выбран тот же врач
      if (String(adminForm.doctor_id) === String(selectedDoctorId)) {
        loadRecords();
        loadReport039();
      }
    } catch (error) {
      console.error('Ошибка сохранения данных формы:', error);
      alert('Ошибка сохранения: ' + (error.response?.data?.error || error.message));
    } finally {
      setAdminFormSubmitting(false);
    }
  };

  // Закрытие дропдауна клиентов при клике вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target)) {
        setShowClientDropdown(false);
      }
    };
    if (showClientDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showClientDropdown]);

  // === РЕНДЕР ФОРМЫ 037/у ===
  const renderForm037 = () => {
    const doctor = getSelectedDoctor();

    return (
    <div className="form-037-container">
      {/* Шапка — только на экране */}
      <div className="form-037-header no-print">
        <div className="form-header-info">
          <h3>Листок учёта работы врача-специалиста стоматологического профиля</h3>
          <p className="form-subtitle">Форма № 037/у (Постановление МЗ РБ от 16.12.2025 № 203)</p>
          {selectedDoctorId && (
            <div className="form-doctor-info">
              <span><strong>Врач:</strong> {getSelectedDoctorName()}</span>
              <span><strong>Период:</strong> {monthNames[filterMonth - 1]} {filterYear}</span>
              <span><strong>Записей:</strong> {records.length}</span>
            </div>
          )}
        </div>
        <div className="form-header-actions">
          {selectedDoctorId && records.length > 0 && (
            <>
              <button className="btn" onClick={() => setShowPrintSettings(true)} title="Настройки печати">
                ⚙️ Настройки печати
              </button>
              <button className="btn btn-print" onClick={handlePrint} title="Распечатать форму">
                🖨️ Печать
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={handleNewRecord} disabled={!selectedDoctorId}>
            + Добавить запись
          </button>
        </div>
      </div>

      {/* === ПЕЧАТНАЯ ШАПКА (видна только при печати) === */}
      {selectedDoctorId && records.length > 0 && (
        <div className="print-only print-header-037">
          <div className="print-form-number">Форма № 037/у</div>
          <div className="print-org-name">{orgName || '_______________________________________________'}</div>
          <div className="print-org-label">(наименование организации здравоохранения)</div>
          
          <h2 className="print-title">ЛИСТОК<br/>учёта работы врача-специалиста стоматологического профиля, зубного фельдшера</h2>
          
          <div className="print-info-row">
            <span>Наименование структурного подразделения: <u>{structUnit || '________________________'}</u></span>
          </div>
          <div className="print-info-row">
            <span>Фамилия, собственное имя, отчество врача-специалиста: <u>{doctor ? `${doctor.lastName} ${doctor.firstName} ${doctor.middleName || ''}` : '________________________'}</u></span>
          </div>
          <div className="print-info-row">
            <span>Ставка: <u>{doctorRate || '________'}</u></span>
            <span style={{ marginLeft: '40px' }}>Период: <u>{monthNames[filterMonth - 1]} {filterYear} г.</u></span>
          </div>
        </div>
      )}

      {!selectedDoctorId ? (
        <div className="empty-state no-print">
          <p>Выберите врача для просмотра листка учёта</p>
        </div>
      ) : loading ? (
        <div className="empty-state no-print"><p>Загрузка...</p></div>
      ) : records.length === 0 ? (
        <div className="empty-state no-print">
          <p>Нет записей за выбранный период</p>
          <button className="btn btn-primary" onClick={handleNewRecord}>+ Добавить первую запись</button>
        </div>
      ) : (
        <div className="form-037-table-wrapper">
          <table className="form-037-table">
            <thead>
              <tr>
                <th className="col-num print-col-num">№ п/п</th>
                <th className="col-date print-col-date">Дата, время приёма</th>
                <th className="col-name print-col-name">Фамилия, собственное имя, отчество пациента</th>
                <th className="col-address print-col-address">Адрес места жительства (пребывания) (для граждан РБ)</th>
                <th className="col-citizenship print-col-citizenship no-screen">Данные о гражданстве (для иностранных граждан)</th>
                <th className="col-age print-col-age">Полных лет</th>
                <th className="col-visit print-col-visit">Вид посещения</th>
                <th className="col-preventive print-col-preventive">Лечебно-проф. работа (коды строк 3-8)</th>
                <th className="col-diagnosis print-col-diag">Диагноз в соотв. с МКБ-10С*, описание</th>
                <th className="col-diagcode print-col-diagcode">Код</th>
                <th className="col-stage print-col-stage">Вид лечения</th>
                <th className="col-treatment print-col-treat">Коды, описание лечения</th>
                <th className="col-actions no-print">Действия</th>
              </tr>
              {/* Нумерация столбцов (графы 1-11) — видна при печати */}
              <tr className="print-only col-numbers-row">
                <th></th>{/* пустая ячейка под "№ п/п" (не является официальной графой) */}
                <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>
                <th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>11</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={record.id}>
                  <td className="col-num">{index + 1}</td>
                  <td className="col-date">
                    <div>{record.record_date ? new Date(record.record_date).toLocaleDateString('ru-RU') : '-'}</div>
                    {record.record_time && <div className="time-small">{record.record_time}</div>}
                  </td>
                  <td className="col-name">{record.patient_name}</td>
                  <td className="col-address">
                    {record.patient_address || ''}
                  </td>
                  <td className="col-citizenship no-screen">
                    {record.citizenship_data || ''}
                  </td>
                  <td className="col-age">{record.patient_age || ''}</td>
                  <td className="col-visit">{getVisitTypeCode(record)}</td>
                  <td className="col-preventive">{record.preventive_work || ''}</td>
                  <td className="col-diagnosis">
                    {record.diagnosis_description || ''}
                  </td>
                  <td className="col-diagcode">{record.diagnosis_code || ''}</td>
                  <td className="col-stage">{record.treatment_stage || ''}</td>
                  <td className="col-treatment">
                    {record.treatment_code && <span>{record.treatment_code} </span>}
                    {record.treatment_description || ''}
                  </td>
                  <td className="col-actions no-print">
                    <button className="btn btn-small" onClick={() => handleEditRecord(record)} title="Редактировать">
                      ✏️
                    </button>
                    <button className="btn btn-small btn-danger" onClick={() => handleDeleteRecord(record.id)} title="Удалить">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Печатный подвал 037/у — точно как в PDF (Приложение 1) */}
      {selectedDoctorId && records.length > 0 && (
        <div className="print-only print-footer-037">
          <div className="print-footnote-line">______________________________</div>
          <p className="print-footnote">* Международная классификация стоматологических болезней на основе Международной классификации болезней и проблем, связанных со здоровьем, десятого пересмотра.</p>
        </div>
      )}
    </div>
    );
  };

  // === РЕНДЕР ФОРМЫ 039/у ===
  const renderForm039 = () => {
    if (!selectedDoctorId) {
      return (
        <div className="empty-state">
          <p>Выберите врача для формирования дневника учёта</p>
        </div>
      );
    }

    if (loading) {
      return <div className="empty-state"><p>Загрузка отчёта...</p></div>;
    }

    const hasData = report039 && report039.records && report039.records.length > 0;
    const doctor = hasData ? report039.doctor : getSelectedDoctor();
    const summary = hasData ? report039.summary : null;
    const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();

    // Помощники: город/село, дети/взрослые
    const isCity = (r) => (r.population_type || 'city') === 'city';
    const isRural = (r) => r.population_type === 'rural';
    const isChild = (r) => r.patient_age !== null && r.patient_age !== undefined && r.patient_age < 18;
    const isAdult = (r) => r.patient_age === null || r.patient_age === undefined || r.patient_age >= 18;
    // Проверка: содержит ли поле (возможно через запятую) конкретный код
    const fieldHasCode = (fieldValue, code) => {
      if (!fieldValue) return false;
      return fieldValue.split(',').map(s => s.trim()).includes(code);
    };

    // Вычислить значение ячейки для конкретной строки и дня (или итого)
    const getCellValue = (rowCode, day) => {
      if (!summary || !summary.dailyData) return '';

      const dayRecords = day === 'total' ? null : (summary.dailyData[day] || []);
      
      // Функция фильтрации записей по условию
      const countByFilter = (filterFn) => {
        if (day === 'total') {
          let total = 0;
          Object.values(summary.dailyData).forEach(recs => {
            total += recs.filter(filterFn).length;
          });
          return total;
        }
        return dayRecords.filter(filterFn).length;
      };

      let count = 0;
      const code = rowCode;

      // === ПОСЕЩЕНИЯ ===
      // 0 — всего посещений
      if (code === '0') count = countByFilter(() => true);
      // 0.1 — городское население (всего)
      else if (code === '0.1') count = countByFilter(r => isCity(r));
      // 0.2 — городское детское
      else if (code === '0.2') count = countByFilter(r => isCity(r) && isChild(r));
      // 0.3 — городское взрослое
      else if (code === '0.3') count = countByFilter(r => isCity(r) && isAdult(r));
      // 0.4 — сельское население (всего)
      else if (code === '0.4') count = countByFilter(r => isRural(r));
      // 0.5 — сельское детское
      else if (code === '0.5') count = countByFilter(r => isRural(r) && isChild(r));
      // 0.6 — сельское взрослое
      else if (code === '0.6') count = countByFilter(r => isRural(r) && isAdult(r));
      // 1 — первичные (всего)
      else if (code === '1') count = countByFilter(r => r.visit_type === 'primary');
      // 1.1 — первичные город (всего)
      else if (code === '1.1') count = countByFilter(r => r.visit_type === 'primary' && isCity(r));
      // 1.2 — первичные город дети
      else if (code === '1.2') count = countByFilter(r => r.visit_type === 'primary' && isCity(r) && isChild(r));
      // 1.3 — первичные город взр
      else if (code === '1.3') count = countByFilter(r => r.visit_type === 'primary' && isCity(r) && isAdult(r));
      // 1.4 — первичные село (всего)
      else if (code === '1.4') count = countByFilter(r => r.visit_type === 'primary' && isRural(r));
      // 1.5 — первичные село дети
      else if (code === '1.5') count = countByFilter(r => r.visit_type === 'primary' && isRural(r) && isChild(r));
      // 1.6 — первичные село взр
      else if (code === '1.6') count = countByFilter(r => r.visit_type === 'primary' && isRural(r) && isAdult(r));
      // 2 — повторные (всего)
      else if (code === '2') count = countByFilter(r => r.visit_type === 'repeat');
      // 2.1 — повторные город (всего)
      else if (code === '2.1') count = countByFilter(r => r.visit_type === 'repeat' && isCity(r));
      // 2.2 — повторные город дети
      else if (code === '2.2') count = countByFilter(r => r.visit_type === 'repeat' && isCity(r) && isChild(r));
      // 2.3 — повторные город взр
      else if (code === '2.3') count = countByFilter(r => r.visit_type === 'repeat' && isCity(r) && isAdult(r));
      // 2.4 — повторные село (всего)
      else if (code === '2.4') count = countByFilter(r => r.visit_type === 'repeat' && isRural(r));
      // 2.5 — повторные село дети
      else if (code === '2.5') count = countByFilter(r => r.visit_type === 'repeat' && isRural(r) && isChild(r));
      // 2.6 — повторные село взр
      else if (code === '2.6') count = countByFilter(r => r.visit_type === 'repeat' && isRural(r) && isAdult(r));

      // === ЛЕЧЕБНО-ПРОФИЛАКТИЧЕСКАЯ РАБОТА (коды 3-8) ===
      // 3 — профосмотр (самостоятельно) + подстроки 3.1 для детей
      else if (code === '3') count = countByFilter(r => r.preventive_work === '3');
      else if (code === '3.1') count = countByFilter(r => r.preventive_work === '3' && isChild(r));
      else if (code === '4') count = countByFilter(r => r.preventive_work === '4');
      else if (code === '4.1') count = countByFilter(r => r.preventive_work === '4' && isChild(r));
      else if (code === '5') count = countByFilter(r => r.preventive_work === '5');
      else if (code === '5.1') count = countByFilter(r => r.preventive_work === '5' && isChild(r));
      else if (code === '6') count = countByFilter(r => r.preventive_work === '6');
      else if (code === '6.1') count = countByFilter(r => r.preventive_work === '6' && isChild(r));
      else if (code === '7') count = countByFilter(r => r.preventive_work === '7');
      else if (code === '7.1') count = countByFilter(r => r.preventive_work === '7' && isChild(r));
      else if (code === '8') count = countByFilter(r => r.preventive_work === '8');
      else if (code === '8.1') count = countByFilter(r => r.preventive_work === '8' && isChild(r));

      // === ДИАГНОЗЫ (коды 10–199) ===
      else if (/^\d+$/.test(code) && parseInt(code) >= 10 && parseInt(code) < 200) {
        count = countByFilter(r => fieldHasCode(r.diagnosis_code, code));
      }
      // 200 — Проведено консультаций
      else if (code === '200') {
        count = countByFilter(r => r.visit_type === 'consultation');
      }
      // === ЛЕЧЕБНЫЕ / ПРОЦЕДУРНЫЕ КОДЫ (210+) ===
      else if (/^\d+$/.test(code) && parseInt(code) >= 210) {
        // Маппинг подкодов «в том числе у детей» → родительский код
        const CHILD_SUBCODES = {
          '331': '330', '351': '350', '363': '360',
          '376': '375', '381': '380', '391': '390',
          '401': '400', '403': '402',
          '421': '420', '431': '430', '433': '432',
          '439': '434', '441': '440', '443': '442',
          '445': '444', '447': '446', '451': '450',
          '461': '460', '501': '500', '521': '520',
        };

        // Обратный маппинг: родительский код → все дочерние подкоды
        const PARENT_TO_CHILDREN = {};
        Object.entries(CHILD_SUBCODES).forEach(([child, parent]) => {
          if (!PARENT_TO_CHILDREN[parent]) PARENT_TO_CHILDREN[parent] = [];
          PARENT_TO_CHILDREN[parent].push(child);
        });

        if (CHILD_SUBCODES[code]) {
          // Это дочерний подкод (напр. 401 «дети»).
          // Считаем: записи с родительским кодом (400) + ребёнок < 18,
          //          ИЛИ записи где напрямую выбран этот дочерний код (401)
          const parentCode = CHILD_SUBCODES[code];
          count = countByFilter(r =>
            (fieldHasCode(r.treatment_code, parentCode) && isChild(r)) ||
            fieldHasCode(r.treatment_code, code)
          );
        } else {
          // Это обычный/родительский код (напр. 400 «всего»).
          // Считаем: записи с этим кодом напрямую,
          //          ИЛИ записи где выбран дочерний подкод (401)
          const childCodes = PARENT_TO_CHILDREN[code] || [];
          count = countByFilter(r =>
            fieldHasCode(r.treatment_code, code) ||
            childCodes.some(cc => fieldHasCode(r.treatment_code, cc))
          );
        }
      }
      else return '';

      return count > 0 ? count : '';
    };

    // Считаем итого по строке (сумма по дням)
    const getRowTotal = (rowCode) => {
      const val = getCellValue(rowCode, 'total');
      if (val !== '') return val;

      // Считаем вручную сумму по дням
      let sum = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const v = getCellValue(rowCode, d);
        if (v !== '' && typeof v === 'number') sum += v;
        else if (v !== '') sum += parseInt(v) || 0;
      }
      return sum > 0 ? sum : '';
    };

    return (
      <div className="form-039-container">
        {/* Экранная шапка */}
        <div className="form-039-header no-print">
          <div>
            <h3>Дневник учёта работы врача-специалиста стоматологического профиля</h3>
            <p className="form-subtitle">Форма № 039/у (Постановление МЗ РБ от 16.12.2025 № 203)</p>
            {doctor && (
              <div className="form-doctor-info">
                <span><strong>Врач:</strong> {doctor.lastName} {doctor.firstName} {doctor.middleName || ''}</span>
                <span><strong>Специализация:</strong> {doctor.specialization || '-'}</span>
                <span><strong>Период:</strong> {monthNames[filterMonth - 1]} {filterYear}</span>
              </div>
            )}
          </div>
          <div className="form-header-actions">
            <button className="btn" onClick={() => setShowPrintSettings(true)}>⚙️ Настройки печати</button>
            <button className="btn btn-print" onClick={handlePrint}>🖨️ Печать</button>
          </div>
        </div>

        {/* Печатная шапка 039/у */}
        <div className="print-only print-header-039">
          <div className="print-form-number">Форма № 039/у</div>
          <div className="print-org-name">{orgName || '_______________________________________________'}</div>
          <div className="print-org-label">(наименование организации здравоохранения)</div>
          
          <h2 className="print-title">ДНЕВНИК<br/>учёта работы врача-специалиста стоматологического профиля, зубного фельдшера</h2>
          
          <div className="print-info-row-inline">
            <span><u>{structUnit || '________________________'}</u></span>
            <span className="print-field-label">(наименование структурного подразделения)</span>
            <span><u>{doctor ? `${doctor.lastName} ${doctor.firstName} ${doctor.middleName || ''}` : '________________________'}</u></span>
            <span className="print-field-label">(фамилия, собственное имя, отчество врача)</span>
            <span>за <u>{monthNames[filterMonth - 1]} {filterYear} г.</u></span>
            <span className="print-field-label">(отчётный период)</span>
          </div>
        </div>

        {/* Основная таблица формы 039/у — полная структура */}
        <div className="form-039-table-wrapper">
          <table className="form-039-table">
            <thead>
              <tr>
                <th className="col-039-label">Наименование позиций</th>
                <th className="col-039-code">Код позиции</th>
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <th key={i + 1} className="day-col">{i + 1}</th>
                ))}
                <th className="total-col">Всего</th>
              </tr>
            </thead>
            <tbody>
              {FORM_039_ROWS.map((row, idx) => {
                if (row.section) {
                  // Заголовок раздела — жирная строка на всю ширину
                  return (
                    <tr key={`section-${idx}`} className="row-039-section">
                      <td
                        colSpan={daysInMonth + 3}
                        className="section-label"
                      >
                        {row.label}
                      </td>
                    </tr>
                  );
                }

                const indentClass = row.indent === 1 ? 'indent-1' : row.indent === 2 ? 'indent-2' : '';
                const cellVal = (d) => getCellValue(row.code, d);
                const totalVal = getRowTotal(row.code);

                return (
                  <tr key={`row-${row.code}-${idx}`} className="row-039-data">
                    <td className={`row-label ${indentClass}`}>{row.label}</td>
                    <td className="row-code">{row.code}</td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const val = cellVal(i + 1);
                      return (
                        <td key={i + 1} className={`day-col ${val !== '' ? 'has-value' : ''}`}>
                          {val}
                        </td>
                      );
                    })}
                    <td className={`total-col ${totalVal !== '' ? 'total-value' : ''}`}>
                      {totalVal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Подвал 039/у — точно как в PDF (Приложение 2) */}
        <div className="form-039-footer print-footer-039">
          <div className="print-workdays-row">
            <span>Отработано рабочих дней <u>{summary ? summary.workDaysCount : '____________'}</u></span>
            <span style={{ marginLeft: '30px' }}>Норма рабочего времени в месяц по данной должности служащего <u>{workTimeNorm ? `${workTimeNorm}` : '_______'}</u> часов</span>
          </div>
          <div className="print-signatures">
            <div className="print-signature-block">
              <div className="print-signature-row">
                <span className="print-sign-role">Врач-специалист стоматологического профиля, зубной фельдшер</span>
                <span className="print-sign-underline">________________</span>
                <span className="print-sign-underline">________________________________</span>
              </div>
              <div className="print-signature-row print-sign-labels">
                <span className="print-sign-role"></span>
                <span className="print-sign-label">(подпись)</span>
                <span className="print-sign-label">(инициалы, фамилия)</span>
              </div>
            </div>
            <div className="print-signature-block">
              <div className="print-signature-row">
                <span className="print-sign-role">Руководитель (заведующий отделением)</span>
                <span className="print-sign-underline">________________</span>
                <span className="print-sign-underline">________________________________</span>
              </div>
              <div className="print-signature-row print-sign-labels">
                <span className="print-sign-role"></span>
                <span className="print-sign-label">(подпись)</span>
                <span className="print-sign-label">(инициалы, фамилия)</span>
              </div>
            </div>
          </div>
          <div className="print-footnote-line">______________________________</div>
          <p className="print-footnote">* Цифровое проектирование (или моделирование).</p>
        </div>
      </div>
    );
  };

  return (
    <div className="reports-forms-page">
      {/* Заголовок */}
      <div className="section-header">
        <h2>📋 Отчёты / Формы</h2>
        <div className="section-header-actions">
          {currentUser?.role !== 'doctor' && (
            <button className="btn btn-primary" onClick={handleOpenAdminForm}>
              📝 Заполнить данные для форм 037/039
            </button>
          )}
          <button className="btn" onClick={() => onNavigate('home')}>← Назад</button>
        </div>
      </div>

      {/* Фильтры */}
      <div className="reports-filters">
        {/* Выбор врача — только для администраторов. Врач видит только свои данные */}
        {currentUser?.role !== 'doctor' ? (
          <div className="filter-group">
            <label>Врач</label>
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
            >
              <option value="">Выберите врача</option>
              {doctors.map(doctor => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.lastName} {doctor.firstName} {doctor.middleName || ''} — {doctor.specialization || ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="filter-group">
            <label>Врач</label>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>
              {doctors.find(d => String(d.id) === selectedDoctorId)
                ? `${doctors.find(d => String(d.id) === selectedDoctorId).lastName} ${doctors.find(d => String(d.id) === selectedDoctorId).firstName} ${doctors.find(d => String(d.id) === selectedDoctorId).middleName || ''}`
                : currentUser?.full_name || 'Загрузка...'}
            </span>
          </div>
        )}
        <div className="filter-group">
          <label>Месяц</label>
          <select value={filterMonth} onChange={(e) => setFilterMonth(parseInt(e.target.value))}>
            {monthNames.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Год</label>
          <select value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Вкладки */}
      <div className="reports-tabs">
        <button
          className={`tab-btn ${activeTab === '037' ? 'active' : ''}`}
          onClick={() => setActiveTab('037')}
        >
          Форма 037/у — Листок учёта
        </button>
        <button
          className={`tab-btn ${activeTab === '039' ? 'active' : ''}`}
          onClick={() => setActiveTab('039')}
        >
          Форма 039/у — Дневник учёта
        </button>
      </div>

      {/* Контент вкладки */}
      <div className="tab-content">
        {activeTab === '037' ? renderForm037() : renderForm039()}
      </div>

      {/* Модалка настроек печати */}
      {showPrintSettings && (
        <div className="modal-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setShowPrintSettings(false);
        }}>
          <div className="modal">
            <h2>⚙️ Настройки печати</h2>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '16px' }}>
              Эти данные будут отображаться в шапке формы при печати. Сохраняются в браузере.
            </p>
            
            <label>Наименование организации здравоохранения</label>
            <input
              type="text"
              placeholder='Например: УЗ "Городская стоматологическая поликлиника"'
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
            
            <label>Наименование структурного подразделения</label>
            <input
              type="text"
              placeholder="Например: Терапевтическое отделение"
              value={structUnit}
              onChange={(e) => setStructUnit(e.target.value)}
            />
            
            <label>Ставка врача</label>
            <input
              type="text"
              placeholder="Например: 1.0"
              value={doctorRate}
              onChange={(e) => setDoctorRate(e.target.value)}
            />

            <label>Норма рабочего времени в месяц (часы)</label>
            <input
              type="text"
              placeholder="Например: 168"
              value={workTimeNorm}
              onChange={(e) => setWorkTimeNorm(e.target.value)}
            />
            
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowPrintSettings(false)}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={savePrintSettings}>
                💾 Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка формы администратора — заполнение данных для форм 037/039 */}
      {showAdminFormModal && (
        <div className="modal-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setShowAdminFormModal(false);
        }}>
          <div className="modal modal-wide admin-form-modal">
            <h2>📝 Заполнить данные для форм 037/039</h2>
            <p className="admin-form-hint">
              Заполните данные приёма от имени врача. Запись автоматически попадёт в формы 037/у и 039/у.
            </p>

            <form onSubmit={handleAdminFormSubmit}>
              {/* Блок 1: Пациент, Дата, Врач */}
              <div className="admin-form-section">
                <h4 className="admin-form-section-title">Основная информация</h4>

                <div className="form-row">
                  <div className="form-col form-col-wide" ref={clientDropdownRef}>
                    <label>Пациент *</label>
                    <div className="client-search-container">
                      <input
                        type="text"
                        placeholder="Начните вводить ФИО или телефон пациента..."
                        value={clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setShowClientDropdown(true);
                          if (selectedClient) setSelectedClient(null);
                        }}
                        onFocus={() => clientSearch && setShowClientDropdown(true)}
                        className={selectedClient ? 'client-search-selected' : ''}
                      />
                      {selectedClient && (
                        <button
                          type="button"
                          className="client-clear-btn"
                          onClick={handleClearClient}
                          title="Сбросить выбор"
                        >×</button>
                      )}
                      {showClientDropdown && filteredClients.length > 0 && !selectedClient && (
                        <div className="client-dropdown">
                          {filteredClients.slice(0, 15).map(client => (
                            <div
                              key={client.id}
                              className="client-dropdown-item"
                              onClick={() => handleSelectClient(client)}
                            >
                              <div className="client-dropdown-name">
                                {client.lastName} {client.firstName} {client.middleName || ''}
                              </div>
                              <div className="client-dropdown-info">
                                {client.phone && <span>{client.phone}</span>}
                                {client.date_of_birth && (
                                  <span>Возраст: {calculateAge(client.date_of_birth)} лет</span>
                                )}
                              </div>
                            </div>
                          ))}
                          {filteredClients.length > 15 && (
                            <div className="client-dropdown-more">
                              ...ещё {filteredClients.length - 15} пациентов. Уточните запрос.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Карточка выбранного пациента */}
                    {selectedClient && (
                      <div className="selected-client-card">
                        <div className="selected-client-row">
                          <span><strong>ФИО:</strong> {selectedClient.lastName} {selectedClient.firstName} {selectedClient.middleName || ''}</span>
                          {selectedClient.date_of_birth && (
                            <span><strong>Возраст:</strong> {calculateAge(selectedClient.date_of_birth)} лет</span>
                          )}
                        </div>
                        <div className="selected-client-row">
                          {selectedClient.address && <span><strong>Адрес:</strong> {selectedClient.address}</span>}
                          {selectedClient.phone && <span><strong>Тел:</strong> {selectedClient.phone}</span>}
                        </div>
                        {selectedClient.citizenship_data && (
                          <div className="selected-client-row">
                            <span><strong>Гражданство:</strong> {selectedClient.citizenship_data}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-col">
                    <label>Врач *</label>
                    <select
                      value={adminForm.doctor_id}
                      onChange={(e) => setAdminForm({ ...adminForm, doctor_id: e.target.value })}
                      required
                    >
                      <option value="">Выберите врача</option>
                      {doctors.map(doctor => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.lastName} {doctor.firstName} {doctor.middleName || ''} — {doctor.specialization || ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-col">
                    <label>Дата приёма *</label>
                    <input
                      type="date"
                      value={adminForm.record_date}
                      onChange={(e) => setAdminForm({ ...adminForm, record_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-col">
                    <label>Время приёма</label>
                    <input
                      type="time"
                      value={adminForm.record_time}
                      onChange={(e) => setAdminForm({ ...adminForm, record_time: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Блок 2: Данные для форм 037/039 — как у врача */}
              <div className="admin-form-section">
                <h4 className="admin-form-section-title">Данные для формы 037/у</h4>

                <div className="form-row">
                  <div className="form-col">
                    <label>Вид посещения</label>
                    <select
                      value={adminForm.visit_type}
                      onChange={(e) => setAdminForm({ ...adminForm, visit_type: e.target.value })}
                    >
                      <option value="">— Не указано —</option>
                      {VISIT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-col">
                    <label>Лечебно-проф. работа (коды 3-8)</label>
                    <select
                      value={adminForm.preventive_work}
                      onChange={(e) => setAdminForm({ ...adminForm, preventive_work: e.target.value })}
                    >
                      <option value="">— Не указано —</option>
                      {PREVENTIVE_CODES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-col">
                    <label>Код диагноза (графа 9, форма 039)</label>
                    <MultiCodeSelect
                      codes={DIAGNOSIS_CODES_039}
                      value={adminForm.diagnosis_code}
                      onChange={(val) => setAdminForm({ ...adminForm, diagnosis_code: val })}
                      placeholder="— Выберите коды диагноза —"
                    />
                  </div>
                  <div className="form-col">
                    <label>Этап лечения (графа 10)</label>
                    <select
                      value={adminForm.treatment_stage}
                      onChange={(e) => setAdminForm({ ...adminForm, treatment_stage: e.target.value })}
                    >
                      <option value="">— Не указано —</option>
                      {TREATMENT_STAGES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-col">
                    <label>Код лечения (графа 11, форма 039)</label>
                    <MultiCodeSelect
                      codes={TREATMENT_CODES_039}
                      value={adminForm.treatment_code}
                      onChange={(val) => setAdminForm({ ...adminForm, treatment_code: val })}
                      placeholder="— Выберите коды лечения —"
                    />
                  </div>
                  <div className="form-col">
                    <label>Описание диагноза</label>
                    <textarea
                      placeholder="Описание диагноза"
                      value={adminForm.diagnosis_description}
                      onChange={(e) => setAdminForm({ ...adminForm, diagnosis_description: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-col form-col-wide">
                    <label>Описание лечения</label>
                    <textarea
                      placeholder="Что было сделано (пломба, удаление, эндодонтия и т.д.)"
                      value={adminForm.treatment_description}
                      onChange={(e) => setAdminForm({ ...adminForm, treatment_description: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setShowAdminFormModal(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary" disabled={adminFormSubmitting}>
                  {adminFormSubmitting ? '⏳ Сохранение...' : '✅ Сохранить данные'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка создания/редактирования записи 037/у */}
      {showRecordModal && (
        <div className="modal-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setShowRecordModal(false);
            setEditingRecord(null);
          }
        }}>
          <div className="modal modal-wide">
            <h2>{editingRecord ? '✏️ Редактировать запись' : '➕ Новая запись (форма 037/у)'}</h2>
            <form onSubmit={handleSaveRecord}>
              <div className="form-row">
                <div className="form-col">
                  <label>Врач *</label>
                  <select
                    value={recordForm.doctor_id}
                    onChange={(e) => setRecordForm({ ...recordForm, doctor_id: e.target.value })}
                    required
                  >
                    <option value="">Выберите врача</option>
                    {doctors.map(doctor => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.lastName} {doctor.firstName} {doctor.middleName || ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-col">
                  <label>Дата приёма *</label>
                  <input
                    type="date"
                    value={recordForm.record_date}
                    onChange={(e) => setRecordForm({ ...recordForm, record_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-col">
                  <label>Время приёма</label>
                  <input
                    type="time"
                    value={recordForm.record_time}
                    onChange={(e) => setRecordForm({ ...recordForm, record_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col form-col-wide">
                  <label>ФИО пациента *</label>
                  <input
                    type="text"
                    placeholder="Фамилия Имя Отчество"
                    value={recordForm.patient_name}
                    onChange={(e) => setRecordForm({ ...recordForm, patient_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-col">
                  <label>Полных лет</label>
                  <input
                    type="number"
                    min="0"
                    max="150"
                    placeholder="Возраст"
                    value={recordForm.patient_age}
                    onChange={(e) => setRecordForm({ ...recordForm, patient_age: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col form-col-wide">
                  <label>Адрес места жительства (для граждан РБ)</label>
                  <input
                    type="text"
                    placeholder="Адрес регистрации"
                    value={recordForm.patient_address}
                    onChange={(e) => setRecordForm({ ...recordForm, patient_address: e.target.value })}
                  />
                </div>
                <div className="form-col">
                  <label>Данные о гражданстве (для иностранцев)</label>
                  <input
                    type="text"
                    placeholder="Гражданство"
                    value={recordForm.citizenship_data}
                    onChange={(e) => setRecordForm({ ...recordForm, citizenship_data: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label>Вид посещения</label>
                  <select
                    value={recordForm.visit_type}
                    onChange={(e) => setRecordForm({ ...recordForm, visit_type: e.target.value })}
                  >
                    <option value="">— Выберите —</option>
                    {VISIT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-col">
                  <label>Лечебно-профилактическая работа (коды 3-8)</label>
                  <select
                    value={recordForm.preventive_work}
                    onChange={(e) => setRecordForm({ ...recordForm, preventive_work: e.target.value })}
                  >
                    <option value="">— Выберите —</option>
                    {PREVENTIVE_CODES.map(code => (
                      <option key={code.value} value={code.value}>{code.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label>Код диагноза (графа 9, форма 039)</label>
                  <MultiCodeSelect
                    codes={DIAGNOSIS_CODES_039}
                    value={recordForm.diagnosis_code}
                    onChange={(val) => setRecordForm({ ...recordForm, diagnosis_code: val })}
                    placeholder="— Выберите коды диагноза —"
                  />
                </div>
                <div className="form-col">
                  <label>Описание диагноза</label>
                  <textarea
                    placeholder="Описание диагноза"
                    value={recordForm.diagnosis_description}
                    onChange={(e) => setRecordForm({ ...recordForm, diagnosis_description: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label>Этап лечения (графа 10)</label>
                  <select
                    value={recordForm.treatment_stage}
                    onChange={(e) => setRecordForm({ ...recordForm, treatment_stage: e.target.value })}
                  >
                    <option value="">— Не указано —</option>
                    {TREATMENT_STAGES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-col">
                  <label>Код лечения (графа 11, форма 039)</label>
                  <MultiCodeSelect
                    codes={TREATMENT_CODES_039}
                    value={recordForm.treatment_code}
                    onChange={(val) => setRecordForm({ ...recordForm, treatment_code: val })}
                    placeholder="— Выберите коды лечения —"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col form-col-wide">
                  <label>Описание лечения</label>
                  <textarea
                    placeholder="Вид лечения, описание"
                    value={recordForm.treatment_description}
                    onChange={(e) => setRecordForm({ ...recordForm, treatment_description: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => {
                  setShowRecordModal(false);
                  setEditingRecord(null);
                }}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRecord ? '💾 Сохранить' : '✅ Создать запись'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsFormsPage;
