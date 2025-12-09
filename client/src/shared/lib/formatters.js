import { format } from 'date-fns';
import ru from 'date-fns/locale/ru';

export const formatDate = (date, formatStr = 'd MMMM yyyy HH:mm') => {
  return format(new Date(date), formatStr, { locale: ru });
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
      // ВАЖНО: убеждаемся, что minutes не undefined и не пустая строка
      const hoursNum = parseInt(hours, 10) || 0;
      const minutesNum = parseInt(minutes, 10) || 0;
      
      console.log('formatTime парсинг:', {
        input: date,
        normalized,
        hours,
        minutes,
        hoursNum,
        minutesNum,
        result: `${String(hoursNum).padStart(2, '0')}:${String(minutesNum).padStart(2, '0')}`
      });
      
      // Возвращаем время в формате HH:MM, сохраняя минуты как есть
      return `${String(hoursNum).padStart(2, '0')}:${String(minutesNum).padStart(2, '0')}`;
    }
  }
  // Для других форматов используем стандартный парсинг
  // ВАЖНО: new Date() может конвертировать timezone, поэтому стараемся избегать этого
  try {
    const dateObj = new Date(date);
    if (!isNaN(dateObj.getTime())) {
      const result = format(dateObj, 'HH:mm');
      console.log('formatTime через new Date:', {
        input: date,
        result
      });
      return result;
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

