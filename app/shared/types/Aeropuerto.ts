export type Aeropuerto= {
  id: number;
  nombre: string;
  codigoIata: string;
  latitud: number;
  longitud: number;
  cantidadAlmacen: number;
  capacidadAlmacen: number;
};

//Usado en la simulación del mapa
export type AeropuertoSimulacion = Aeropuerto & {
  cantidadAlmacen: number;
};