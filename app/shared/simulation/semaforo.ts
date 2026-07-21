import type { AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import type { EstadoCapacidad, EventoVuelo } from '@/app/shared/types/Evento';

export function calcularOcupacionAeropuerto(aeropuerto: AeropuertoSimulacion) {
  if (typeof aeropuerto.porcentajeOcupacion === 'number') {
    return Math.round(aeropuerto.porcentajeOcupacion);
  }
  if (!aeropuerto.capacidadAlmacen) return 0;
  return Math.round((aeropuerto.maletasActuales / aeropuerto.capacidadAlmacen) * 100);
}

export function calcularOcupacionVuelo(cantidadMaletas: number, capacidadMax: number) {
  if (!capacidadMax) return 0;
  return Math.round((cantidadMaletas / capacidadMax) * 100);
}

export function esAeropuertoVacio(aeropuerto: AeropuertoSimulacion) {
  return Number(aeropuerto.maletasActuales ?? 0) <= 0;
}

export function esVueloVacio(vuelo: Pick<EventoVuelo, 'cantidadMaletas' | 'capacidadMax'>) {
  return (vuelo.cantidadMaletas ?? 0) === 0 || calcularOcupacionVuelo(vuelo.cantidadMaletas, vuelo.capacidadMax) === 0;
}

export function calcularEstadoCapacidadAeropuerto(
  aeropuerto: Pick<AeropuertoSimulacion, 'maletasActuales' | 'capacidadAlmacen' | 'porcentajeOcupacion'>,
): EstadoCapacidad {
  if (Number(aeropuerto.maletasActuales ?? 0) <= 0) return 'VACIO';
  const ocupacion = calcularOcupacionAeropuerto(aeropuerto as AeropuertoSimulacion);
  if (ocupacion >= 85) return 'ROJO';
  if (ocupacion >= 60) return 'AMARILLO';
  return 'VERDE';
}

export function obtenerEstadoAeropuerto(aeropuerto: AeropuertoSimulacion): EstadoCapacidad {
  if (esAeropuertoVacio(aeropuerto)) return 'VACIO';
  if (aeropuerto.estadoCapacidad === 'VACIO') {
    const estadoCorregido = calcularEstadoCapacidadAeropuerto(aeropuerto);
    console.warn('[AIRPORT-FRONT-INCONSISTENCY]', {
      iata: aeropuerto.codigoIata,
      ocupacion: aeropuerto.maletasActuales,
      capacidad: aeropuerto.capacidadAlmacen,
      estadoRecibido: aeropuerto.estadoCapacidad,
      estadoMostrado: estadoCorregido,
    });
    return estadoCorregido;
  }
  return aeropuerto.estadoCapacidad;
}

export function obtenerEstadoPorOcupacion(ocupacion: number): EstadoCapacidad {
  if (ocupacion <= 0) return 'VACIO';
  if (ocupacion < 33) return 'VERDE';
  if (ocupacion <= 66) return 'AMARILLO';
  return 'ROJO';
}

export function obtenerEstadoVuelo(vuelo: EventoVuelo): EstadoCapacidad {
  if (esVueloVacio(vuelo)) return 'VACIO';
  return vuelo.estado || obtenerEstadoPorOcupacion(calcularOcupacionVuelo(vuelo.cantidadMaletas, vuelo.capacidadMax));
}
