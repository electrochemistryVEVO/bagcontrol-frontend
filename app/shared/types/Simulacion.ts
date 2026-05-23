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
    ultimoLoteEmitido : number;
    algoritmo:string;
    k : number;
    fechaInicio : string;
    fechaCreacion : string;
    tiempoSimuladoActual : string;
}