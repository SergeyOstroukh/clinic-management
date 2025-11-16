import api from './axios';

export const appointmentsApi = {
  getAll: () => api.get('/appointments'),
  create: (data) => api.post('/appointments', data),
  updateStatus: (id, status) => api.patch(`/appointments/${id}/status`, { status }),
  updateCallStatus: (id, called_today) => api.patch(`/appointments/${id}/call-status`, { called_today }),
};

