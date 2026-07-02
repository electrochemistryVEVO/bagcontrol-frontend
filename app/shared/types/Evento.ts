import { Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { Envio, EnvioAeropuerto } from './Envio';

export type TipoEvento =
    | 'SIMULACION_INICIADA'
    | 'OPERACION_DIA_ACTIVA'
    | 'AEROPUERTO_ACTUALIZADO'
    | 'ALERTA_AEROPUERTO_SATURADO'
    | 'VUELO_DESPEGA'
    | 'VUELO_ATERRIZA'
    | 'VUELO_CANCELADO'
    | 'PLAN_GENERADO'
    | 'SIMULACION_PAUSADA'
    | 'SIMULACION_EN_PAUSA'
    | 'SIMULACION_REANUDADA'
    | 'VELOCIDAD_CAMBIADA'
    | 'CICLO_COLAPSO_EVALUADO'
    | 'COLAPSO_DETECTADO'
    | 'REPLANIFICACION_VUELO'
    | 'REPLANIFICACION_ENVIO'
    | 'SIMULACION_DETENIDA'
    | 'SIMULACION_FINALIZADA'
    | 'ERROR';

export type EstadoCapacidad = 'ROJO' | 'AMARILLO' | 'VERDE' | 'VACIO';

export interface EventoBase {
    tipo: TipoEvento;
    fechaHoraEvento: string;
    idSimulacion?: string;
    horaInicio?: string;
    estado?: string;
    mensaje?: string;
}

export interface EventoAeropuerto extends EventoBase {
    codigoAeropuerto: string;
    estadoCapacidad: EstadoCapacidad;
    porcentajeOcupacion: number;
    maletasActuales: number;
    capacidadAlmacen: number;
    enviosProximosAVencer?: EnvioAeropuerto[];
}

export interface EventoVuelo extends EventoBase {
    codigoVuelo: string | number;
    origenIata: string;
    destinoIata: string;
    origenAeropuerto?: Aeropuerto;
    destinoAeropuerto?: Aeropuerto;
    estado: EstadoCapacidad;
    cantidadMaletas: number;
    capacidadMax: number;
    horaSalidaLocal: string;
    horaLlegadaLocal: string;
    horaSalidaUtc: string;
    horaLlegadaUtc: string;
    codigoEnvios: string[];
}

export interface DetalleColapso {
    idPedido?: string;
    origenIata?: string;
    destinoIata?: string;
    cantidadMaletas?: number;
    motivo?: string;
    vueloAfectado?: number | string;
    itinerarioAfectado?: string;
    horaSimulada?: string;
    fechaHoraRegistro?: string;
    deadlineSla?: string;
    horaColapso?: string;
    tipoSla?: string;
    estadoEnvio?: string;
    aeropuertoActual?: string;
}

export interface EventoColapso extends EventoBase {
    simulacionId?: string;
    fechaSimuladaUtc?: string;
    ciclo?: number;
    causaPrincipal?: string;
    criteriosActivados?: string[];
    detalle?: DetalleColapso;
}

export interface EventoReplanificacionEnvio extends EventoBase {
    tipo: 'REPLANIFICACION_ENVIO';
    idPedido: string;
    motivo: string;
    origenIata: string;
    destinoIata: string;
    itinerarioAnterior?: string | null;
    itinerarioNuevo?: string | null;
    vueloAnterior?: string | null;
    vueloNuevo?: string | null;
    estadoAnterior?: string | null;
    estadoNuevo?: string | null;
    horaSimulada?: string | null;
    detalle?: string | null;
}

export type Evento = EventoAeropuerto | EventoVuelo | EventoColapso | EventoReplanificacionEnvio | EventoBase;

export interface EventoBatch {
    simulacionId: string;
    numeroLote: number;
    ventanaInicio: string | null;
    ventanaFin: string | null;
    cantidadEventos: number;
    eventos: Evento[];
    envios: Envio[];
}

export interface EventoBatchSimulation {
    tiempoActual: Date;
    eventos: Evento[];
}
