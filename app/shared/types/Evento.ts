
import {Aeropuerto} from "@/app/shared/types/Aeropuerto";
import {Envio, EnvioAeropuerto} from './Envio';

export type TipoEvento = 
    | "SIMULACION_INICIADA"
    | "AEROPUERTO_ACTUALIZADO"
    | "ALERTA_AEROPUERTO_SATURADO"
    | "VUELO_DESPEGA"
    | "VUELO_ATERRIZA"
    | "VUELO_CANCELADO"
    | "PLAN_GENERADO"
    | "SIMULACION_PAUSADA"
    | "SIMULACION_EN_PAUSA"
    | "SIMULACION_REANUDADA"
    | "VELOCIDAD_CAMBIADA"
    | "CICLO_COLAPSO_EVALUADO"
    | "COLAPSO_DETECTADO"
    | "SIMULACION_DETENIDA"
    | "SIMULACION_FINALIZADA"
    | "ERROR";

export type EstadoCapacidad = "ROJO" | "AMARILLO" | "VERDE";

// ==========================================
// DTOs BASE Y EVENTOS
// ==========================================
export interface EventoBase {
    tipo: TipoEvento;
    fechaHoraEvento: string;
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

// Discriminador automático para Typescript (Opcional pero muy útil)
export type Evento = EventoAeropuerto | EventoVuelo | EventoBase;

// ==========================================
// DTOs DE LOTE (BATCH)
// ==========================================
export interface EventoBatch {
    simulacionId: string;
    numeroLote: number;
    ventanaInicio: string | null;
    ventanaFin: string | null;
    cantidadEventos: number;
    eventos: Evento[];
    envios : Envio[]; //Envios planificados en el lote
}

export interface EventoBatchSimulation {
    tiempoActual: Date;
    eventos: Evento[];
}
