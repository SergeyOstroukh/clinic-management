import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getFullName } from '../../shared/lib';
import './DoctorsPage.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

export const DoctorsPage = ({ onNavigate, currentUser }) => {
  const [doctors, setDoctors] = useState([]);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      const response = await axios.get(`${API_URL}/doctors`);
      setDoctors(response.data);
    } catch (error) {
      console.error('Ошибка загрузки врачей:', error);
    }
  };

  const handleEdit = (doctor) => {
    if (currentUser.role !== 'superadmin') {
      alert('Только главный администратор может редактировать врачей');
      return;
    }
    setEditingDoctor(doctor);
    setShowDoctorModal(true);
  };

  const handleDelete = async (id) => {
    if (currentUser.role !== 'superadmin') {
      alert('Только главный администратор может удалять врачей');
      return;
    }
    if (window.confirm('Удалить врача? Все записи к этому врачу останутся, но имя врача не будет отображаться.')) {
      try {
        const response = await axios.delete(`${API_URL}/doctors/${id}`);
        if (response.data.appointmentsUpdated > 0) {
          alert(`Врач удален. Обновлено записей: ${response.data.appointmentsUpdated}`);
        } else {
          alert('Врач успешно удален');
        }
        loadDoctors();
      } catch (error) {
        console.error('Ошибка удаления врача:', error);
        const errorMessage = error.response?.data?.error || error.message || 'Неизвестная ошибка';
        alert(`Ошибка удаления врача: ${errorMessage}`);
      }
    }
  };

  const handleSave = async (doctorData) => {
    try {
      if (editingDoctor) {
        await axios.put(`${API_URL}/doctors/${editingDoctor.id}`, doctorData);
      } else {
        await axios.post(`${API_URL}/doctors`, doctorData);
      }
      setShowDoctorModal(false);
      setEditingDoctor(null);
      loadDoctors();
    } catch (error) {
      alert('Ошибка сохранения врача');
      console.error(error);
    }
  };

  const handleModalClose = () => {
    setShowDoctorModal(false);
    setEditingDoctor(null);
  };

  const canEdit = currentUser && currentUser.role === 'superadmin';

  return (
    <div className="doctors-page">
      <div className="section-header">
        <h2>👨‍⚕️ Наши врачи</h2>
        <div>
          <button className="btn" onClick={() => onNavigate('home')}>← Назад</button>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => setShowDoctorModal(true)}>
              + Добавить врача
            </button>
          )}
        </div>
      </div>

      <div className="doctors-list-wide">
        {doctors.length === 0 ? (
          <div className="empty-state">
            <p>Нет врачей</p>
            {canEdit && (
              <button className="btn btn-primary" onClick={() => setShowDoctorModal(true)}>
                + Добавить первого врача
              </button>
            )}
          </div>
        ) : (
          <table className="wide-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>#</th>
                <th style={{ width: canEdit ? '25%' : '30%' }}>ФИО</th>
                <th style={{ width: canEdit ? '20%' : '25%' }}>Специализация</th>
                <th style={{ width: canEdit ? '15%' : '20%' }}>Телефон</th>
                <th style={{ width: canEdit ? '15%' : '20%' }}>Email</th>
                {canEdit && <th style={{ width: '20%' }}>Действия</th>}
              </tr>
            </thead>
            <tbody>
              {doctors.map((doctor, index) => (
                <tr key={doctor.id}>
                  <td className="number-cell">{index + 1}</td>
                  <td><strong>{getFullName(doctor.lastName, doctor.firstName, doctor.middleName)}</strong></td>
                  <td>{doctor.specialization || '-'}</td>
                  <td>{doctor.phone || '-'}</td>
                  <td>{doctor.email || '-'}</td>
                  {canEdit && (
                    <td className="table-actions">
                      <button 
                        className="btn btn-small"
                        onClick={() => handleEdit(doctor)}
                      >
                        ✏️ Редактировать
                      </button>
                      <button 
                        className="btn btn-small btn-danger"
                        onClick={() => handleDelete(doctor.id)}
                      >
                        🗑️ Удалить
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Модальное окно редактирования врача */}
      {showDoctorModal && canEdit && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingDoctor ? 'Редактировать врача' : 'Новый врач'}</h2>
            <DoctorForm 
              doctor={editingDoctor}
              onSave={handleSave}
              onCancel={handleModalClose}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Форма врача
const DoctorForm = ({ doctor, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    lastName: doctor?.lastName || '',
    firstName: doctor?.firstName || '',
    middleName: doctor?.middleName || '',
    specialization: doctor?.specialization || '',
    phone: doctor?.phone || '',
    email: doctor?.email || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.lastName || !formData.firstName) {
      alert('Фамилия и имя обязательны');
      return;
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Фамилия *"
        value={formData.lastName}
        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
        required
      />
      <input
        type="text"
        placeholder="Имя *"
        value={formData.firstName}
        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
        required
      />
      <input
        type="text"
        placeholder="Отчество"
        value={formData.middleName}
        onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
      />
      <input
        type="text"
        placeholder="Специализация (например: Терапевт, Стоматолог)"
        value={formData.specialization}
        onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
      />
      <input
        type="tel"
        placeholder="Телефон"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="btn btn-primary">
          {doctor ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </form>
  );
};

