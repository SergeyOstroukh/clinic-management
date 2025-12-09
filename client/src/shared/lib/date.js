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
    let normalized = date.replace('T', ' ');
    if (normalized.includes('Z')) {
      normalized = normalized.replace('Z', '');
    }
    if (normalized.includes('+')) {
      normalized = normalized.split('+')[0];
    }
    if (normalized.includes('-', 10) && normalized.length >= 16) {
      // Формат 'YYYY-MM-DD HH:MM:SS' или 'YYYY-MM-DD HH:MM'
      const timePart = normalized.split(' ')[1];
      if (timePart) {
        const [hours, minutes] = timePart.split(':');
        if (hours && minutes) {
          return `${String(parseInt(hours, 10)).padStart(2, '0')}:${String(parseInt(minutes, 10)).padStart(2, '0')}`;
        }
      }
    }
  }
  // Для других форматов используем стандартный парсинг
  return format(new Date(date), 'HH:mm');
};

export const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

export const getDefaultDateTime = () => {
  return new Date().toISOString().slice(0, 16);
};

