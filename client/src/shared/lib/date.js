import { format } from 'date-fns';
import ru from 'date-fns/locale/ru';

export const formatDate = (date, formatStr = 'd MMMM yyyy') => {
  return format(new Date(date), formatStr, { locale: ru });
};

export const formatDateTime = (date) => {
  return format(new Date(date), 'd MMMM yyyy HH:mm', { locale: ru });
};

export const formatTime = (date) => {
  // Если это строка в формате 'YYYY-MM-DD HH:MM:SS' или 'YYYY-MM-DD HH:MM',
  // парсим время напрямую без конвертации timezone
  if (typeof date === 'string') {
    // Нормализуем формат: убираем 'T', заменяем на пробел, убираем timezone
    let normalized = date.replace('T', ' ').trim();
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
      // Возвращаем время в формате HH:MM, сохраняя минуты как есть
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
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

export const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

export const getDefaultDateTime = () => {
  return new Date().toISOString().slice(0, 16);
};

