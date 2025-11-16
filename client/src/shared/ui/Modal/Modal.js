import React from 'react';
import './Modal.css';

export const Modal = ({ isOpen, onClose, children, size = 'normal' }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal ${size === 'large' ? 'modal-large' : ''}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

