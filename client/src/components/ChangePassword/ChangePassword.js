import React, { useState } from 'react';
import axios from 'axios';
import './ChangePassword.css';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

const ChangePassword = ({ currentUser, targetUser, isOpen, onClose, onSuccess }) => {
  // targetUser - пользователь, для которого меняем пароль (если null, то меняем свой)
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Определяем, меняем ли мы свой пароль или чужой
  const isChangingOwnPassword = !targetUser || (targetUser && currentUser.id === targetUser.id);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Валидация
    // Текущий пароль обязателен только при смене своего пароля
    if (isChangingOwnPassword && !formData.currentPassword) {
      setError('Введите текущий пароль');
      setLoading(false);
      return;
    }

    if (!formData.newPassword) {
      setError('Введите новый пароль');
      setLoading(false);
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('Новый пароль должен содержать минимум 6 символов');
      setLoading(false);
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Новые пароли не совпадают');
      setLoading(false);
      return;
    }

    if (isChangingOwnPassword && formData.currentPassword === formData.newPassword) {
      setError('Новый пароль должен отличаться от текущего');
      setLoading(false);
      return;
    }

    try {
      const targetUserId = targetUser ? targetUser.id : currentUser.id;
      
      await axios.post(`${API_URL}/users/change-password`, {
        userId: targetUserId,
        currentPassword: isChangingOwnPassword ? formData.currentPassword : undefined,
        newPassword: formData.newPassword,
        currentUser: currentUser
      });

      // Очищаем форму
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      alert('✅ Пароль успешно изменен. Войдите снова с новым паролем.');
      
      if (onSuccess) {
        onSuccess({ requireRelogin: true, changedOwnPassword: isChangingOwnPassword });
      }
      
      onClose();
    } catch (error) {
      console.error('Ошибка смены пароля:', error);
      setError(error.response?.data?.error || error.message || 'Ошибка смены пароля');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content change-password-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-details">
          <h3>🔐 Смена пароля</h3>
          <button className="modal-close-details" onClick={onClose} title="Закрыть">
            <span>×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="change-password-form">
          {targetUser && targetUser.id !== currentUser.id && (
            <div className="form-info">
              <p>Вы меняете пароль для пользователя: <strong>{targetUser.username}</strong></p>
              {targetUser.full_name && <p>ФИО: <strong>{targetUser.full_name}</strong></p>}
            </div>
          )}
          
          {isChangingOwnPassword && (
            <div className="form-group">
              <label>Текущий пароль *</label>
              <input
                type="password"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                placeholder="Введите текущий пароль"
                required={isChangingOwnPassword}
                autoComplete="current-password"
              />
            </div>
          )}

          <div className="form-group">
            <label>Новый пароль *</label>
            <input
              type="password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              placeholder="Введите новый пароль (минимум 6 символов)"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label>Подтвердите новый пароль *</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Повторите новый пароль"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : 'Изменить пароль'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;

