import api from './axios';

export const clientsApi = {
  getAll: () => api.get('/clients'),
  create: (data) => api.post('/clients', data),
  getAppointments: (id) => api.get(`/clients/${id}/appointments`),
};

