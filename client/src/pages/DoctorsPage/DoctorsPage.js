import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getFullName } from '../../shared/lib';
import ChangePassword from '../../components/ChangePassword';
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
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [targetUserForPassword, setTargetUserForPassword] = useState(null);

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

  const handleChangePassword = async (doctor) => {
    try {
      // Получаем пользователя для этого врача
      const response = await axios.get(`${API_URL}/users?doctor_id=${doctor.id}`);
      const user = response.data;
      
      if (!user) {
        alert('У этого врача нет аккаунта для входа в систему. Создайте аккаунт при добавлении/редактировании врача.');
        return;
      }
      
      setTargetUserForPassword(user);
      setShowChangePasswordModal(true);
    } catch (error) {
      console.error('Ошибка получения пользователя:', error);
      alert('Ошибка получения данных пользователя');
    }
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
                        className="btn btn-small"
                        onClick={() => handleChangePassword(doctor)}
                        title="Сменить пароль"
                      >
                        🔐 Пароль
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
              currentUser={currentUser}
            />
          </div>
        </div>
      )}

      {/* Модальное окно смены пароля */}
      {showChangePasswordModal && (
        <ChangePassword
          currentUser={currentUser}
          targetUser={targetUserForPassword}
          isOpen={showChangePasswordModal}
          onClose={() => {
            setShowChangePasswordModal(false);
            setTargetUserForPassword(null);
          }}
          onSuccess={() => {
            setShowChangePasswordModal(false);
            setTargetUserForPassword(null);
          }}
        />
      )}
    </div>
  );
};

// Форма врача
const DoctorForm = ({ doctor, onSave, onCancel, currentUser }) => {
  const [formData, setFormData] = useState({
    lastName: doctor?.lastName || '',
    firstName: doctor?.firstName || '',
    middleName: doctor?.middleName || '',
    specialization: doctor?.specialization || '',
    phone: doctor?.phone || '',
    email: doctor?.email || '',
    createUser: false,
    username: '',
    password: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.lastName || !formData.firstName) {
      alert('Фамилия и имя обязательны');
      return;
    }
    
    // Валидация для создания пользователя
    if (formData.createUser) {
      if (!formData.username) {
        alert('Введите имя пользователя для создания аккаунта');
        return;
      }
      if (!formData.password || formData.password.length < 6) {
        alert('Пароль должен содержать минимум 6 символов');
        return;
      }
    }
    
    // Добавляем currentUser для проверки прав доступа
    const dataToSave = {
      ...formData,
      currentUser: currentUser
    };
    
    onSave(dataToSave);
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
      
      {/* Создание пользователя для врача (только при создании нового врача) */}
      {!doctor && (
        <div className="form-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.createUser}
              onChange={(e) => setFormData({ ...formData, createUser: e.target.checked })}
            />
            <span>Создать пользователя для входа в систему</span>
          </label>
          
          {formData.createUser && (
            <div className="user-credentials">
              <input
                type="text"
                placeholder="Имя пользователя (логин) *"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required={formData.createUser}
              />
              <input
                type="password"
                placeholder="Пароль (минимум 6 символов) *"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={formData.createUser}
                minLength={6}
              />
              <p className="form-hint">
                Врач сможет войти в систему с этими данными. Роль будет автоматически установлена как "Врач".
              </p>
            </div>
          )}
        </div>
      )}
      
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

