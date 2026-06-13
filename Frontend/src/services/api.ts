import axios from 'axios';

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL;
if (!rawBackendUrl) {
  throw new Error(
    'VITE_BACKEND_URL is missing. Create Frontend/.env.production (or .env) before running npm run build.',
  );
}

export const BACKEND_URL = rawBackendUrl.replace(/\/$/, '');
export const WS_HOST = new URL(BACKEND_URL).hostname;

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
