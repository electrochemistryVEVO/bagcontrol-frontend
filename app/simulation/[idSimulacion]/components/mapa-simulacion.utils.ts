import type { Feature, FeatureCollection } from 'geojson';
import type { MapGeoJSONFeature } from '@vis.gl/react-maplibre';
import type { Aeropuerto, AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import { obtenerEstadoAeropuerto } from '@/app/shared/simulation/semaforo';

export function normalizarAeropuertoInicial(aeropuerto: Aeropuerto): AeropuertoSimulacion {
  return {
    ...aeropuerto,
    maletasActuales: 0,
    porcentajeOcupacion: 0,
    estadoCapacidad: 'VACIO',
    enviosProximosAVencer: [],
    tieneDatos: false,
  };
}

export function crearFeatureAeropuerto(airport: AeropuertoSimulacion): Feature {
  return {
    type: 'Feature',
    properties: { ...airport, estadoCapacidad: obtenerEstadoAeropuerto(airport), isAirport: true },
    geometry: { type: 'Point', coordinates: [airport.longitud, airport.latitud] },
  };
}

export function crearFeaturesAeropuerto(aeropuertos: Record<string, AeropuertoSimulacion> | undefined): Feature[] {
  return Object.values(aeropuertos || {}).map(crearFeatureAeropuerto);
}

export function crearAeropuertosSimulacionEstables(
  aeropuertosIniciales: Aeropuerto[],
  aeropuertos: Record<string, AeropuertoSimulacion> | undefined
): AeropuertoSimulacion[] {
  const porCodigo: Record<string, AeropuertoSimulacion> = {};
  aeropuertosIniciales.forEach((aeropuerto) => {
    const codigo = aeropuerto.codigoIata?.trim().toUpperCase();
    if (codigo) porCodigo[codigo] = normalizarAeropuertoInicial(aeropuerto);
  });
  Object.values(aeropuertos || {}).forEach((aeropuerto) => {
    const codigo = aeropuerto.codigoIata?.trim().toUpperCase();
    if (codigo) porCodigo[codigo] = aeropuerto;
  });
  return Object.values(porCodigo);
}

export function crearFeaturesAeropuertoEstables(
  aeropuertosIniciales: Aeropuerto[],
  aeropuertos: Record<string, AeropuertoSimulacion> | undefined
): Feature[] {
  return crearAeropuertosSimulacionEstables(aeropuertosIniciales, aeropuertos).map(crearFeatureAeropuerto);
}

export function interpolar(inicio: number[], fin: number[], progreso: number): [number, number] {
  return [
    inicio[0] + (fin[0] - inicio[0]) * progreso,
    inicio[1] + (fin[1] - inicio[1]) * progreso,
  ];
}

export function calcularBearing(inicio: number[], fin: number[]): number {
  return 90 - Math.atan2(fin[1] - inicio[1], fin[0] - inicio[0]) * (180 / Math.PI);
}

export function obtenerCoordenadasFeature(feature: MapGeoJSONFeature | null): [number, number] | null {
  if (!feature || feature.geometry.type !== 'Point') return null;
  return [feature.geometry.coordinates[0] as number, feature.geometry.coordinates[1] as number];
}
