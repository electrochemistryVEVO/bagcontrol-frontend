//Batch que se recibe del back
export class EventoBatch {
    public numeroLote !: string;
    public ventanaInicio !: Date;
    public ventanaFin !: Date;
    public cantidadEventos !: number;
    public eventos : Evento[] = [];

    constructor(obj : Partial<EventoBatch>){
        Object.assign(this,obj);
    }
}

//Batch que se recibe mediante un evento en la simulacion
export class EventoBatchSimulation{
    tiempoActual !: Date;
    eventos : Evento[] = [];
    constructor(tiempoActual : Date,eventos: Evento[]){
        this.tiempoActual = tiempoActual;
        this.eventos = eventos;
    }
}

export class Evento{
    public tipo!: string;
}

export class EventoAeropuerto extends Evento{
    public codigoAeropuerto!: string;
    public capacidadAlmacen!: number;
    public maletasActuales!: number;
    public estado!: string;
    public porcentajeOcupacion!: number;

    constructor(obj : Partial<EventoAeropuerto>){
        super()
        Object.assign(this,obj);
    }
}
export class EventoVuelo extends Evento{
    public codigoVuelo!: string;
    public origenIata!: string;
    public destinoIata!: string;
    public cantidadMaletas!: number;
    public capacidadAlmacen!: number;
    public maletasActuales!: number;
    public horaSalidaLocal?: Date;
    public horaLlegadaLocal?: Date;
    public horaSalida?: Date;
    public horaLlegada?: Date;
    public horaSalidaUtc !: Date;
    public horaLlegadaUtc !: Date;
    constructor(obj : Partial<EventoVuelo>){
        super()
        Object.assign(this,obj);
    }
}

export class SimulationEvent extends CustomEvent<EventoBatchSimulation>{
    public event!:Evento[];
    public horaActual!:Date;
    constructor(obj:EventoBatchSimulation) {
        super("eventoSimulacion",{detail:obj});
        this.event = obj.eventos;
        this.horaActual = obj.tiempoActual;
    }
    static subscribe(cb:(eventoSim:Event)=>void){
        document.addEventListener("eventoSimulacion", cb);
        console.log("event listener added")
    }
    static unsubscribe(cb:(eventoSim:Event)=>void){
        document.removeEventListener("eventoSimulacion", cb);
        console.log("event listener removed")
    }
}