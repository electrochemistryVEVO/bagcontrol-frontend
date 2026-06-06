import {RespuestaEstadoSimulacionDTO, RespuestaInicioSimulacionDTO} from '../shared/types/Simulacion';
import axiosApi from './config/axios';
import {Envio} from "@/app/shared/types/Envio";

export type ParametrosSimulacion = {
  fechaInicio: string; // Formato ISO: 'YYYY-MM-DD'
  fechaFin?: string;   // Opcional para el escenario de colapso
  k?: number;
  algoritmo?: string;  // ej: 'TABU' o 'GRASP'
}


export const SimulacionService = {
    prepararInicio : (params: ParametrosSimulacion) => axiosApi.post<RespuestaInicioSimulacionDTO>('/simulacion/preparar', null, {params}),
    iniciar: (idSimulacion: string) => axiosApi.post(`/simulacion/iniciar/${idSimulacion}/arrancar`),
    obtenerEstado : (idSimulacion:string) : Promise<any> => axiosApi.get(`/simulacion/${idSimulacion}/estado`),
    obtenerEnviosPorVuelo: (idSimulacion:string,codigoVuelo:bigint) : Promise<any> => axiosApi.get(`/simulacion/${idSimulacion}/vuelos/${codigoVuelo}/envios`)
}



