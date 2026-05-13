
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

    constructor(obj : Partial<EventoVuelo>){
        super()
        Object.assign(this,obj);
    }
}

export class SimulationEvent extends CustomEvent<EventoBatch>{
    public event!:Evento[];
    public horaActual!:Date;
    constructor(obj:EventoBatch) {
        super("eventoSimulacion",{detail:obj});
        this.event = obj.eventos;
        this.horaActual = obj.ventanaFin;
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