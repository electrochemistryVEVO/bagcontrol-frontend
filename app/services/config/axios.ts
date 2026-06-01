import axios from 'axios';
import { BASE_URL } from './constants';

const axiosApi = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Instancia con timeout extendido para operaciones de simulación
// que pueden tardar más (carga de datos, primer ciclo del planificador, etc.)
export const axiosSimulacion = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 minutos
  headers: {
    'Content-Type': 'application/json',
  },
});

export default axiosApi;
