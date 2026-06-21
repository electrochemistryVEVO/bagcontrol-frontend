import {Envio, EnvioAeropuerto} from './Envio';
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
  enviosProximosAVencer?: EnvioAeropuerto[];
  // true recien cuando llega el primer evento AEROPUERTO_ACTUALIZADO con datos reales.
  // Mientras sea false/undefined, el icono del mapa se muestra en blanco (sin semaforo).
  tieneDatos?: boolean;
}