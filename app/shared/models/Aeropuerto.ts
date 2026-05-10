export class Aeropuerto{
    public codigoIata !: string;
    public ciudad !: string;
    public pais !: string;
    public continente !: string;
    public gmt !: number;
    public capacidadAlmacen !: number;
    public latitud !: number;
    public longitud !: number;

    constructor(obj : Partial<Aeropuerto>) {
        Object.assign(this,obj)
    }
}