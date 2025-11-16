import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../../../shared/ui';
import { doctorsApi } from '../../../shared/api';

export const CreateDoctorForm = ({ isOpen, onClose, onSuccess, editingDoctor = null }) => {
  const [form, setForm] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    specialization: '',
    phone: '',
    email: ''
  });

  useEffect(() => {
    if (editingDoctor) {
      setForm({
        lastName: editingDoctor.lastName || '',
        firstName: editingDoctor.firstName || '',
        middleName: editingDoctor.middleName || '',
        specialization: editingDoctor.specialization || '',
        phone: editingDoctor.phone || '',
        email: editingDoctor.email || ''
      });
    } else {
      resetForm();
    }
  }, [editingDoctor, isOpen]);

  const resetForm = () => {
    setForm({
      lastName: '',
      firstName: '',
      middleName: '',
      specialization: '',
      phone: '',
      email: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDoctor) {
        await doctorsApi.update(editingDoctor.id, form);
      } else {
        await doctorsApi.create(form);
      }
      resetForm();
      onSuccess();
      onClose();
    } catch (error) {
      alert('Ошибка сохранения врача');
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <h2>{editingDoctor ? 'Редактировать врача' : 'Новый врач'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Фамилия *"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Имя *"
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Отчество"
          value={form.middleName}
          onChange={(e) => setForm({ ...form, middleName: e.target.value })}
        />
        <input
          type="text"
          placeholder="Специализация (например: Терапевт, Стоматолог)"
          value={form.specialization}
          onChange={(e) => setForm({ ...form, specialization: e.target.value })}
        />
        <input
          type="tel"
          placeholder="Телефон"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <div className="modal-actions">
          <Button type="button" onClick={handleClose}>
            Отмена
          </Button>
          <Button type="submit" variant="primary">
            {editingDoctor ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

