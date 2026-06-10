export type Envio = {
    idPedido : string;
    origenIata : string;
    destinoIata : string;
    fechaHora : string;
    cantidadMaletas : number;
    idCliente : string;
}

export type EscalaRuta = {
    codigoVuelo: number | string;
    origenIata: string;
    destinoIata: string;
    horaSalidaUtc: string | null;
    horaLlegadaUtc: string | null;
    horaSalidaLocal: string | null;
    horaLlegadaLocal: string | null;
    capacidadMax: number;
    cancelado: boolean;
    motivoCancelacion: string | null;
}

export type EnvioRuta = {
    envio: Envio;
    estado: 'ENTREGADO' | 'SIN_ITINERARIO' | 'EN_TRANSITO' | string;
    aeropuertoActual: string | null;
    idItinerario: string | null;
    escalas: EscalaRuta[];
}

export type EnvioAlmacen = {
    envio: Envio;
    codigoAeropuerto: string;
    tipoAlmacen: 'DESTINO_FINAL' | 'TRANSITO' | string;
    estadoEnvio: string;
}
