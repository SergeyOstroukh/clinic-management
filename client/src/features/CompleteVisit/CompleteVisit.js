import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ServiceMaterialSelector from '../../components/ServiceMaterialSelector/ServiceMaterialSelector';
import './CompleteVisit.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

// Виды посещений для формы 037/у (графа 7) — коды из инструкции
// Код формируется: X.Y где X = 1(первичное)/2(повторное), Y определяется population_type клиента
// На бэкенде population_type клиента подставляется автоматически
const VISIT_TYPES = [
  { value: 'primary', label: 'Первичное' },
  { value: 'repeat', label: 'Повторное' },
  { value: 'preventive', label: 'Профилактическое' },
  { value: 'consultation', label: 'Консультация' },
  { value: 'emergency', label: 'Неотложное' },
];

// Коды лечебно-профилактической работы (коды 3-8 из формы 039/у, графа 8)
const PREVENTIVE_CODES = [
  { value: '3', label: '3 — Профосмотр (самостоятельно)' },
  { value: '4', label: '4 — Здоровые, ранее санированные' },
  { value: '5', label: '5 — Санированы по обращению' },
  { value: '6', label: '6 — Осмотрены в плановом порядке' },
  { value: '7', label: '7 — Здоровые, ранее санированные (плановые)' },
  { value: '8', label: '8 — Санированы в плановом порядке' },
];

// Коды диагнозов формы 039/у (графа 9) — полный список из приложения 2
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

// Этапы лечения (графа 10) — Л1, Л2, Л3
const TREATMENT_STAGES = [
  { value: 'Л1', label: 'Л1 — Первый этап лечения' },
  { value: 'Л2', label: 'Л2 — Второй этап лечения' },
  { value: 'Л3', label: 'Л3 — Третий этап лечения' },
];

// Коды лечения формы 039/у (графа 11) — основные числовые коды из приложения 2
const TREATMENT_CODES_039 = [
  // Профилактические мероприятия
  { code: '210', label: 'Беседа, мотивация, обучение гигиене' },
  { code: '220', label: 'Контроль гигиены' },
  { code: '230', label: 'Применение фторпрепаратов местно' },
  { code: '231', label: 'Лечение начального кариеса (профилактическое)' },
  { code: '240', label: 'Герметизация фиссур' },
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
  { code: '360', label: 'Законченное эндодонтическое лечение постоянных зубов' },
  { code: '361', label: 'Эндодонтическое лечение по ортопедическим показаниям' },
  { code: '362', label: 'Повторное эндодонтическое лечение' },
  { code: '370', label: 'Законченное эндодонтическое лечение временных зубов' },
  { code: '375', label: 'Закончено терапевтическое лечение (лицо)' },
  { code: '380', label: 'Закончено пародонтологическое лечение (лицо)' },
  { code: '390', label: 'Закончено лечение заболеваний слизистой рта (лицо)' },
  { code: '395', label: 'Отбеливание зубов' },
  // Амбулаторно-хирургическое лечение
  { code: '400', label: 'Удалено постоянных зубов' },
  { code: '402', label: 'Удаление по ортодонтическим показаниям' },
  { code: '404', label: 'Удалено дентальных имплантатов' },
  { code: '410', label: 'Удалено временных зубов' },
  { code: '411', label: 'Удаление временных зубов по физиологической смене' },
  { code: '420', label: 'Амбулаторно-хирургическая операция' },
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
  { code: '450', label: 'Местное лечение открытых ран (перевязки, снятие шин)' },
  { code: '460', label: 'Закончено хирургическое лечение (лицо)' },
  // Ортодонтическое лечение
  { code: '500', label: 'Взято на ортодонтическое лечение (лицо)' },
  { code: '510', label: 'Изготовлено ортодонтических аппаратов' },
  { code: '511', label: 'Механический съемный аппарат' },
  { code: '512', label: 'Механический несъемный аппарат' },
  { code: '513', label: 'Функциональный аппарат' },
  { code: '514', label: 'Функционально-направляющий аппарат' },
  { code: '515', label: 'Сочетанный аппарат' },
  { code: '520', label: 'Закончено ортодонтическое лечение (лицо)' },
  // Ортопедическое лечение
  { code: '600', label: 'Посещение на льготном зубопротезировании' },
  { code: '601', label: 'Починка протеза' },
  { code: '602', label: 'Виниры' },
  { code: '603', label: 'Штифтовые, штифтово-культевые вкладки' },
  { code: '604', label: 'Вкладки' },
  { code: '610', label: 'Одиночная коронка' },
  { code: '620', label: 'Мостовидный протез' },
  { code: '640', label: 'Провизорная коронка прямым методом' },
  { code: '650', label: 'Съемный протез' },
  { code: '655', label: 'Каппа' },
  { code: '660', label: 'Закончено ортопедическое лечение (лицо)' },
  // Обезболивание
  { code: '700', label: 'Обезболивание общее' },
  { code: '710', label: 'Обезболивание местное' },
];

const CompleteVisit = ({ visit, services, materials, onSuccess, onCancel, toast }) => {
  // Проверяем, оплачен ли прием
  const isPaid = visit.status === 'completed' || visit.paid === true || visit.paid === 1 || visit.paid === 'true';
  
  const [diagnosis, setDiagnosis] = useState(visit.diagnosis || '');
  const [selectedServices, setSelectedServices] = useState(visit.services || []);
  const [selectedMaterials, setSelectedMaterials] = useState(visit.materials || []);
  /** Составные услуги: при применении добавляются сюда, а не разворачиваются в services/materials */
  const [selectedComposites, setSelectedComposites] = useState([]);
  /** Какие составные услуги развёрнуты (аккордеон подуслуг) */
  const [expandedCompositeIds, setExpandedCompositeIds] = useState([]);
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [compositeServices, setCompositeServices] = useState([]);
  const [compositeServiceSearch, setCompositeServiceSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState('services'); // 'services', 'materials' или 'composite'

  // Поля формы 037/у
  const [visitType, setVisitType] = useState(visit.visit_type || '');
  const [diagnosisCode, setDiagnosisCode] = useState(visit.diagnosis_code || '');
  const [treatmentCode, setTreatmentCode] = useState(visit.treatment_code || '');
  const [treatmentDesc, setTreatmentDesc] = useState(visit.treatment_description || '');
  const [preventiveWork, setPreventiveWork] = useState(visit.preventive_work || '');
  const [treatmentStage, setTreatmentStage] = useState(visit.treatment_stage || '');
  const [showFormFields, setShowFormFields] = useState(false);

  // Загружаем составные услуги
  useEffect(() => {
    const loadCompositeServices = async () => {
      try {
        const response = await axios.get(`${API_URL}/composite-services`);
        // Фильтруем только активные
        setCompositeServices(response.data.filter(cs => cs.is_active !== false));
      } catch (error) {
        console.error('Ошибка загрузки составных услуг:', error);
      }
    };
    loadCompositeServices();
  }, []);

  // Загружаем план лечения клиента
  useEffect(() => {
    const loadTreatmentPlan = async () => {
      if (visit.client_id || visit.client?.id) {
        const clientId = visit.client_id || visit.client?.id;
        try {
          const response = await axios.get(`${API_URL}/clients/${clientId}`);
          // Всегда обновляем план лечения, даже если он пустой
          setTreatmentPlan(response.data.treatment_plan || '');
        } catch (error) {
          console.error('Ошибка загрузки плана лечения:', error);
        }
      }
    };
    loadTreatmentPlan();
  }, [visit.client_id, visit.client?.id, visit.id]); // Перезагружаем при изменении записи

  // Обновляем данные при изменении visit (восстанавливаем составные услуги как до завершения)
  useEffect(() => {
    setDiagnosis(visit.diagnosis || '');
    const rawComposites = visit.applied_composites;
    const composites = Array.isArray(rawComposites)
      ? rawComposites
          .filter(c => c && typeof c === 'object' && c.composite_service_id != null)
          .map(c => ({ composite_service_id: c.composite_service_id, quantity: c.quantity || 1 }))
      : [];
    setSelectedComposites(composites);
    setSelectedServices(visit.services || []);
    setSelectedMaterials(visit.materials || []);
    setExpandedCompositeIds([]);
    // Поля формы 037/у
    setVisitType(visit.visit_type || '');
    setDiagnosisCode(visit.diagnosis_code || '');
    setTreatmentCode(visit.treatment_code || '');
    setTreatmentDesc(visit.treatment_description || '');
    setPreventiveWork(visit.preventive_work || '');
    setTreatmentStage(visit.treatment_stage || '');
  }, [visit]);

  const toggleService = (serviceId) => {
    const existing = selectedServices.find(s => s.service_id === serviceId);
    if (existing) {
      setSelectedServices(selectedServices.filter(s => s.service_id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, { service_id: serviceId, quantity: 1 }]);
    }
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


  const removeMaterial = (materialId) => {
    setSelectedMaterials(selectedMaterials.filter(m => m.material_id !== materialId));
  };

  const updateMaterialQuantity = (materialId, quantity) => {
    setSelectedMaterials(selectedMaterials.map(m => 
      m.material_id === materialId ? { ...m, quantity: parseFloat(quantity) || 1 } : m
    ));
  };

  // Применить составную услугу — добавляем в selectedComposites, не разворачиваем в services/materials
  const handleApplyCompositeService = (compositeService) => {
    setSelectedComposites(prev => {
      const existing = prev.find(c => c.composite_service_id === compositeService.id);
      if (existing) {
        return prev.map(c =>
          c.composite_service_id === compositeService.id
            ? { ...c, quantity: (c.quantity || 1) + 1 }
            : c
        );
      }
      return [...prev, { composite_service_id: compositeService.id, quantity: 1 }];
    });
    setActiveSection('services');
    setCompositeServiceSearch('');
    if (toast) toast.info(`✅ Составная услуга «${compositeService.name}» добавлена`);
    else alert(`✅ Составная услуга «${compositeService.name}» добавлена`);
  };

  const removeComposite = (compositeServiceId) => {
    setSelectedComposites(prev => prev.filter(c => c.composite_service_id !== compositeServiceId));
    setExpandedCompositeIds(prev => prev.filter(id => id !== compositeServiceId));
  };

  const updateCompositeQuantity = (compositeServiceId, qty) => {
    const v = parseInt(qty, 10);
    if (isNaN(v) || v < 1) return;
    setSelectedComposites(prev =>
      prev.map(c =>
        c.composite_service_id === compositeServiceId ? { ...c, quantity: v } : c
      )
    );
  };

  const toggleCompositeExpanded = (id) => {
    setExpandedCompositeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Стоимость составной услуги (подуслуги + материалы) с учётом quantity
  const getCompositeTotal = (composite, qty = 1) => {
    let total = 0;
    (composite.services || []).forEach(cs => {
      const s = services.find(x => x.id === (cs.service_id || cs.id));
      total += (s?.price || cs.price || 0) * (cs.quantity || 1) * qty;
    });
    (composite.materials || []).forEach(cm => {
      const m = materials.find(x => x.id === (cm.material_id || cm.id));
      total += (m?.price || cm.price || 0) * (cm.quantity || 1) * qty;
    });
    return total.toFixed(2);
  };

  // Проверяем, заполнены ли данные формы 037/у (хотя бы одно поле)
  const isFormFilled = visitType || diagnosisCode || treatmentCode || treatmentDesc || preventiveWork || treatmentStage;

  const handleSubmit = async (deferForm = false) => {
    if (!diagnosis.trim()) {
      if (toast) toast.warning('Пожалуйста, введите диагноз');
      else alert('Пожалуйста, введите диагноз');
      return;
    }
    const hasServices = selectedServices.length > 0 || selectedComposites.length > 0;
    if (!hasServices) {
      if (toast) toast.warning('Пожалуйста, выберите хотя бы одну услугу');
      else alert('Пожалуйста, выберите хотя бы одну услугу');
      return;
    }

    // Если не заполнена форма 037/у и не нажата кнопка «заполнить позже» — блокируем
    if (!deferForm && !isFormFilled) {
      if (toast) toast.warning('Заполните данные для формы 037/у или нажмите «Форму заполнить позже»');
      else alert('Заполните данные для формы 037/у или нажмите «Форму заполнить позже»');
      // Автоматически раскрываем секцию формы
      setShowFormFields(true);
      return;
    }

    // Разворачиваем составные в услуги и материалы, объединяем с выбранными вручную
    const servicesByKey = {}; // { service_id: quantity }
    selectedServices.forEach(s => {
      const id = parseInt(s.service_id, 10);
      if (isNaN(id)) return;
      servicesByKey[id] = (servicesByKey[id] || 0) + (parseInt(s.quantity, 10) || 1);
    });
    selectedComposites.forEach(item => {
      const cs = compositeServices.find(c => c.id === item.composite_service_id);
      if (!cs) return;
      const qty = parseInt(item.quantity, 10) || 1;
      (cs.services || []).forEach(s => {
        const id = parseInt(s.service_id || s.id, 10);
        if (isNaN(id)) return;
        const add = (parseInt(s.quantity, 10) || 1) * qty;
        servicesByKey[id] = (servicesByKey[id] || 0) + add;
      });
    });

    const materialsByKey = {}; // { material_id: quantity }
    (selectedMaterials || []).forEach(m => {
      const id = parseInt(m.material_id, 10);
      if (isNaN(id)) return;
      materialsByKey[id] = (materialsByKey[id] || 0) + (parseFloat(m.quantity) || 1);
    });
    selectedComposites.forEach(item => {
      const cs = compositeServices.find(c => c.id === item.composite_service_id);
      if (!cs) return;
      const qty = parseInt(item.quantity, 10) || 1;
      (cs.materials || []).forEach(m => {
        const id = parseInt(m.material_id || m.id, 10);
        if (isNaN(id)) return;
        const add = (parseFloat(m.quantity) || 1) * qty;
        materialsByKey[id] = (materialsByKey[id] || 0) + add;
      });
    });

    const normalizedServices = Object.entries(servicesByKey).map(([id, q]) => ({
      service_id: parseInt(id, 10),
      quantity: q
    }));
    const normalizedMaterials = Object.entries(materialsByKey).map(([id, q]) => ({
      material_id: parseInt(id, 10),
      quantity: parseFloat(q)
    }));

    if (normalizedServices.length === 0) {
      if (toast) toast.error('Ошибка: нет валидных услуг для сохранения. Пожалуйста, выберите услуги заново.');
      else alert('Ошибка: нет валидных услуг для сохранения. Пожалуйста, выберите услуги заново.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Сохраняем прием
      await axios.patch(`${API_URL}/appointments/${visit.id}/complete-visit`, {
        diagnosis,
        services: normalizedServices,
        materials: normalizedMaterials,
        treatment_plan: treatmentPlan,
        applied_composites: selectedComposites,
        visit_type: visitType || null,
        diagnosis_code: diagnosisCode || null,
        treatment_code: treatmentCode || null,
        treatment_description: treatmentDesc || null,
        preventive_work: preventiveWork || null,
        treatment_stage: treatmentStage || null,
        form_deferred: deferForm,
      });
      
      // Отправляем событие для обновления списка записей
      window.dispatchEvent(new Event('appointmentUpdated'));
      // Отправляем событие для обновления данных клиента (включая план лечения)
      window.dispatchEvent(new Event('clientDataUpdated'));
      
      onSuccess();
    } catch (error) {
      console.error('Ошибка завершения приема:', error);
      console.error('Отправленные данные:', { 
        services: normalizedServices, 
        materials: normalizedMaterials 
      });
      if (toast) toast.error(`Ошибка завершения приема: ${error.response?.data?.error || error.message}`);
      else alert(`Ошибка завершения приема: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="complete-visit-form">
      <h3>👨‍⚕️ Завершение приема</h3>

      {isPaid && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: '#e8f5e9', 
          borderRadius: '8px',
          border: '2px solid #4caf50'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '2em', marginRight: '10px' }}>✅</span>
            <strong style={{ fontSize: '1.2em', color: '#2e7d32' }}>Прием оплачен</strong>
          </div>
          <p style={{ textAlign: 'center', color: '#666', margin: 0 }}>
            Прием успешно оплачен. Изменения недоступны.
          </p>
        </div>
      )}

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
          disabled={isPaid}
        />
      </div>

      {/* Поля формы 037/у — сворачиваемый блок */}
      <div className="form-section form-037-fields-section">
        <div
          className="form-037-toggle"
          onClick={() => setShowFormFields(!showFormFields)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowFormFields(!showFormFields)}
        >
          <span className="form-037-toggle-icon">{showFormFields ? '▼' : '▶'}</span>
          <label className="form-label" style={{ cursor: 'pointer', margin: 0 }}>
            📋 Данные для формы 037/у
          </label>
          <span className="form-037-toggle-hint">
            {showFormFields ? 'свернуть' : 'развернуть'}
          </span>
        </div>

        {showFormFields && (
          <div className="form-037-fields">
            <div className="form-037-row">
              <div className="form-037-col">
                <label className="form-label-sm">Вид посещения</label>
                <select
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value)}
                  className="form-037-select"
                  disabled={isPaid}
                >
                  <option value="">— Не указано —</option>
                  {VISIT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-037-col">
                <label className="form-label-sm">Лечебно-проф. работа (коды 3-8)</label>
                <select
                  value={preventiveWork}
                  onChange={(e) => setPreventiveWork(e.target.value)}
                  className="form-037-select"
                  disabled={isPaid}
                >
                  <option value="">— Не указано —</option>
                  {PREVENTIVE_CODES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-037-row">
              <div className="form-037-col">
                <label className="form-label-sm">Код диагноза (графа 9, форма 039)</label>
                <select
                  value={diagnosisCode}
                  onChange={(e) => setDiagnosisCode(e.target.value)}
                  className="form-037-select"
                  disabled={isPaid}
                >
                  <option value="">— Выберите —</option>
                  {DIAGNOSIS_CODES_039.map(d => (
                    <option key={d.code} value={d.code}>{d.code} — {d.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Или введите код вручную"
                  value={diagnosisCode}
                  onChange={(e) => setDiagnosisCode(e.target.value)}
                  className="form-037-input"
                  disabled={isPaid}
                  style={{ marginTop: '4px' }}
                />
              </div>
              <div className="form-037-col">
                <label className="form-label-sm">Этап лечения (графа 10)</label>
                <select
                  value={treatmentStage}
                  onChange={(e) => setTreatmentStage(e.target.value)}
                  className="form-037-select"
                  disabled={isPaid}
                >
                  <option value="">— Не указано —</option>
                  {TREATMENT_STAGES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-037-row">
              <div className="form-037-col">
                <label className="form-label-sm">Код лечения (графа 11, форма 039)</label>
                <select
                  value={treatmentCode}
                  onChange={(e) => setTreatmentCode(e.target.value)}
                  className="form-037-select"
                  disabled={isPaid}
                >
                  <option value="">— Выберите —</option>
                  {TREATMENT_CODES_039.map(c => (
                    <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Или введите код вручную"
                  value={treatmentCode}
                  onChange={(e) => setTreatmentCode(e.target.value)}
                  className="form-037-input"
                  disabled={isPaid}
                  style={{ marginTop: '4px' }}
                />
              </div>
              <div className="form-037-col" style={{ flex: 1 }}>
                <label className="form-label-sm">Описание лечения</label>
                <textarea
                  placeholder="Что было сделано (пломба, удаление, эндодонтия и т.д.)"
                  value={treatmentDesc}
                  onChange={(e) => setTreatmentDesc(e.target.value)}
                  className="form-037-textarea"
                  rows={2}
                  disabled={isPaid}
                />
              </div>
            </div>

            <div className="form-037-hint">
              💡 Эти данные автоматически попадут в формы 037/у и 039/у (Отчёты / Формы)
            </div>
          </div>
        )}
      </div>

      {/* План лечения */}
      <div className="form-section">
        <label className="form-label">📋 План лечения</label>
        <textarea
          className="diagnosis-input"
          value={treatmentPlan}
          onChange={(e) => setTreatmentPlan(e.target.value)}
          placeholder="Введите план лечения пациента (каждый пункт с новой строки)..."
          rows={8}
          disabled={isPaid}
        />
        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '8px' }}>
          💡 Каждый пункт плана лечения будет автоматически пронумерован
        </div>
      </div>

      {/* Услуги и материалы с вкладками */}
      <div className="form-section">
        <div className="services-materials-tabs">
          <button
            type="button"
            className={`section-tab ${activeSection === 'composite' ? 'active' : ''}`}
            onClick={() => setActiveSection('composite')}
          >
            🔧 Готовые услуги
          </button>
          <button
            type="button"
            className={`section-tab ${activeSection === 'services' ? 'active' : ''}`}
            onClick={() => setActiveSection('services')}
          >
            📋 Услуги
            {(selectedServices.length + selectedComposites.length) > 0 && (
              <span className="tab-badge">{selectedServices.length + selectedComposites.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`section-tab ${activeSection === 'materials' ? 'active' : ''}`}
            onClick={() => setActiveSection('materials')}
          >
            📦 Материалы
            {selectedMaterials.length > 0 && (
              <span className="tab-badge">{selectedMaterials.length}</span>
            )}
          </button>
        </div>

        {/* Контент составных услуг */}
        {activeSection === 'composite' && (
          <div className="section-content">
            <label className="form-label">Готовые составные услуги</label>
            <p className="form-hint">Выберите готовую услугу, чтобы автоматически добавить все подуслуги и материалы</p>
            
            <div className="search-box" style={{ marginBottom: '15px' }}>
              <input
                type="text"
                placeholder="🔍 Поиск готовой услуги..."
                value={compositeServiceSearch}
                onChange={(e) => setCompositeServiceSearch(e.target.value)}
                className="page-search-input"
              />
            </div>

            <div className="composite-services-selector">
              {compositeServices
                .filter(cs => {
                  const search = compositeServiceSearch.toLowerCase();
                  return cs.name.toLowerCase().includes(search) ||
                         (cs.category && cs.category.toLowerCase().includes(search));
                })
                .map(cs => (
                  <div 
                    key={cs.id} 
                    className="composite-service-option" 
                    onClick={() => !isPaid && handleApplyCompositeService(cs)}
                    style={isPaid ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                  >
                    <div className="composite-service-header">
                      <h4>{cs.name}</h4>
                      {cs.category && <span className="composite-service-category">{cs.category}</span>}
                    </div>
                    {cs.description && <p className="composite-service-description">{cs.description}</p>}
                    <div className="composite-service-details">
                      <span>📋 {cs.services?.length || 0} подуслуг</span>
                      {cs.materials && cs.materials.length > 0 && (
                        <span>📦 {cs.materials.length} материалов</span>
                      )}
                    </div>
                    <button type="button" className="btn btn-primary btn-small" style={{ marginTop: '10px' }}>
                      ➕ Применить
                    </button>
                  </div>
                ))}
              
              {compositeServices.filter(cs => {
                const search = compositeServiceSearch.toLowerCase();
                return cs.name.toLowerCase().includes(search) ||
                       (cs.category && cs.category.toLowerCase().includes(search));
              }).length === 0 && (
                <div className="empty-state">
                  <p>{compositeServiceSearch ? 'Готовые услуги не найдены' : 'Нет готовых составных услуг'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Контент услуг */}
        {activeSection === 'services' && (
          <div className="section-content">
            <label className="form-label">Проведенные услуги *</label>
            <ServiceMaterialSelector
              items={services}
              selectedItems={selectedServices}
              onToggleItem={toggleService}
              onUpdateQuantity={updateServiceQuantity}
              onRemoveItem={removeService}
              type="service"
              searchQuery={serviceSearch}
              onSearchChange={setServiceSearch}
            />
            
            {/* Список выбранных: составные (название + стоимость, по клику — аккордеон), потом точечные */}
            {(selectedComposites.length > 0 || selectedServices.length > 0) && (
              <div className="selected-items-simple">
                {/* Составные услуги: одна строка — название и сумма, по клику раскрываются подуслуги */}
                {selectedComposites.map(item => {
                  const cs = compositeServices.find(c => c.id === item.composite_service_id);
                  if (!cs) return null;
                  const total = getCompositeTotal(cs, item.quantity || 1);
                  const isExpanded = expandedCompositeIds.includes(cs.id);
                  const qty = item.quantity || 1;
                  return (
                    <div key={'composite-' + cs.id} className="selected-item-simple selected-item-composite">
                      <div
                        className="composite-row-main"
                        onClick={() => toggleCompositeExpanded(cs.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCompositeExpanded(cs.id)}
                      >
                        <span className="item-name-simple">
                          🔧 {cs.name}
                          <span className="composite-chevron">{isExpanded ? ' ▼' : ' ▶'}</span>
                        </span>
                        <div className="item-controls-simple" onClick={e => e.stopPropagation()}>
                          <label className="quantity-label-inline">
                            Кол-во:
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity || 1}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => updateCompositeQuantity(cs.id, e.target.value)}
                              className="quantity-input-simple"
                              disabled={isPaid}
                            />
                          </label>
                          <div className="item-total-simple">Итого: {total} BYN</div>
                          <button
                            type="button"
                            className="btn-remove-simple"
                            onClick={() => removeComposite(cs.id)}
                            title="Удалить"
                            disabled={isPaid}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="composite-accordion-body">
                          {(cs.services || []).length > 0 && (
                            <>
                              <div className="composite-sub-title">Подуслуги</div>
                              <ul className="composite-sub-list">
                                {(cs.services || []).map(s => {
                                  const svc = services.find(x => x.id === (s.service_id || s.id));
                                  const name = svc?.name || s.name || '—';
                                  const price = svc?.price ?? s.price ?? 0;
                                  const subQty = (s.quantity || 1) * qty;
                                  const subTotal = (price * subQty).toFixed(2);
                                  return (
                                    <li key={s.service_id || s.id}>
                                      {name} × {subQty} — {subTotal} BYN
                                    </li>
                                  );
                                })}
                              </ul>
                            </>
                          )}
                          {(cs.materials || []).length > 0 && (
                            <>
                              <div className="composite-sub-title">Материалы</div>
                              <ul className="composite-sub-list">
                                {(cs.materials || []).map(m => {
                                  const mat = materials.find(x => x.id === (m.material_id || m.id));
                                  const name = mat?.name || m.name || '—';
                                  const unit = mat?.unit || m.unit || 'шт';
                                  const price = mat?.price ?? m.price ?? 0;
                                  const subQty = (m.quantity || 1) * qty;
                                  const subTotal = (price * subQty).toFixed(2);
                                  return (
                                    <li key={m.material_id || m.id}>
                                      {name} × {subQty} {unit} — {subTotal} BYN
                                    </li>
                                  );
                                })}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Точечные услуги — как раньше */}
                {selectedServices.map(item => {
                  const service = services.find(s => s.id === item.service_id);
                  if (!service) return null;
                  const itemTotal = (service.price || 0) * (item.quantity || 1);
                  return (
                    <div key={item.service_id} className="selected-item-simple">
                      <span className="item-name-simple">{service.name}</span>
                      <div className="item-controls-simple">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateServiceQuantity(item.service_id, e.target.value)}
                          className="quantity-input-simple"
                        />
                        <div style={{ 
                          fontWeight: 'bold', 
                          color: '#667eea',
                          marginLeft: '10px',
                          minWidth: '100px',
                          textAlign: 'right'
                        }}>
                          <div style={{ fontSize: '0.85rem', marginBottom: '2px' }}>
                            Кол-во: {item.quantity || 1}
                          </div>
                          <div>
                            Итого: {itemTotal.toFixed(2)} BYN
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-simple"
                          onClick={() => removeService(item.service_id)}
                          title="Удалить"
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
        )}

        {/* Контент материалов */}
        {activeSection === 'materials' && (
          <div className="section-content">
            <label className="form-label">Использованные материалы</label>
            <ServiceMaterialSelector
              items={materials}
              selectedItems={selectedMaterials}
              onToggleItem={isPaid ? () => {} : toggleMaterial}
              onUpdateQuantity={isPaid ? () => {} : updateMaterialQuantity}
              onRemoveItem={isPaid ? () => {} : removeMaterial}
              type="material"
              searchQuery={materialSearch}
              onSearchChange={isPaid ? () => {} : setMaterialSearch}
              disabled={isPaid}
            />
            
            {/* Простой список выбранных материалов */}
            {selectedMaterials.length > 0 && (
              <div className="selected-items-simple">
                {selectedMaterials.map(item => {
                  const material = materials.find(m => m.id === item.material_id);
                  if (!material) return null;
                  const itemTotal = (material.price || 0) * (item.quantity || 1);
                  return (
                    <div key={item.material_id} className="selected-item-simple">
                      <span className="item-name-simple">
                        {material.name} <span className="unit-label-simple">({material.unit})</span>
                      </span>
                      <div className="item-controls-simple">
                        <input
                          type="number"
                          min="0.1"
                          step="1"
                          value={item.quantity}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateMaterialQuantity(item.material_id, e.target.value)}
                          className="quantity-input-simple"
                          disabled={isPaid}
                        />
                        <div style={{ 
                          fontWeight: 'bold', 
                          color: '#667eea',
                          marginLeft: '10px',
                          minWidth: '100px',
                          textAlign: 'right'
                        }}>
                          <div style={{ fontSize: '0.85rem', marginBottom: '2px' }}>
                            Кол-во: {item.quantity || 1}
                          </div>
                          <div>
                            Итого: {itemTotal.toFixed(2)} BYN
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-simple"
                          onClick={() => removeMaterial(item.material_id)}
                          title="Удалить"
                          disabled={isPaid}
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
        )}
      </div>

      {/* Общая сумма */}
      {((selectedServices.length > 0) || (selectedMaterials.length > 0) || (selectedComposites.length > 0)) && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '10px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.1rem', marginBottom: '5px' }}>💰 Общая сумма:</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
            {(() => {
              const servicesTotal = selectedServices.reduce((sum, item) => {
                const service = services.find(s => s.id === item.service_id);
                return sum + ((service?.price || 0) * (item.quantity || 1));
              }, 0);
              const materialsTotal = selectedMaterials.reduce((sum, item) => {
                const material = materials.find(m => m.id === item.material_id);
                return sum + ((material?.price || 0) * (item.quantity || 1));
              }, 0);
              const compositesTotal = selectedComposites.reduce((sum, item) => {
                const cs = compositeServices.find(c => c.id === item.composite_service_id);
                return sum + (cs ? parseFloat(getCompositeTotal(cs, item.quantity || 1)) : 0);
              }, 0);
              return (servicesTotal + materialsTotal + compositesTotal).toFixed(2);
            })()} BYN
          </div>
        </div>
      )}

      {/* Кнопки */}
      <div className="form-actions">
        <button className="btn btn-secondary" onClick={onCancel} disabled={isSubmitting || isPaid}>
          Отмена
        </button>
        {isPaid ? (
          <button className="btn btn-primary" disabled style={{ opacity: 0.6 }}>
            ✅ Прием оплачен
          </button>
        ) : (
          <>
            <button 
              className="btn btn-defer" 
              onClick={() => handleSubmit(true)} 
              disabled={isSubmitting}
              title="Завершить прием, а данные для формы 037/у заполнить позже"
            >
              {isSubmitting ? 'Сохранение...' : '⏳ Форму заполнить позже'}
            </button>
            <button className="btn btn-primary" onClick={() => handleSubmit(false)} disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение...' : '✅ Завершить прием'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CompleteVisit;

