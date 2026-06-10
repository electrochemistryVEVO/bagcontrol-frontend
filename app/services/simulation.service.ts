import { RespuestaInicioSimulacionDTO } from '../shared/types/Simulacion';
import { Envio, EnvioAlmacen, EnvioRuta } from '@/app/shared/types/Envio';
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

    obtenerEstado : (idSimulacion: string) =>
        axiosApi.get(`/simulacion/${idSimulacion}/estado`),
    obtenerEnviosPorVuelo: (idSimulacion: string, codigoVuelo: string | number) =>
        axiosApi.get<Envio[]>(`/simulacion/${idSimulacion}/vuelos/${codigoVuelo}/envios`),
    obtenerRutaEnvio: (idSimulacion: string, idPedido: string) =>
        axiosApi.get<EnvioRuta>(`/simulacion/${idSimulacion}/envios/${idPedido}/ruta`),
    obtenerEnviosPorAlmacen: (idSimulacion: string, codigoIata: string) =>
        axiosApi.get<EnvioAlmacen[]>(`/simulacion/${idSimulacion}/aeropuertos/${codigoIata}/envios`),
    pausar: (idSimulacion: string) =>
        axiosApi.post(`/simulacion/${idSimulacion}/pausar`),

    reanudar: (idSimulacion: string) =>
        axiosApi.post(`/simulacion/${idSimulacion}/reanudar`),

    detener: (idSimulacion: string) =>
        axiosApi.post(`/simulacion/${idSimulacion}/detener`),
}


