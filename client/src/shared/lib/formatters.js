import { format } from 'date-fns';
import ru from 'date-fns/locale/ru';

export const formatDate = (date, formatStr = 'd MMMM yyyy HH:mm') => {
  return format(new Date(date), formatStr, { locale: ru });
};

export const formatTime = (date) => {
  return format(new Date(date), 'HH:mm');
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

