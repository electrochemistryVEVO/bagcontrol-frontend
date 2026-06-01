import {RespuestaEstadoSimulacionDTO, RespuestaInicioSimulacionDTO} from '../shared/types/Simulacion';
import axiosApi, { axiosSimulacion } from './config/axios';

export type ParametrosSimulacion = {
  fechaInicio: string; // Formato ISO: 'YYYY-MM-DD'
  fechaFin?: string;   // Opcional para el escenario de colapso
  k?: number;
  algoritmo?: string;  // ej: 'TABU' o 'GRASP'
}

export const SimulacionService = {
    // Usa timeout extendido: el backend corre el planificador en el primer ciclo
    // y con 9.5M de envíos puede tardar bastante más de 10 segundos.
    prepararInicio : (params: ParametrosSimulacion) =>
        axiosSimulacion.post<RespuestaInicioSimulacionDTO>('/simulacion/preparar', null, { params }),

    iniciar: (idSimulacion: string) =>
        axiosSimulacion.post(`/simulacion/iniciar/${idSimulacion}/arrancar`),

    obtenerEstado : (idSimulacion: string): Promise<any> =>
        axiosApi.get(`/simulacion/${idSimulacion}/estado`),

    pausar: (idSimulacion: string) =>
        axiosApi.post(`/simulacion/${idSimulacion}/pausar`),

    reanudar: (idSimulacion: string) =>
        axiosApi.post(`/simulacion/${idSimulacion}/reanudar`),

    detener: (idSimulacion: string) =>
        axiosApi.post(`/simulacion/${idSimulacion}/detener`),
}
