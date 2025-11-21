import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ChangePassword from '../../components/ChangePassword';
import './AdministratorsPage.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

export const AdministratorsPage = ({ onNavigate, currentUser }) => {
  const [administrators, setAdministrators] = useState([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [targetUserForPassword, setTargetUserForPassword] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdministrators();
  }, []);

  const loadAdministrators = async () => {
    try {
      setLoading(true);
      // Получаем всех пользователей с ролью administrator
      const response = await axios.get(`${API_URL}/users?role=administrator`);
      setAdministrators(response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки администраторов:', error);
      alert('Ошибка загрузки администраторов');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (adminData) => {
    try {
      await axios.post(`${API_URL}/users`, {
        ...adminData,
        role: 'administrator',
        currentUser: currentUser
      });
      setShowAdminModal(false);
      loadAdministrators();
      alert('Администратор успешно создан');
    } catch (error) {
      console.error('Ошибка создания администратора:', error);
      alert(error.response?.data?.error || 'Ошибка создания администратора');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Удалить администратора? Он больше не сможет войти в систему.')) {
      try {
        // Для DELETE запроса передаем currentUser через config.data
        await axios.delete(`${API_URL}/users/${id}`, {
          data: { currentUser: currentUser }
        });
        loadAdministrators();
        alert('Администратор удален');
      } catch (error) {
        console.error('Ошибка удаления администратора:', error);
        alert(error.response?.data?.error || 'Ошибка удаления администратора');
      }
    }
  };

  const handleChangePassword = (admin) => {
    setTargetUserForPassword(admin);
    setShowChangePasswordModal(true);
  };

  if (loading) {
    return (
      <div className="administrators-page">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="administrators-page">
      <div className="section-header">
        <h2>💼 Администраторы</h2>
        <div>
          <button className="btn" onClick={() => onNavigate('home')}>← Назад</button>
          <button className="btn btn-primary" onClick={() => setShowAdminModal(true)}>
            + Добавить администратора
          </button>
        </div>
      </div>

      <div className="administrators-list">
        {administrators.length === 0 ? (
          <div className="empty-state">
            <p>Нет администраторов</p>
            <button className="btn btn-primary" onClick={() => setShowAdminModal(true)}>
              + Добавить первого администратора
            </button>
          </div>
        ) : (
          <table className="wide-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>#</th>
                <th style={{ width: '25%' }}>Имя пользователя</th>
                <th style={{ width: '30%' }}>Полное имя</th>
                <th style={{ width: '20%' }}>Роль</th>
                <th style={{ width: '20%' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {administrators.map((admin, index) => (
                <tr key={admin.id}>
                  <td className="number-cell">{index + 1}</td>
                  <td><strong>{admin.username}</strong></td>
                  <td>{admin.full_name || '-'}</td>
                  <td>
                    <span className="role-badge role-administrator">Администратор</span>
                  </td>
                  <td className="table-actions">
                    <button 
                      className="btn btn-small"
                      onClick={() => handleChangePassword(admin)}
                      title="Сменить пароль"
                    >
                      🔐 Пароль
                    </button>
                    <button 
                      className="btn btn-small btn-danger"
                      onClick={() => handleDelete(admin.id)}
                    >
                      🗑️ Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Модальное окно создания администратора */}
      {showAdminModal && (
        <div className="modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Новый администратор</h2>
            <AdministratorForm 
              onSave={handleSave}
              onCancel={() => setShowAdminModal(false)}
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

// Форма администратора
const AdministratorForm = ({ onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.username) {
      alert('Имя пользователя обязательно');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      alert('Пароль должен содержать минимум 6 символов');
      return;
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Имя пользователя (логин) *"
        value={formData.username}
        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
        required
      />
      <input
        type="password"
        placeholder="Пароль (минимум 6 символов) *"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        required
        minLength={6}
      />
      <input
        type="text"
        placeholder="Полное имя (необязательно)"
        value={formData.full_name}
        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
      />
      <p className="form-hint">
        Администратор сможет войти в систему с указанными логином и паролем.
      </p>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="btn btn-primary">
          Создать
        </button>
      </div>
    </form>
  );
};

