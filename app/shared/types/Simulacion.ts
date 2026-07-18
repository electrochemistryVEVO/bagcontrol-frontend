import {EventoVuelo} from "@/app/shared/types/Evento";

export type RespuestaInicioSimulacionDTO = {
    simulacionId: string;
    websocketTopic: string;
    modo: string;
};

export type RespuestaEstadoSimulacionDTO = {
    simulacionId : string;
    estado : string;
    pausada : boolean;
    detenida : boolean;
    saMs : number;
    ultimoLoteEmitido : bigint;
    algoritmo:string;
    k : number;
    fechaInicio : string;
    fechaCreacion : string;
    tiempoSimuladoActual : string;
    fechaHoraInicioReal : string | null;
    fechaHoraFinReal : string | null;
    sumaSaBloquesMs?: number;
    sumaDiferenciaSaTaMs?: number;
    bloquesTaMayorSa?: number;
    historialAjustesSa?: string[];
}

export type ResumenFinalSimulacion = {
    vueloFinal : EventoVuelo | null
}
