import React from 'react';
import './Button.css';

export const Button = ({ 
  children, 
  onClick, 
  type = 'button', 
  variant = 'default', 
  size = 'normal',
  disabled = false,
  className = ''
}) => {
  const classNames = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classNames}
    >
      {children}
    </button>
  );
};

