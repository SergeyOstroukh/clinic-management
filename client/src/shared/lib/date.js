import { format } from 'date-fns';
import ru from 'date-fns/locale/ru';

export const formatDate = (date, formatStr = 'd MMMM yyyy') => {
  return format(new Date(date), formatStr, { locale: ru });
};

export const formatDateTime = (date) => {
  return format(new Date(date), 'd MMMM yyyy HH:mm', { locale: ru });
};

export const formatTime = (date) => {
  return format(new Date(date), 'HH:mm');
};

export const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

export const getDefaultDateTime = () => {
  return new Date().toISOString().slice(0, 16);
};

