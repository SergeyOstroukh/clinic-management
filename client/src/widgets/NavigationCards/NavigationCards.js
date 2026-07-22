import React from 'react';
import './NavigationCards.css';

export const NavigationCards = ({ 
  onNavigate, 
  clientsCount, 
  servicesCount, 
  materialsCount,
  currentUser,
  deferredFormsCount = 0
}) => {
  const allCards = [
    { id: 'booking', icon: '🗓️', title: 'Запись пациентов', gradient: 'booking', allowedRoles: ['superadmin', 'administrator'] },
    { id: 'schedule', icon: '📅', title: 'Расписание врачей', gradient: 'schedule', allowedRoles: ['superadmin', 'administrator'] },
    { id: 'doctor-dashboard', icon: '👨‍⚕️', title: 'Мой кабинет', gradient: 'doctors', allowedRoles: ['doctor'] },
    { id: 'doctors', icon: '👨‍⚕️', title: 'Наши врачи', gradient: 'doctors', allowedRoles: ['superadmin', 'administrator'] },
    { id: 'administrators', icon: '💼', title: 'Администраторы', gradient: 'administrators', allowedRoles: ['superadmin'] },
    { id: 'clients', icon: '👥', title: 'Все клиенты', gradient: 'clients', allowedRoles: ['superadmin', 'administrator'] },
    { id: 'services', icon: '💼', title: 'Все услуги', gradient: 'services', allowedRoles: ['superadmin', 'administrator'] },
    { id: 'materials', icon: '📦', title: 'Все материалы', gradient: 'materials', allowedRoles: ['superadmin'] },
    { id: 'composite-services', icon: '🔧', title: 'Конструктор услуг', gradient: 'services', allowedRoles: ['superadmin', 'administrator'] },
    { id: 'statistics', icon: '📊', title: 'Статистика и отчеты', gradient: 'reports', allowedRoles: ['superadmin'] },
    { id: 'reports-forms', icon: '📋', title: 'Отчёты / Формы', gradient: 'reports', allowedRoles: ['superadmin', 'administrator', 'doctor'] },
  ];

  // Фильтруем карточки по роли пользователя
  const cards = allCards.filter(card => 
    card.allowedRoles.includes(currentUser?.role)
  );

  return (
    <div className="navigation-cards">
      {cards.map(card => (
        <div
          key={card.id}
          className={`nav-card nav-card-${card.gradient}`}
          onClick={() => onNavigate(card.id)}
        >
          <div className="nav-card-icon">{card.icon}</div>
          <h3>{card.title}</h3>
          {card.id === 'doctor-dashboard' && deferredFormsCount > 0 && (
            <span className="nav-card-badge">{deferredFormsCount}</span>
          )}
        </div>
      ))}
    </div>
  );
};

