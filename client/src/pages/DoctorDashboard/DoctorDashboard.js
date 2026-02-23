import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
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

const TREATMENT_STAGES = [
  { value: 'Л1', label: 'Л1 — Первый этап лечения' },
  { value: 'Л2', label: 'Л2 — Второй этап лечения' },
  { value: 'Л3', label: 'Л3 — Третий этап лечения' },
];

// Коды лечения формы 039/у (графа 11) — полный список из приложения 2 (Постановление МЗ РБ №203 от 16.12.2025)
// Коды лечения формы 039/у — ПОЛНЫЙ список из приложения 2 (Постановление МЗ РБ №203 от 16.12.2025), стр. 4-9
const TREATMENT_CODES_039 = [
  // Консультации
  { code: '200', label: 'Проведено консультаций (с выдачей заключения)' },
  // Профилактические мероприятия
  { code: '210', label: 'Беседа, мотивация, обучение гигиене' },
  { code: '220', label: 'Контроль гигиены' },
  { code: '230', label: 'Применение фторпрепаратов местно' },
  { code: '231', label: 'Профилактические мероприятия, связанные с лечением начального кариеса' },
  { code: '240', label: 'Проведено герметизаций фиссур (всего)' },
  { code: '241', label: 'Герметизация фиссур инвазивным методом' },
  // Терапевтическое лечение
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
  // Амбулаторно-хирургическое лечение
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
  // Ортодонтическое лечение
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
  // Ортопедическое лечение
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
  { code: '631', label: 'Коронка в мостовидном — штампованная' },
  { code: '632', label: 'Коронка в мостовидном — пластмассовая' },
  { code: '633', label: 'Коронка в мостовидном — литая' },
  { code: '634', label: 'Коронка в мостовидном — металлокерамическая' },
  { code: '635', label: 'Коронка в мостовидном — прессованная' },
  { code: '636', label: 'Коронка в мостовидном — CAD/CAM' },
  { code: '637', label: 'Коронка в мостовидном — иная' },
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
  // Обезболивание
  { code: '700', label: 'Обезболивание общее' },
  { code: '710', label: 'Обезболивание местное' },
];

// Компонент мультиселекта кодов с количеством — модальное окно с поиском, чекбоксами и полем кол-ва
const MultiCodeSelect = ({ codes, value, onChange, placeholder, disabled }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = value
    ? value.split(',').map(s => s.trim()).filter(Boolean).map(entry => {
        const [code, qtyStr] = entry.split(':');
        return { code, qty: parseInt(qtyStr) || 1 };
      })
    : [];
  const selectedCodes = selected.map(s => s.code);

  const serialize = (items) => items.map(i => `${i.code}:${i.qty}`).join(',');

  const toggle = (code) => {
    if (disabled) return;
    if (selectedCodes.includes(code)) {
      onChange(serialize(selected.filter(s => s.code !== code)));
    } else {
      onChange(serialize([...selected, { code, qty: 1 }]));
    }
  };

  const remove = (code) => {
    if (disabled) return;
    onChange(serialize(selected.filter(s => s.code !== code)));
  };

  const updateQty = (code, qty) => {
    if (disabled) return;
    const v = parseInt(qty) || 1;
    if (v < 1) return;
    onChange(serialize(selected.map(s => s.code === code ? { ...s, qty: v } : s)));
  };

  const filtered = codes.filter(c =>
    !search || c.code.includes(search) || c.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="multi-code-trigger" onClick={() => !disabled && setOpen(true)}>
        {selected.length === 0 ? (
          <span className="multi-code-placeholder">{placeholder || '— Выберите —'}</span>
        ) : (
          <div className="multi-code-tags">
            {selected.map(s => {
              const item = codes.find(c => c.code === s.code);
              return (
                <span key={s.code} className="multi-code-tag">
                  {s.code}{s.qty > 1 ? ` ×${s.qty}` : ''}{item ? ` — ${item.label.substring(0, 25)}${item.label.length > 25 ? '…' : ''}` : ''}
                  <span className="multi-code-tag-x" onClick={(e) => { e.stopPropagation(); remove(s.code); }}>×</span>
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
              <input className="mcs-search" type="text" placeholder="Поиск по коду или названию..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
            </div>
            {selected.length > 0 && (
              <div className="mcs-selected-bar">
                {selected.map(s => {
                  const item = codes.find(c => c.code === s.code);
                  return (
                    <span key={s.code} className="multi-code-tag">
                      {s.code}{s.qty > 1 ? ` ×${s.qty}` : ''}{item ? ` — ${item.label.substring(0, 20)}${item.label.length > 20 ? '…' : ''}` : ''}
                      <span className="multi-code-tag-x" onClick={() => remove(s.code)}>×</span>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="mcs-list">
              {filtered.length === 0 ? (
                <div className="mcs-empty">Ничего не найдено</div>
              ) : filtered.map(c => {
                const isSelected = selectedCodes.includes(c.code);
                const selectedItem = selected.find(s => s.code === c.code);
                return (
                  <label key={c.code} className={`mcs-item ${isSelected ? 'mcs-item-selected' : ''}`}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(c.code)} />
                    <span className="mcs-item-code">{c.code}</span>
                    <span className="mcs-item-label">{c.label}</span>
                    {isSelected && (
                      <input
                        type="number"
                        min="1"
                        className="mcs-qty-input"
                        value={selectedItem?.qty || 1}
                        onChange={(e) => { e.stopPropagation(); updateQty(c.code, e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.target.select()}
                        title="Количество"
                      />
                    )}
                  </label>
                );
              })}
            </div>
            <div className="mcs-footer">
              <button className="btn btn-primary" onClick={() => setOpen(false)}>Готово ({selected.length})</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const DoctorDashboard = ({ currentUser, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('schedule');
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

  // Состояние для вкладки «Отложенные»
  const [deferredList, setDeferredList] = useState([]);
  const [deferredLoading, setDeferredLoading] = useState(false);
  const [deferredInitialized, setDeferredInitialized] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    visit_type: '', preventive_work: '', diagnosis_code: '',
    treatment_stage: '', treatment_code: '', treatment_description: '',
  });
  const [submittingForm, setSubmittingForm] = useState(false);
  const [deferredCount, setDeferredCount] = useState(0);
  const deferredLoadingRef = useRef(false);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    if (currentUser?.doctor_id) {
      loadDoctorData();
      loadDeferred();
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

  // Единая загрузка отложенных (и для бейджа, и для списка). Защита от параллельных вызовов.
  const loadDeferred = useCallback(async () => {
    if (!currentUser?.doctor_id) return;
    if (deferredLoadingRef.current) return;
    deferredLoadingRef.current = true;
    setDeferredLoading(true);
    try {
      const res = await axios.get(`${API_URL}/appointments/deferred-forms`, {
        params: { doctor_id: currentUser.doctor_id }
      });
      setDeferredList(res.data);
      setDeferredCount(res.data.length);
      setDeferredInitialized(true);
    } catch (err) {
      console.error('Ошибка загрузки отложенных форм:', err);
    } finally {
      setDeferredLoading(false);
      deferredLoadingRef.current = false;
    }
  }, [currentUser?.doctor_id]);

  // Подгружаем при переключении на вкладку
  useEffect(() => {
    if (activeTab === 'deferred') {
      loadDeferred();
    }
  }, [activeTab, loadDeferred]);

  // Слушаем real-time обновления
  useEffect(() => {
    const handler = () => loadDeferred();
    window.addEventListener('appointmentUpdated', handler);
    return () => window.removeEventListener('appointmentUpdated', handler);
  }, [loadDeferred]);

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
      const result = await axios.patch(`${API_URL}/appointments/${editingId}/fill-deferred-form`, formData);
      
      // Если сервер вернул предупреждение о форме 037/у — показываем врачу
      if (result.data?.formWarning) {
        console.warn('⚠️ Предупреждение формы 037/у:', result.data.formWarning);
        alert(`Данные сохранены, но запись для формы 037/у не создана: ${result.data.formWarning}`);
      }
      
      setEditingId(null);
      setFormData({
        visit_type: '', preventive_work: '', diagnosis_code: '',
        treatment_stage: '', treatment_code: '', treatment_description: '',
      });
      // Обновляем список — заполненная запись пропадёт
      await loadDeferred();
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

            {(deferredLoading || !deferredInitialized) ? (
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
                              <MultiCodeSelect
                                codes={DIAGNOSIS_CODES_039}
                                value={formData.diagnosis_code}
                                onChange={(val) => handleFormChange('diagnosis_code', val)}
                                placeholder="— Выберите коды —"
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
                              <MultiCodeSelect
                                codes={TREATMENT_CODES_039}
                                value={formData.treatment_code}
                                onChange={(val) => handleFormChange('treatment_code', val)}
                                placeholder="— Выберите коды —"
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

