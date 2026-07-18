import type { LineLayerSpecification, SymbolLayerSpecification, StyleSpecification } from 'maplibre-gl';

export const COLOR_POR_ESTADO: Record<string, string> = {
  ROJO: '#ef4444',
  AMARILLO: '#eab308',
  VERDE: '#22c55e',
  VACIO: '#6B7280',
};

// Estilo VACÍO para el mapa de primer plano (solo capas de datos).
// El basemap visual lo provee backgroundMapRef. Así 'load' dispara casi
// al instante y los aeropuertos aparecen sin esperar tiles.
export const EMPTY_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [],
};

// Punto de partida de ambos mapas. Ajusta `zoom` para acercar o alejar
// la vista inicial sin tener que modificar el componente.
export const INITIAL_MAP_VIEW = {
  longitude: 0,
  latitude: 10,
  zoom: 2.2,
} as const;

// Aeropuertos — ícono con BORDE NEGRO fijo + RELLENO interior coloreado
// según estadoCapacidad. Antes de recibir datos reales se muestra 'airport-default'
// (borde negro, interior blanco).
// SIN text-field para evitar dependencia de glifos externos (404 en openfreemap).
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
      'airport-default'   // blanco/negro hasta que lleguen datos reales
    ],
    // PNG es 256×256 → queremos ~40px en pantalla → 40/256 ≈ 0.156
    // Subimos a 0.24 para que se vea más grande en el mapa mundial
    'icon-size': 0.17,
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
    'icon-size': 0.048,
  }
};
