import React, { useState } from 'react';
import { calculateChange } from '../../shared/lib';
import './PaymentCalculator.css';

const PaymentCalculator = ({ totalAmount }) => {
  const [paidAmount, setPaidAmount] = useState('');
  
  const changeResult = paidAmount && parseFloat(paidAmount) > 0
    ? calculateChange(paidAmount, totalAmount)
    : null;

  return (
    <div className="change-calculator">
      <h4>💰 Калькулятор сдачи</h4>
      
      <div className="calculator-row">
        <label>Клиент дал:</label>
        <input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={paidAmount}
          onChange={(e) => setPaidAmount(e.target.value)}
          onWheel={(e) => e.target.blur()}
          className="paid-input"
        />
        <span>BYN</span>
      </div>
      
      {changeResult && (
        <div className="calculator-result">
          <div className="result-row">
            <span>К оплате:</span>
            <strong>{totalAmount.toFixed(2)} BYN</strong>
          </div>
          <div className="result-row change-row">
            <span>Сдача:</span>
            <strong className={changeResult.isEnough ? 'change-positive' : 'change-negative'}>
              {changeResult.change.toFixed(2)} BYN
            </strong>
          </div>
          {!changeResult.isEnough && (
            <div className="warning-message">
              ⚠️ Недостаточно средств!
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentCalculator;

