import axios from 'axios';
import { BASE_URL } from './constants';

const axiosApi = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export const axiosSimulacion = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
});

// Adjunta JWT en cada request
const attachToken = (config: any) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('bagcontrol_token');
    if (token) {
      config.headers = config.headers ?? {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
};

// Si el backend devuelve 401, limpiar sesión y redirigir a /login
const handleUnauthorized = (error: any) => {
  if (error?.response?.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('bagcontrol_token');
    localStorage.removeItem('bagcontrol_user');
    document.cookie = 'bagcontrol_token=; path=/; max-age=0';
    window.location.href = '/';
  }
  return Promise.reject(error);
};

axiosApi.interceptors.request.use(attachToken);
axiosApi.interceptors.response.use(r => r, handleUnauthorized);

axiosSimulacion.interceptors.request.use(attachToken);
axiosSimulacion.interceptors.response.use(r => r, handleUnauthorized);

export default axiosApi;
