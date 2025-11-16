import React from 'react';
import { Button } from '../../../../shared/ui';
import { getFullName } from '../../../../shared/lib';
import './DoctorCard.css';

export const DoctorCard = ({ doctor, onEdit, onDelete }) => {
  return (
    <div className="doctor-card">
      <div className="doctor-info">
        <h3>{getFullName(doctor)}</h3>
        {doctor.specialization && (
          <p className="doctor-specialization">🩺 {doctor.specialization}</p>
        )}
        {doctor.phone && (
          <p className="doctor-contact">📞 {doctor.phone}</p>
        )}
        {doctor.email && (
          <p className="doctor-contact">📧 {doctor.email}</p>
        )}
      </div>
      <div className="doctor-actions">
        <Button size="small" onClick={() => onEdit(doctor)}>
          Редактировать
        </Button>
        <Button 
          size="small" 
          variant="danger" 
          onClick={() => onDelete(doctor.id)}
        >
          Удалить
        </Button>
      </div>
    </div>
  );
};

