import { format } from 'date-fns';
import ru from 'date-fns/locale/ru';

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

/** Разбор календарной даты (DATE из БД / input type=date) без UTC-сдвига на день */
export const parseClientDateOnly = (value) => {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      year: value.getFullYear(),
      month: value.getMonth(),
      day: value.getDate(),
    };
  }

  const normalized = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [y, m, d] = normalized.split('-').map((part) => parseInt(part, 10));
    return { year: y, month: m - 1, day: d };
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth(),
      day: parsed.getDate(),
    };
  }

  return null;
};

/** YYYY-MM-DD для input type="date" */
export const formatClientDateInput = (value) => {
  const parts = parseClientDateOnly(value);
  if (!parts) return '';
  return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

/** «29 июля 1992 г.» — для печатных форм */
export const formatClientDateRuGenitive = (value) => {
  const parts = parseClientDateOnly(value);
  if (!parts) return '';
  return `${parts.day} ${MONTHS_GENITIVE[parts.month]} ${parts.year} г.`;
};

export const formatDateRu = (value) => {
  const parts = parseClientDateOnly(value);
  if (!parts) return '';
  return `${String(parts.day).padStart(2, '0')}.${String(parts.month + 1).padStart(2, '0')}.${parts.year}`;
};

/** «4» июля 2026 г. — дата в шапке договора */
export const formatContractHeaderDate = () => {
  const today = new Date();
  return `«${today.getDate()}» ${MONTHS_GENITIVE[today.getMonth()]} ${today.getFullYear()} г.`;
};

/** О. С. Бируля — подпись пациента инициалами */
export const formatClientInitialsSignature = (lastName, firstName, middleName) => {
  const initials = [firstName, middleName]
    .filter(Boolean)
    .map((name) => `${String(name).trim().charAt(0).toUpperCase()}.`)
    .join(' ');
  return [initials, lastName].filter(Boolean).join(' ').trim();
};

export const formatDate = (date, formatStr = 'd MMMM yyyy HH:mm') => {
  return format(new Date(date), formatStr, { locale: ru });
};

export const formatTime = (date) => {
  if (!date) return '--:--';
  
  // Преобразуем в строку
  let dateStr = String(date).trim();
  
  // Если это формат типа "Wed Dec 10 2025 17:" (результат toString() от Date)
  // Пытаемся извлечь время из этой строки
  if (dateStr.match(/^[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\s+(\d{1,2}):(\d{0,2})/)) {
    const timeMatch = dateStr.match(/\s+(\d{1,2}):(\d{0,2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10) || 0;
      const minutes = parseInt(timeMatch[2] || '0', 10) || 0;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }
  
  // Если это строка в формате 'YYYY-MM-DD HH:MM:SS' или 'YYYY-MM-DD HH:MM',
  // парсим время напрямую без конвертации timezone
  // Нормализуем формат: убираем 'T', заменяем на пробел, убираем timezone
  let normalized = dateStr.replace('T', ' ').trim();
  if (normalized.includes('Z')) {
    normalized = normalized.replace('Z', '');
  }
  if (normalized.includes('+')) {
    normalized = normalized.split('+')[0].trim();
  }
  // Убираем timezone в формате -HH:MM
  if (normalized.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}-\d{2}:\d{2}$/)) {
    normalized = normalized.substring(0, 19);
  }
  
  // Проверяем формат 'YYYY-MM-DD HH:MM:SS' или 'YYYY-MM-DD HH:MM'
  const dateTimeMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (dateTimeMatch) {
    const [, , hours, minutes] = dateTimeMatch;
    // ВАЖНО: убеждаемся, что minutes не undefined и не пустая строка
    const hoursNum = parseInt(hours, 10) || 0;
    const minutesNum = parseInt(minutes || '0', 10) || 0;
    
    // Возвращаем время в формате HH:MM, сохраняя минуты как есть
    return `${String(hoursNum).padStart(2, '0')}:${String(minutesNum).padStart(2, '0')}`;
  }
  
  // Для других форматов используем стандартный парсинг
  // ВАЖНО: new Date() может конвертировать timezone, поэтому стараемся избегать этого
  try {
    const dateObj = new Date(date);
    if (!isNaN(dateObj.getTime())) {
      return format(dateObj, 'HH:mm');
    }
  } catch (e) {
    console.error('Ошибка форматирования времени:', e, date);
  }
  return '--:--';
};

export const getTodayDateString = () => {
  return new Date().toISOString().split('T')[0];
};

export const getFullName = (lastName, firstName, middleName) => {
  return `${lastName || ''} ${firstName || ''} ${middleName || ''}`.trim();
};

export const getStatusColor = (status) => {
  switch(status) {
    case 'scheduled': return '#667eea';
    case 'waiting': return '#ffa751';
    case 'in-progress': return '#4ecdc4';
    case 'ready_for_payment': return '#ff9800';
    case 'completed': return '#95e1d3';
    case 'cancelled': return '#ff4757';
    default: return '#999';
  }
};

export const getStatusText = (status) => {
  switch(status) {
    case 'scheduled': return 'Запланирован';
    case 'waiting': return 'Ожидает';
    case 'in-progress': return 'На приеме';
    case 'ready_for_payment': return 'Готов к оплате';
    case 'completed': return 'Завершен';
    case 'cancelled': return 'Отменен';
    default: return 'Неизвестно';
  }
};

