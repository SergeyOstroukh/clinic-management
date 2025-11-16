const getApiUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return window.location.origin + '/api';
  }
  return 'http://localhost:3001/api';
};

export const API_URL = getApiUrl();

