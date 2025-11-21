import React, { useState, useEffect } from 'react';
import { formatPhone, validatePhone, phoneMask } from '../../utils/phoneValidation';
import './PhoneInput.css';

const PhoneInput = ({ value, onChange, onBlur, placeholder = '+375 (XX) XXX-XX-XX', required = false, className = '' }) => {
  const [displayValue, setDisplayValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (value) {
      setDisplayValue(formatPhone(value));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e) => {
    const inputValue = e.target.value;
    const masked = phoneMask(inputValue);
    setDisplayValue(masked);
    setError('');
    
    // Извлекаем чистый номер для onChange
    const cleaned = masked.replace(/\D/g, '');
    if (cleaned.startsWith('375')) {
      onChange(`+${cleaned}`);
    } else if (cleaned.length > 0) {
      onChange(`+375${cleaned}`);
    } else {
      onChange('');
    }
  };

  const handleBlur = (e) => {
    if (displayValue) {
      const validation = validatePhone(displayValue);
      if (!validation.valid) {
        setError(validation.error);
      } else {
        setError('');
        // Обновляем значение на валидный формат
        if (validation.phone && validation.phone !== value) {
          onChange(validation.phone);
        }
      }
    } else if (required) {
      setError('Номер телефона обязателен');
    }
    
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <div className={`phone-input-wrapper ${className}`}>
      <input
        type="tel"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`phone-input ${error ? 'phone-input-error' : ''}`}
        required={required}
      />
      {error && <span className="phone-input-error-message">{error}</span>}
    </div>
  );
};

export default PhoneInput;

