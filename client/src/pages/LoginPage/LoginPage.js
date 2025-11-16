import React, { useState } from 'react';
import './LoginPage.css';
import axios from 'axios';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }
  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

const LoginPage = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        username,
        password
      });

      // Сохраняем данные пользователя в localStorage
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Вызываем callback для перехода в приложение
      onLoginSuccess(response.data.user);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setError('Неверный логин или пароль');
      } else {
        setError('Ошибка подключения к серверу');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>🏥 Система управления клиникой</h1>
          <p>Введите логин и пароль для входа</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="login-error">
              ⚠️ {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Логин</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите логин"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn-login"
            disabled={loading}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="login-footer">
          <p className="login-hint">💡 Учетные данные по умолчанию:</p>
          <div className="login-hints">
            <div className="hint-item">
              <strong>Главный админ:</strong> Admin / admin
            </div>
            <div className="hint-item">
              <strong>Администратор:</strong> Administrator / administrator
            </div>
            <div className="hint-item">
              <strong>Врач:</strong> Doctor1 / doctor
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

