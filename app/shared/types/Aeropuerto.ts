import { EstadoCapacidad } from './Evento';

export interface Aeropuerto {
  id: number;
  nombre: string;
  codigoIata: string;
  latitud: number;
  longitud: number;
  gmt: number;
  capacidadAlmacen: number; 
  ciudad: string;
  pais: string;
  continente: string;
}
export interface AeropuertoSimulacion extends Aeropuerto {
  maletasActuales: number;
  porcentajeOcupacion: number;
  estadoCapacidad: EstadoCapacidad;
}