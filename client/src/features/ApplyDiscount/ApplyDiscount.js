import React, { useState } from 'react';
import { applyDiscount } from '../../shared/lib';
import './ApplyDiscount.css';

const ApplyDiscount = ({ originalTotal, onDiscountApplied }) => {
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);

  const handleApplyDiscount = () => {
    const result = applyDiscount(originalTotal, discountType, discountValue);
    setAppliedDiscount(result);
    if (onDiscountApplied) {
      onDiscountApplied(result.discountAmount);
    }
  };

  const handleReset = () => {
    setDiscountValue('');
    setAppliedDiscount(null);
    if (onDiscountApplied) {
      onDiscountApplied(0);
    }
  };

  return (
    <div className="discount-section">
      <h4>🏷️ Применить скидку</h4>
      
      <div className="discount-controls">
        <div className="discount-type-select">
          <label>
            <input
              type="radio"
              value="percent"
              checked={discountType === 'percent'}
              onChange={(e) => setDiscountType(e.target.value)}
            />
            Процент (%)
          </label>
          <label>
            <input
              type="radio"
              value="fixed"
              checked={discountType === 'fixed'}
              onChange={(e) => setDiscountType(e.target.value)}
            />
            Фиксированная (BYN)
          </label>
        </div>
        
        <div className="discount-input-row">
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={discountType === 'percent' ? 'Введите %' : 'Введите сумму'}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className="discount-input"
          />
          <button 
            className="btn btn-small btn-primary"
            onClick={handleApplyDiscount}
          >
            Применить
          </button>
          {appliedDiscount && appliedDiscount.discountAmount > 0 && (
            <button 
              className="btn btn-small"
              onClick={handleReset}
            >
              Сбросить
            </button>
          )}
        </div>
      </div>
      
      {appliedDiscount && appliedDiscount.discountAmount > 0 && (
        <div className="discount-result">
          <div className="discount-row">
            <span>Скидка:</span>
            <strong className="discount-amount">-{appliedDiscount.discountAmount.toFixed(2)} BYN</strong>
          </div>
          <div className="discount-row final-price">
            <span>К оплате со скидкой:</span>
            <strong>{appliedDiscount.finalTotal.toFixed(2)} BYN</strong>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplyDiscount;

