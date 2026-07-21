import { RespuestaEstadoSimulacionDTO, RespuestaInicioSimulacionDTO } from '../shared/types/Simulacion';
import { Envio, EnvioAlmacen, EnvioRuta, InventarioOperativoAeropuerto, MaletaSimulacion } from '@/app/shared/types/Envio';
import axiosApi, { axiosSimulacion } from './config/axios';
import {EventoVuelo} from "@/app/shared/types/Evento";

export type ParametrosSimulacion = {
  fechaInicio: string; // Formato ISO: 'YYYY-MM-DD'
  fechaFin?: string;   // Opcional para el escenario de colapso
  k?: number;
  algoritmo?: string;  // ej: 'TABU' o 'GRASP'
  modo?: string;       // '0' (OPERACION_DIA), '1' (VENTANA_CINCO_DIAS), '2' (COLAPSO_OPERATIVO)
}

export type SimulacionActiva = {
  simulacionId: string;
  websocketTopic?: string;
  modo?: string;
  estado?: string;
  k?: number;
  fechaInicio?: string;
  fechaCreacion?: string;
}

export type VueloCancelable = {
  codigoVuelo: number;
  origenIata: string;
  destinoIata: string;
  horaSalidaLocal: string;
  horaSalidaUtc: string;
  horaLlegadaLocal: string;
  horaLlegadaUtc: string;
  capacidadMax: number;
  enviosAfectados: string[];
  cantidadMaletas: number;
}

export type CancelacionVueloRespuesta = {
  codigoVuelo: number;
  origenIata: string;
  destinoIata: string;
  registradaEnSimulado: string;
  horaSalidaLocalObjetivo: string;
  horaSalidaUtcObjetivo: string;
  enviosAfectados: string[];
  cantidadMaletas: number;
  estado: string;
}

export type VueloInstanciado = {
  codigoBase: number;
  origenIata: string;
  destinoIata: string;
  fechaHoraSalida: string;
  fechaHoraLlegada: string;
  capacidadMax: number;
  ocupacionActual: number;
  estaCancelado: boolean;
}

export const SimulacionService = {
    // Usa timeout extendido: el backend corre el planificador en el primer ciclo
    // y con 9.5M de envíos puede tardar bastante más de 10 segundos.
    prepararInicio : (params: ParametrosSimulacion) =>
        axiosSimulacion.post<RespuestaInicioSimulacionDTO>('/simulacion/preparar', null, { params }),

    listarActivas: (modo?: string) =>
        axiosApi.get<SimulacionActiva[]>('/simulacion/activas', { params: modo ? { modo } : undefined }),

    iniciar: (idSimulacion: string) =>
        axiosSimulacion.post(`/simulacion/iniciar/${idSimulacion}/arrancar`),

    obtenerEstado : (idSimulacion: string) =>
        axiosApi.get<RespuestaEstadoSimulacionDTO>(`/simulacion/${idSimulacion}/estado`),
    obtenerSnapshot : (idSimulacion: string) =>
        axiosApi.get(`/simulacion/${idSimulacion}/snapshot`),
    obtenerEnviosPorVuelo: (idSimulacion: string, flight:EventoVuelo,timestamp:string) =>
        axiosApi.post<Envio[]>(`/simulacion/${idSimulacion}/vuelos/envios`, { flight,timestamp }),
    obtenerVuelosCancelables: (idSimulacion: string, instanteSimulado: string) =>
        axiosApi.get<VueloCancelable[]>(`/simulacion/${idSimulacion}/vuelos/cancelables`, {
          params: { instanteSimulado },
        }),
    obtenerVuelosInstanciados: (fecha: string) =>
        axiosApi.get<VueloInstanciado[]>('/vuelos/instanciados', { params: { fecha } }),
    cancelarProximaOcurrencia: (idSimulacion: string, codigoVuelo: number, instanteSimulado: string) =>
        axiosApi.post<CancelacionVueloRespuesta>(
          `/simulacion/${idSimulacion}/vuelos/${codigoVuelo}/cancelaciones`,
          { instanteSimulado, motivo: 'CANCELACION_MANUAL' },
        ),
    obtenerRutaEnvio: (idSimulacion: string, idPedido: string, timestamp: string) =>
        axiosApi.get<EnvioRuta>(`/simulacion/${idSimulacion}/envios/${idPedido}/ruta`, { params: { timestamp } }),
    obtenerEnviosPorAlmacen: (idSimulacion: string, codigoIata: string, timestamp: string) =>
        axiosApi.get<EnvioAlmacen[]>(`/simulacion/${idSimulacion}/aeropuertos/${codigoIata}/envios`, { params: { timestamp } }),
    obtenerMaletasPorAeropuerto: (idSimulacion: string, codigoIata: string, timestamp: string) =>
        axiosApi.get<MaletaSimulacion[]>(`/simulacion/${idSimulacion}/aeropuertos/${codigoIata}/maletas`, { params: { timestamp } }),
    obtenerInventarioOperacionDia: () =>
        axiosApi.get<InventarioOperativoAeropuerto[]>('/operacion-dia/aeropuertos/inventario'),
    obtenerInventarioOperacionDiaPorAeropuerto: (codigoIata: string) =>
        axiosApi.get<InventarioOperativoAeropuerto>(
          `/operacion-dia/aeropuertos/${encodeURIComponent(codigoIata)}/inventario`,
        ),
    pausar: (idSimulacion: string) =>
        axiosApi.post(`/simulacion/${idSimulacion}/pausar`),

    reanudar: (idSimulacion: string) =>
        axiosApi.post(`/simulacion/${idSimulacion}/reanudar`),

    detener: (idSimulacion: string) =>
        axiosApi.post(`/simulacion/${idSimulacion}/detener`),

    iniciarOperacionDia: () =>
        axiosSimulacion.post<RespuestaInicioSimulacionDTO>('/simulacion/operacion-dia/iniciar'),

    obtenerOperacionDiaActiva: () =>
        axiosApi.get<SimulacionActiva | ''>('/simulacion/operacion-dia/activa'),
}


