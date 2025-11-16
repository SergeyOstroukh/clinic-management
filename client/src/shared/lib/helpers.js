export const getFullName = (person) => {
  if (!person) return '';
  const { lastName = '', firstName = '', middleName = '' } = person;
  return `${lastName} ${firstName} ${middleName}`.trim();
};

export const getStatusColor = (status) => {
  switch(status) {
    case 'scheduled': return '#667eea';
    case 'waiting': return '#ffa751';
    case 'in-progress': return '#4ecdc4';
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
    case 'completed': return 'Завершен';
    case 'cancelled': return 'Отменен';
    default: return 'Неизвестно';
  }
};

