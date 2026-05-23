export type Aeropuerto= {
  id: number;
  nombre: string;
  codigoIata: string;
  latitud: number;
  longitud: number;
  gmt : number;
  cantidadAlmacen: number;
  capacidadAlmacen: number;
  ciudad : string;
  pais : string;
  continente : string;
};

//Usado en la simulación del mapa
export type AeropuertoSimulacion = Aeropuerto & {
  cantidadAlmacen: number;
};