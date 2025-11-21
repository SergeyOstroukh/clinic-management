// Валидация и форматирование телефонных номеров

/**
 * Очищает номер телефона от всех символов кроме цифр
 */
export const cleanPhone = (phone) => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

/**
 * Форматирует номер телефона в белорусский формат
 * +375 (XX) XXX-XX-XX
 */
export const formatPhone = (phone) => {
  const cleaned = cleanPhone(phone);
  
  if (cleaned.length === 0) return '';
  
  // Если начинается с 375, убираем для форматирования
  let digits = cleaned;
  if (digits.startsWith('375')) {
    digits = digits.substring(3);
  }
  
  // Если начинается с 8, заменяем на +375
  if (digits.startsWith('8') && digits.length === 10) {
    digits = digits.substring(1);
  }
  
  // Форматируем: +375 (XX) XXX-XX-XX
  if (digits.length >= 2) {
    const code = digits.substring(0, 2);
    const rest = digits.substring(2);
    
    if (rest.length >= 3) {
      const part1 = rest.substring(0, 3);
      const part2 = rest.substring(3, 5);
      const part3 = rest.substring(5, 7);
      
      if (part3) {
        return `+375 (${code}) ${part1}-${part2}-${part3}`;
      } else if (part2) {
        return `+375 (${code}) ${part1}-${part2}`;
      } else {
        return `+375 (${code}) ${part1}`;
      }
    } else {
      return `+375 (${code}) ${rest}`;
    }
  }
  
  return `+375 ${digits}`;
};

/**
 * Валидирует номер телефона
 * Принимает форматы: +375XXXXXXXXX, 375XXXXXXXXX, 8XXXXXXXXX, XXXXXXXXX
 */
export const validatePhone = (phone) => {
  if (!phone) return { valid: false, error: 'Номер телефона обязателен' };
  
  const cleaned = cleanPhone(phone);
  
  // Проверяем длину (9 цифр для Беларуси без кода страны, или 12 с кодом)
  if (cleaned.length < 9) {
    return { valid: false, error: 'Номер телефона слишком короткий' };
  }
  
  // Если начинается с 375, проверяем что всего 12 цифр
  if (cleaned.startsWith('375')) {
    if (cleaned.length !== 12) {
      return { valid: false, error: 'Неверный формат номера' };
    }
    return { valid: true, phone: `+${cleaned}` };
  }
  
  // Если начинается с 8 и 10 цифр, заменяем на +375
  if (cleaned.startsWith('8') && cleaned.length === 10) {
    return { valid: true, phone: `+375${cleaned.substring(1)}` };
  }
  
  // Если 9 цифр, добавляем +375
  if (cleaned.length === 9) {
    return { valid: true, phone: `+375${cleaned}` };
  }
  
  return { valid: false, error: 'Неверный формат номера телефона' };
};

/**
 * Маска ввода для телефона
 */
export const phoneMask = (value) => {
  const cleaned = cleanPhone(value);
  
  if (cleaned.length === 0) return '';
  
  // Если начинается с 375, убираем для форматирования
  let digits = cleaned;
  if (digits.startsWith('375')) {
    digits = digits.substring(3);
  }
  
  // Если начинается с 8, заменяем
  if (digits.startsWith('8') && digits.length === 10) {
    digits = digits.substring(1);
  }
  
  // Ограничиваем до 9 цифр (без кода страны)
  if (digits.length > 9) {
    digits = digits.substring(0, 9);
  }
  
  return formatPhone(`+375${digits}`);
};

