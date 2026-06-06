import {Aeropuerto} from "@/app/shared/types/Aeropuerto";

export type TipoEvento =
    | "SIMULACION_INICIADA"
    | "AEROPUERTO_ACTUALIZADO"
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
}

export interface EventoVuelo extends EventoBase {
    codigoVuelo: bigint;
    origenIata: string;
    destinoIata: string;
    origenAeropuerto?: Aeropuerto;
    destinoAeropuerto?: Aeropuerto;
    estado: EstadoCapacidad;
    cantidadMaletas: number;
    horaSalidaLocal: string;
    horaLlegadaLocal: string;
    horaSalidaUtc: string;
    horaLlegadaUtc: string;
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
}

export interface EventoBatchSimulation {
    tiempoActual: Date;
    eventos: Evento[];
}