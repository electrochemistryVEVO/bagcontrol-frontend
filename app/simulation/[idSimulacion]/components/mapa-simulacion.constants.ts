import type { LineLayerSpecification, SymbolLayerSpecification, StyleSpecification } from 'maplibre-gl';

export const COLOR_POR_ESTADO: Record<string, string> = {
  ROJO: '#ef4444',
  AMARILLO: '#eab308',
  VERDE: '#22c55e',
  VACIO: '#6B7280',
};

// Estilo VACÍO (sin sources, sin tiles, sin red) para el mapa de PRIMER PLANO
// (mapRef), que solo aloja nuestras capas de datos (aeropuertos, aviones, rutas).
// El basemap visual ya lo provee el mapa de FONDO (backgroundMapRef) con
// MAP_STYLE_URL. Antes ambos mapas cargaban el mismo estilo vectorial pesado
// (OpenFreeMap "bright": tiles + sprites + glifos), así que el evento 'load'
// del mapa de datos —del que depende todo lo demás— no disparaba hasta que
// ese basemap completo terminara de bajar. Con un estilo vacío, 'load' dispara
// casi al instante y los aeropuertos aparecen de inmediato, sin esperar tiles.
export const EMPTY_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [],
};

// Aeropuertos — ícono coloreado por estadoCapacidad, pero SOLO cuando ya llegaron
// datos reales (tieneDatos). Antes de eso se muestra el ícono en blanco (sin semaforo).
// SIN text-field para evitar dependencia de glifos externos que fallan con 404.
// Los códigos IATA se ven en el popup al hacer hover.
export const layerStyleAeropuertos: SymbolLayerSpecification = {
  id: 'point',
  type: 'symbol',
  source: 'aeropuertos-data',
  paint: { 'icon-opacity': 1 },
  layout: {
    'icon-image': [
      'match',
      ['get', 'estadoCapacidad'],
      'ROJO',     'airport-rojo',
      'AMARILLO', 'airport-amarillo',
      'VERDE',    'airport-verde',
      'VACIO',    'airport-vacio',
      'airport-default'
    ],
    'icon-size': 0.156,
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
};

export const layerStyleLine: LineLayerSpecification = {
  id: 'routes',
  type: 'line',
  source: 'rutas-data',
  paint: {
    'line-color': [
      'match', ['get', 'estado'],
      'ROJO', '#ef4444', 'AMARILLO', '#eab308', 'VERDE', '#22c55e',
      '#007cbf'
    ],
    'line-width': 2,
    'line-opacity': 0.6,
    'line-dasharray': [2, 2]
  }
};

export const layerStyleRutaEnvio: LineLayerSpecification = {
  id: 'envio-ruta',
  type: 'line',
  source: 'envio-ruta-data',
  paint: { 'line-color': '#2563eb', 'line-width': 4, 'line-opacity': 0.9 }
};

export const layerStyleAirplane: SymbolLayerSpecification = {
  id: 'plane',
  type: 'symbol',
  source: 'aviones-data',
  paint: { 'icon-opacity': 1 },
  layout: {
    'icon-image': [
      'match', ['get', 'iconColor'],
      'ROJO',     'airplane-rojo',
      'AMARILLO', 'airplane-amarillo',
      'VERDE',    'airplane-verde',
      'airplane-gris'
    ],
    'icon-rotate': ['get', 'bearing'],
    'icon-rotation-alignment': 'map',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'icon-size': 0.056,
  }
};
