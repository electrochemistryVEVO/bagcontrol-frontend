'use client';

import {
  Map as MapLibre,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Popup,
  PopupInstance,
  Source,
  Layer,
  LineLayerSpecification,
  MapRef,
  SymbolLayerSpecification,
} from '@vis.gl/react-maplibre';
import { useMemo, useRef, useState, useEffect, RefObject, useCallback } from 'react';
import {Feature, FeatureCollection} from 'geojson';
import { MapLibreEvent } from 'maplibre-gl';
import type { GeoJSONSource, StyleSpecification } from 'maplibre-gl';
// @ts-ignore
import * as syncMaps from '@mapbox/mapbox-gl-sync-move';
import 'maplibre-gl/dist/maplibre-gl.css';

import { AeropuertoSimulacion, Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { EventoVuelo } from "@/app/shared/types/Evento";
import { Envio, EnvioRuta } from '@/app/shared/types/Envio';
import { SimulacionService } from '@/app/services/simulation.service';
import { MAP_STYLE_URL } from '@/app/services/config/constants';
import { AeropuertoPopupContent } from './pop-up-aeropuerto';
import { RelojSimulacionOverlay } from './reloj-simulacion';
import { PanelVuelos } from './panel-vuelos';
import { PanelAeropuertos } from './panel-aeropuertos';
import AvionSidePanel from "@/app/simulation/components/avion-sidepanel";
import AeropuertoSidePanel from "@/app/simulation/components/aeropuerto-sidepanel";
import { Drawer } from "@mui/material";
import { PanelEnvios } from "@/app/simulation/[idSimulacion]/components/panel-envios";

// ============================================================================
// ESTILOS DE CAPAS
// ============================================================================
const COLOR_POR_ESTADO: Record<string, string> = {
  ROJO: '#ef4444',
  AMARILLO: '#eab308',
  VERDE: '#22c55e',
};

// Estilo VACÍO (sin sources, sin tiles, sin red) para el mapa de PRIMER PLANO
// (mapRef), que solo aloja nuestras capas de datos (aeropuertos, aviones, rutas).
// El basemap visual ya lo provee el mapa de FONDO (backgroundMapRef) con
// MAP_STYLE_URL. Antes ambos mapas cargaban el mismo estilo vectorial pesado
// (OpenFreeMap "bright": tiles + sprites + glifos), así que el evento 'load'
// del mapa de datos —del que depende todo lo demás— no disparaba hasta que
// ese basemap completo terminara de bajar. Con un estilo vacío, 'load' dispara
// casi al instante y los aeropuertos aparecen de inmediato, sin esperar tiles.
const EMPTY_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [],
};

// Aeropuertos — ícono coloreado por estadoCapacidad, pero SOLO cuando ya llegaron
// datos reales (tieneDatos). Antes de eso se muestra el ícono en blanco (sin semaforo).
// SIN text-field para evitar dependencia de glifos externos que fallan con 404.
// Los códigos IATA se ven en el popup al hacer hover.
const layerStyleAeropuertos: SymbolLayerSpecification = {
  id: 'point',
  type: 'symbol',
  source: 'aeropuertos-data',
  paint: { 'icon-opacity': 1 },
  layout: {
    'icon-image': [
      'case',
      ['==', ['get', 'tieneDatos'], true],
      [
        'match',
        ['get', 'estadoCapacidad'],
        'ROJO',     'airport-rojo',
        'AMARILLO', 'airport-amarillo',
        'VERDE',    'airport-verde',
        'airport-default'
      ],
      'airport-default'   // blanco hasta que lleguen datos reales del aeropuerto
    ],
    'icon-size': 0.156,
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
};

const layerStyleLine: LineLayerSpecification = {
  id: 'routes',
  type: 'line',
  source: 'rutas-data',
  paint: {
    "line-color": [
      'match', ['get', 'estado'],
      'ROJO', '#ef4444', 'AMARILLO', '#eab308', 'VERDE', '#22c55e',
      '#007cbf'
    ],
    "line-width": 2,
    "line-opacity": 0.6,
    "line-dasharray": [2, 2]
  }
};

const layerStyleRutaEnvio: LineLayerSpecification = {
  id: 'envio-ruta',
  type: 'line',
  source: 'envio-ruta-data',
  paint: { 'line-color': '#2563eb', 'line-width': 4, 'line-opacity': 0.9 }
};

const layerStyleAirplane: SymbolLayerSpecification = {
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

// ============================================================================
// Carga un PNG con fondo transparente y genera N versiones coloreadas
// vía canvas source-in. NO usa sdf:true para evitar el halo de color.
// Se usa para los aviones, donde el ícono completo cambia de color.
// ============================================================================
async function cargarIconosColoreados(
  map: maplibregl.Map,
  urlPng: string,
  prefijo: string,
  colores: Record<string, string>
) {
  const img = await map.loadImage(urlPng);
  const fuente = img.data as CanvasImageSource;
  const ancho = (fuente as any).width ?? 128;
  const alto  = (fuente as any).height ?? 128;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width  = ancho;
  maskCanvas.height = alto;
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })!;
  maskCtx.drawImage(fuente, 0, 0, ancho, alto);
  const maskData = maskCtx.getImageData(0, 0, ancho, alto);
  // Binarizar alpha: elimina píxeles semitransparentes del antialiasing
  for (let i = 3; i < maskData.data.length; i += 4) {
    maskData.data[i] = maskData.data[i] >= 110 ? 255 : 0;
  }

  for (const [sufijo, colorHex] of Object.entries(colores)) {
    const nombre = `${prefijo}-${sufijo}`;
    if (map.hasImage(nombre)) continue;
    const c = document.createElement('canvas');
    c.width  = ancho;
    c.height = alto;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(maskData, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, ancho, alto);
    map.addImage(nombre, ctx.getImageData(0, 0, ancho, alto));
  }
}

// ============================================================================
// Carga el ícono de AEROPUERTO con BORDE NEGRO FIJO y RELLENO interior
// coloreado por estado. A diferencia de cargarIconosColoreados (que tiñe todo
// el ícono, líneas incluidas), acá el contorno del PNG original nunca cambia
// de color: solo se pinta el área encerrada por esas líneas (el semáforo).
//
// Algoritmo: 1) binariza el alpha del PNG para detectar los píxeles de línea.
// 2) flood-fill desde los bordes del canvas para marcar el "exterior" (fondo).
// 3) lo que no es línea ni exterior es el "interior" encerrado por el dibujo,
//    y es lo único que se rellena con el color del estado.
// ============================================================================
async function cargarIconosAeropuerto(
  map: maplibregl.Map,
  urlPng: string,
  prefijo: string,
  colores: Record<string, string>
) {
  const img = await map.loadImage(urlPng);
  const fuente = img.data as CanvasImageSource;
  const ancho = (fuente as any).width ?? 128;
  const alto  = (fuente as any).height ?? 128;

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width  = ancho;
  baseCanvas.height = alto;
  const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true })!;
  baseCtx.drawImage(fuente, 0, 0, ancho, alto);
  const baseData = baseCtx.getImageData(0, 0, ancho, alto);

  const total = ancho * alto;
  // Píxeles de línea (contorno) del ícono original, según el alpha binarizado
  const esLinea = new Uint8Array(total);
  for (let i = 0, p = 0; i < baseData.data.length; i += 4, p++) {
    esLinea[p] = baseData.data[i + 3] >= 110 ? 1 : 0;
  }

  // Flood-fill desde los bordes del canvas: todo lo alcanzable sin cruzar una
  // línea es "exterior" (fondo del ícono). Lo que sobra (ni línea ni exterior)
  // es el "interior" encerrado por el contorno, que es lo que se colorea.
  const esExterior = new Uint8Array(total);
  const pila: number[] = [];
  const apilar = (idx: number) => {
    if (!esLinea[idx] && !esExterior[idx]) { esExterior[idx] = 1; pila.push(idx); }
  };
  for (let x = 0; x < ancho; x++) { apilar(x); apilar((alto - 1) * ancho + x); }
  for (let y = 0; y < alto; y++) { apilar(y * ancho); apilar(y * ancho + (ancho - 1)); }
  while (pila.length) {
    const idx = pila.pop()!;
    const x = idx % ancho;
    const y = (idx / ancho) | 0;
    if (x > 0) apilar(idx - 1);
    if (x < ancho - 1) apilar(idx + 1);
    if (y > 0) apilar(idx - ancho);
    if (y < alto - 1) apilar(idx + ancho);
  }

  for (const [sufijo, colorHex] of Object.entries(colores)) {
    const nombre = `${prefijo}-${sufijo}`;
    if (map.hasImage(nombre)) continue;

    const r = parseInt(colorHex.slice(1, 3), 16);
    const g = parseInt(colorHex.slice(3, 5), 16);
    const b = parseInt(colorHex.slice(5, 7), 16);

    const salida = new ImageData(ancho, alto);
    for (let i = 0, p = 0; i < salida.data.length; i += 4, p++) {
      if (esLinea[p]) {
        // Borde: siempre negro, fijo, sin importar el estado
        salida.data[i] = 0; salida.data[i + 1] = 0; salida.data[i + 2] = 0; salida.data[i + 3] = 255;
      } else if (!esExterior[p]) {
        // Interior encerrado por el contorno: coloreado según el estado
        salida.data[i] = r; salida.data[i + 1] = g; salida.data[i + 2] = b; salida.data[i + 3] = 255;
      }
      // Exterior: queda transparente (alpha 0, valor por defecto de ImageData)
    }
    map.addImage(nombre, salida);
  }
}

// ============================================================================
// Helpers
// ============================================================================
function normalizarAeropuertoInicial(aeropuerto: Aeropuerto): AeropuertoSimulacion {
  return { ...aeropuerto, maletasActuales: 0, porcentajeOcupacion: 0, estadoCapacidad: 'VERDE', enviosProximosAVencer: [], tieneDatos: false };
}

function crearFeatureAeropuerto(airport: AeropuertoSimulacion): Feature {
  return {
    type: 'Feature',
    properties: { ...airport, isAirport: true },
    geometry: { type: 'Point', coordinates: [airport.longitud, airport.latitud] },
  };
}

function interpolar(inicio: number[], fin: number[], progreso: number) {
  return [inicio[0] + (fin[0] - inicio[0]) * progreso, inicio[1] + (fin[1] - inicio[1]) * progreso];
}

function calcularBearing(inicio: number[], fin: number[]) {
  return 90 - Math.atan2(fin[1] - inicio[1], fin[0] - inicio[0]) * (180 / Math.PI);
}

function obtenerCoordenadasFeature(feature: MapGeoJSONFeature | null): [number, number] | null {
  if (!feature || feature.geometry.type !== 'Point') return null;
  return [feature.geometry.coordinates[0] as number, feature.geometry.coordinates[1] as number];
}

// ============================================================================
// TIPOS
// ============================================================================
interface Props {
  aeropuertosIniciales: Aeropuerto[];
  aeropuertosRef: RefObject<Record<string, AeropuertoSimulacion>>;
  vuelosActivosRef: RefObject<Map<string, EventoVuelo>>;
  tiempoSimulacionRef: RefObject<number>;
  enviosPlanificadosRef: RefObject<Record<string, Envio>>;
  idSimulacion: string;
  conectado: boolean;
}

type VueloAnimado = EventoVuelo & { _salidaEpoch?: number; _llegadaEpoch?: number };

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export function MapaSimulacion({ aeropuertosIniciales, aeropuertosRef, vuelosActivosRef, enviosPlanificadosRef, tiempoSimulacionRef, idSimulacion, conectado }: Props) {

  const mapRef = useRef<MapRef>(null);
  const backgroundMapRef = useRef<MapRef>(null);
  const popupRef = useRef<PopupInstance | null>(null);

  // Evita registrar la sincronización de cámara más de una vez (p. ej. si el
  // componente vuelve a renderizar antes de que se desmonte el cleanup anterior).
  const syncRegistradoRef = useRef(false);

  const [showPopup, setShowPopup]   = useState(false);
  const [selFeature, setSelFeature] = useState<MapGeoJSONFeature | null>(null);

  // Antes había un único flag iconosListos que esperaba a AMBOS íconos (avión +
  // aeropuerto) antes de mostrar cualquiera de las dos capas. Eso hacía que los
  // aeropuertos (que ya tienen toda su info disponible desde el inicio) se vieran
  // recien cuando tambien terminaba de cargar el ícono de avión. Ahora cada uno
  // tiene su propio flag y se cargan en paralelo, sin bloquearse entre sí.
  const [iconosAeropuertoListos, setIconosAeropuertoListos] = useState(false);
  const [iconosAvionListos, setIconosAvionListos]           = useState(false);

  // Flag que indica que AMBAS instancias de mapa (datos + fondo) ya existen
  // como objetos maplibregl.Map, montadas en el DOM. Ya NO se espera a que
  // disparen 'load' ni a que terminen de bajar tiles/sprites/glifos: ese era
  // justo el cuello de botella que dejaba el mapa "trabado" para pan/zoom
  // hasta que llegaba el primer evento de WebSocket y forzaba un re-render.
  // Apenas ambas refs existen, se sincroniza cámara y el usuario puede
  // navegar de inmediato sobre el mapa de datos (mapRef), reflejándose en
  // tiempo real sobre el mapa de fondo (backgroundMapRef).
  const [mapasMontados, setMapasMontados] = useState(false);

  const [vuelosActivosSnapshot, setVuelosActivosSnapshot] = useState<EventoVuelo[]>([]);
  const [enviosSnapshot, setEnviosSnapshot]               = useState<Envio[]>([]);
  const [aeropuertosSnapshot, setAeropuertosSnapshot]     = useState<AeropuertoSimulacion[]>(() =>
    aeropuertosIniciales.map(normalizarAeropuertoInicial)
  );

  const [panelOpen, setPanelOpen]         = useState(false);
  const [selFlight, setSelFlight]         = useState<MapGeoJSONFeature | null>(null);
  const [airportPanelOpen, setAirportPanelOpen] = useState(false);
  const [selAirport, setSelAirport]       = useState<MapGeoJSONFeature | null>(null);
  const [idEnvioBusqueda, setIdEnvioBusqueda]   = useState('');
  const [rutaEnvio, setRutaEnvio]         = useState<EnvioRuta | null>(null);
  const [rutaError, setRutaError]         = useState<string | null>(null);

  const coordsAeropuertos = useMemo(() => {
    const dict: Record<string, number[]> = {};
    aeropuertosIniciales.forEach(a => { dict[a.codigoIata] = [a.longitud, a.latitud]; });
    return dict;
  }, [aeropuertosIniciales]);

  const featuresAeropuertosIniciales = useMemo<Feature[]>(
    () => aeropuertosIniciales.map(normalizarAeropuertoInicial).map(crearFeatureAeropuerto),
    [aeropuertosIniciales]
  );

  const enfocarCoordenadas = useCallback((coords: [number, number], zoom = 6) => {
    mapRef.current?.getMap().flyTo({ center: coords, zoom, duration: 700, essential: true });
  }, []);

  const enfocarAeropuerto = useCallback((codigoIata: string) => {
    const coords = coordsAeropuertos[codigoIata];
    if (coords) enfocarCoordenadas([coords[0], coords[1]], 6.5);
  }, [coordsAeropuertos, enfocarCoordenadas]);

  const enfocarVueloSeleccionado = useCallback(() => {
    const coords = obtenerCoordenadasFeature(selFlight);
    if (coords) enfocarCoordenadas(coords, 6.5);
  }, [enfocarCoordenadas, selFlight]);

  const enfocarVueloPorCodigo = useCallback((codigoVuelo: string | number) => {
    const vuelo = vuelosActivosRef.current.get(String(codigoVuelo));
    if (!vuelo) return;
    const o = coordsAeropuertos[vuelo.origenIata];
    const d = coordsAeropuertos[vuelo.destinoIata];
    if (!o || !d) return;
    const v = vuelo as VueloAnimado;
    const ini = v._salidaEpoch  ?? Date.parse(vuelo.horaSalidaUtc);
    const fin = v._llegadaEpoch ?? Date.parse(vuelo.horaLlegadaUtc);
    let p = (fin - ini) > 0 ? (tiempoSimulacionRef.current - ini) / (fin - ini) : 1;
    p = Math.max(0, Math.min(1, p));
    const pos = interpolar(o, d, p);
    enfocarCoordenadas([pos[0], pos[1]], 6.5);
  }, [coordsAeropuertos, enfocarCoordenadas, tiempoSimulacionRef, vuelosActivosRef]);


  const mostrarRutaEnvio = useCallback(async (idPedido: string) => {
    const idNormalizado = idPedido.trim();
    if (!idNormalizado) return;  
    const id = idPedido.trim();
    if (!id) return;
    try {
      setRutaError(null);
      const ts = new Date(tiempoSimulacionRef.current).toISOString();
      const { data } = await SimulacionService.obtenerRutaEnvio(idSimulacion, id, ts);
      setRutaEnvio(data);
      setIdEnvioBusqueda(id);
    } catch {
      setRutaEnvio(null);
      setRutaError(`No se encontró ruta para el envío ${idNormalizado}`);
    }
  }, [idSimulacion, tiempoSimulacionRef]);

  const featuresRutaEnvio = useMemo<Feature[]>(() => {
    if (!rutaEnvio) return [];
    return rutaEnvio.escalas.map((escala, i): Feature | null => {
      const o = coordsAeropuertos[escala.origenIata];
      const d = coordsAeropuertos[escala.destinoIata];
      if (!o || !d) return null;
      return { type: 'Feature', properties: { index: i + 1, codigoVuelo: String(escala.codigoVuelo), origenIata: escala.origenIata, destinoIata: escala.destinoIata }, geometry: { type: 'LineString', coordinates: [o, d] } };
    }).filter((f): f is Feature => f !== null);
  }, [coordsAeropuertos, rutaEnvio]);

  const seleccionarVuelo = useCallback(async (codigoVuelo : string)=>{
    const map = mapRef.current?.getMap();
    if(!map)return;
    const sourceAviones = map.getSource('aviones-data') as GeoJSONSource;
    const feature = ((await sourceAviones.getData()) as FeatureCollection).features.find(e=>e.properties?.codigoVuelo === codigoVuelo) as MapGeoJSONFeature;
    console.log(feature)
    setSelFlight(feature ?? null);
    setPanelOpen(true);
    const coords = obtenerCoordenadasFeature(feature ?? null);
    if (coords) enfocarCoordenadas(coords, 6.5);
  },[featuresRutaEnvio,enfocarCoordenadas])

  const enfocarRutaEnvio = useCallback(() => {
    const coords = featuresRutaEnvio.flatMap(f => f.geometry.type === 'LineString' ? (f.geometry.coordinates as [number, number][]) : []);
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (coords.length === 0 && rutaEnvio?.aeropuertoActual) { enfocarAeropuerto(rutaEnvio.aeropuertoActual); return; }
    if (coords.length === 0) return;
    const lngs = coords.map(([lng]) => lng);
    const lats  = coords.map(([, lat]) => lat);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 90, duration: 700, maxZoom: 6.5 });
  }, [enfocarAeropuerto, featuresRutaEnvio, rutaEnvio]);

  useEffect(() => { if (rutaEnvio) enfocarRutaEnvio(); }, [enfocarRutaEnvio, rutaEnvio]);

  useEffect(() => {
    if (!conectado) return;
    const timer = setInterval(() => {
      setVuelosActivosSnapshot(Array.from(vuelosActivosRef.current.values()));
      setAeropuertosSnapshot(Object.values(aeropuertosRef.current || {}));
      setEnviosSnapshot(Object.values(enviosPlanificadosRef.current || {}));
    }, 500);
    return () => clearInterval(timer);
  }, [aeropuertosRef, conectado, enviosPlanificadosRef, vuelosActivosRef]);

  const ocupacionPromedioFlota = useMemo(() => {
    if (vuelosActivosSnapshot.length === 0) return 0;
    return vuelosActivosSnapshot.reduce((acc, v) => acc + (v.capacidadMax ? (v.cantidadMaletas / v.capacidadMax) * 100 : 0), 0) / vuelosActivosSnapshot.length;
  }, [vuelosActivosSnapshot]);

  // ============================================================================
  // MOTOR GRÁFICO
  // ============================================================================
  useEffect(() => {
    let rafId: number;
    let frame = 0;

    const animar = () => {
      const map = mapRef.current?.getMap();
      if (!map || !map.isStyleLoaded()) { rafId = requestAnimationFrame(animar); return; }

      const t = tiempoSimulacionRef.current;
      const featuresAviones: Feature[] = [];
      const featuresRutas: Feature[]   = [];

      vuelosActivosRef.current.forEach((vuelo) => {
        const o = coordsAeropuertos[vuelo.origenIata];
        const d = coordsAeropuertos[vuelo.destinoIata];
        if (!o || !d) return;
        const v = vuelo as VueloAnimado;
        const ini = v._salidaEpoch  ?? Date.parse(vuelo.horaSalidaUtc);
        const fin = v._llegadaEpoch ?? Date.parse(vuelo.horaLlegadaUtc);
        if (!Number.isFinite(ini) || !Number.isFinite(fin)) return;
        let p = (fin - ini) > 0 ? (t - ini) / (fin - ini) : 1;
        p = Math.max(0, Math.min(1, p));
        const pos = interpolar(o, d, p);
        const bearing = calcularBearing(o, d);
        featuresAviones.push({ type: 'Feature', properties: { ...vuelo, codigoVuelo: String(vuelo.codigoVuelo), bearing, color: COLOR_POR_ESTADO[vuelo.estado] ?? '#ffffff', iconColor: vuelo.cantidadMaletas === 0 ? 'GRIS' : (vuelo.estado ?? 'VERDE'), isAirplane: true }, geometry: { type: 'Point', coordinates: pos } });
        if (p < 0.999) featuresRutas.push({ type: 'Feature', properties: { estado: vuelo.estado }, geometry: { type: 'LineString', coordinates: [pos, d] } });
      });

      (map.getSource('aviones-data') as GeoJSONSource)?.setData({ type: 'FeatureCollection', features: featuresAviones });
      (map.getSource('rutas-data')   as GeoJSONSource)?.setData({ type: 'FeatureCollection', features: featuresRutas });

      if (++frame % 30 === 0) {
        const feats: Feature[] = Object.values(aeropuertosRef.current || {}).map(crearFeatureAeropuerto);
        (map.getSource('aeropuertos-data') as GeoJSONSource)?.setData({ type: 'FeatureCollection', features: feats });
      }

      rafId = requestAnimationFrame(animar);
    };

    animar();
    return () => cancelAnimationFrame(rafId);
  }, [aeropuertosRef, coordsAeropuertos, tiempoSimulacionRef, vuelosActivosRef]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) return;
    (map.getSource('envio-ruta-data') as GeoJSONSource)?.setData({ type: 'FeatureCollection', features: featuresRutaEnvio });
  }, [featuresRutaEnvio]);

  // ============================================================================
  // SINCRONIZACIÓN DE CÁMARA (mapa de datos <-> mapa de fondo)
  //
  // Antes esto esperaba a 'mapaListo' y 'backgroundLoaded', dos flags que se
  // seteaban en el callback 'load' de CADA mapa — y 'load' en el mapa de fondo
  // no dispara hasta terminar de bajar el estilo vectorial completo (tiles,
  // sprites, glifos). Resultado: el pan/zoom del usuario sobre el mapa de
  // datos no se reflejaba visualmente en el fondo hasta que ese basemap
  // terminaba de cargar, y se sentía "trabado".
  //
  // Ahora: ambas refs (mapRef, backgroundMapRef) ya apuntan a una instancia
  // de maplibregl.Map apenas el componente <MapLibre> se monta en el DOM —
  // no hay que esperar ningún evento de red. Este effect hace polling liviano
  // (intervalo corto) hasta detectar que ambas instancias existen, y ahí
  // mismo registra la sincronización, sin depender de 'load' de ninguno.
  // ============================================================================
  useEffect(() => {
    if (syncRegistradoRef.current) return;

    const intervalo = setInterval(() => {
      const mapaDatos = mapRef.current?.getMap();
      const mapaFondo = backgroundMapRef.current?.getMap();
      if (mapaDatos && mapaFondo && !syncRegistradoRef.current) {
        syncMaps(mapaDatos, mapaFondo);
        syncRegistradoRef.current = true;
        setMapasMontados(true);
        clearInterval(intervalo);
      }
    }, 30);

    return () => clearInterval(intervalo);
  }, []);

  // ============================================================================
  // CARGA DE ÍCONOS — el mapa ya esta listo apenas dispara 'load' (estilo vacio).
  // Aeropuertos y aviones se cargan EN PARALELO y cada uno activa su propia capa
  // apenas termina, sin esperarse entre si.
  // ============================================================================
  const handleMapLoad = useCallback((e: MapLibreEvent) => {
    const map = e.target;

    // Aeropuertos: borde negro fijo + relleno interior coloreado por estado.
    // 'default' = relleno blanco, antes de que lleguen datos reales del aeropuerto.
    cargarIconosAeropuerto(map, '/aeropuerto.png', 'airport', {
      verde:    '#22c55e',
      amarillo: '#eab308',
      rojo:     '#ef4444',
      default:  '#ffffff',
    })
      .catch((err) => console.error('Error al cargar íconos de aeropuerto:', err))
      .finally(() => setIconosAeropuertoListos(true));

    // Aviones: 4 colores. Se cargan aparte para no demorar a los aeropuertos.
    cargarIconosColoreados(map, '/avion.png', 'airplane', {
      verde: '#22c55e', amarillo: '#eab308', rojo: '#ef4444', gris: '#94a3b8',
    })
      .catch((err) => console.error('Error al cargar íconos de avión:', err))
      .finally(() => setIconosAvionListos(true));
  }, []);

  const handleMouseEnter = (event: MapLayerMouseEvent) => {
    setSelFeature(event.features?.[0] ?? null);
    setShowPopup(true);
    popupRef.current?.trackPointer();
  };

    function setBackgroundLoaded(arg0: boolean) {
      throw new Error('Function not implemented.');
    }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Drawer open={panelOpen} onClose={() => setPanelOpen(false)}>
        <AvionSidePanel openPanel={panelOpen} selFlight={selFlight} idSimulacion={idSimulacion} aeropuertos={aeropuertosIniciales} tiempoSimulacionRef={tiempoSimulacionRef} onMostrarRutaEnvio={mostrarRutaEnvio} onEnfocarVuelo={enfocarVueloSeleccionado} />
      </Drawer>
      <Drawer open={airportPanelOpen} onClose={() => setAirportPanelOpen(false)}>
        <AeropuertoSidePanel openPanel={airportPanelOpen} selAirport={selAirport} aeropuertosRef={aeropuertosRef} idSimulacion={idSimulacion} tiempoSimulacionRef={tiempoSimulacionRef} onMostrarRutaEnvio={mostrarRutaEnvio} onEnfocarAeropuerto={enfocarAeropuerto} />
      </Drawer>

      <PanelVuelos idSimulacion={idSimulacion} vuelosActivos={vuelosActivosSnapshot} tiempoSimulacionRef={tiempoSimulacionRef} visible={conectado} onEnfocarVuelo={enfocarVueloPorCodigo} />
      <PanelEnvios aeropuertos={aeropuertosSnapshot} envios={enviosSnapshot} visible={conectado} onMostrarRutaEnvio={mostrarRutaEnvio} />
      <PanelAeropuertos aeropuertos={aeropuertosSnapshot} visible={conectado} onEnfocarAeropuerto={enfocarAeropuerto} />

      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        background: 'rgba(15, 23, 42, 0.92)',
        color: '#fff',
        padding: 12,
        borderRadius: 8,
        width: 320,
        boxShadow: '0 8px 20px rgba(0,0,0,0.25)'
      }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mostrarRutaEnvio(idEnvioBusqueda);
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input
            value={idEnvioBusqueda}
            onChange={(e) => setIdEnvioBusqueda(e.target.value)}
            placeholder="ID de envío"
            style={{
              flex: 1,
              borderRadius: 6,
              border: '1px solid #64748b',
              padding: '7px 9px',
              color: '#fff',
              background: '#1e293b',
              outline: 'none'
            }}
          />
          <button type="submit" style={{ border: 'none', borderRadius: 6, padding: '7px 10px', background: '#38bdf8', color: '#0f172a', fontWeight: 700 }}>
            Ruta
          </button>
        </form>
        {rutaError && <div style={{ marginTop: 8, fontSize: 12, color: '#fecaca' }}>{rutaError}</div>}
        {rutaEnvio && (
          <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.45 }}>
            <div style={{ fontWeight: 700 }}>Envio {rutaEnvio.envio.idPedido}</div>
            <div>{rutaEnvio.envio.origenIata} - {rutaEnvio.envio.destinoIata} · {rutaEnvio.envio.cantidadMaletas} maletas</div>
            <div>Estado: {rutaEnvio.estado} · Actual: {rutaEnvio.aeropuertoActual ?? 'No disponible'}</div>
            <div style={{ marginTop: 6, maxHeight: 120, overflowY: 'auto' }}>
              {rutaEnvio.escalas.length === 0 ? <div>Sin itinerario asignado.</div>
                : rutaEnvio.escalas.map((escala, i) => (
                  <div key={`${escala.codigoVuelo}-${i}`}>{i + 1}. Vuelo {escala.codigoVuelo}: {escala.origenIata} - {escala.destinoIata}</div>
                ))}
            </div>
            {rutaEnvio.escalas.length > 0 && featuresRutaEnvio.length === 0 && (
              <div style={{ marginTop: 6, color: '#fde68a' }}>La ruta tiene escalas, pero faltan coordenadas de aeropuerto para pintarla.</div>
            )}
          </div>
        )}
      </div>
      <MapLibre
          ref={backgroundMapRef}
          style={{zIndex:17,position:'absolute'}}
          mapStyle="https://tiles.openfreemap.org/styles/bright"
          onLoad={async (e: MapLibreEvent) => {
            const language = 'es';
            backgroundMapRef.current?.getMap().setLayoutProperty('label_country_1', 'text-field', [
              'get',
              `name:${language}`
            ]);
            backgroundMapRef.current?.getMap().setLayoutProperty('label_country_2', 'text-field', [
              'get',
              `name:${language}`
            ]);
            backgroundMapRef.current?.getMap().setLayoutProperty('label_country_3', 'text-field', [
              'get',
              `name:${language}`
            ]);
            setBackgroundLoaded(true);
          }}
      ></MapLibre>
      <MapLibre
        ref={mapRef}
        style={{ position: 'absolute', zIndex: 18 }}
        initialViewState={{ longitude: -75, latitude: -10, zoom: 4 }}
        mapStyle={EMPTY_MAP_STYLE}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowPopup(false)}
        onMouseDown={(e: MapLayerMouseEvent) => {
          const feature = e.features?.[0];
          const props   = feature?.properties;
          if (!props) return;
          if (props.isAirplane) {
            setSelFlight(feature ?? null); setPanelOpen(true);
            const coords = obtenerCoordenadasFeature(feature ?? null);
            if (coords) enfocarCoordenadas(coords, 6.5);
          } else if (props.isAirport) {
            setSelAirport(feature ?? null); setAirportPanelOpen(true);
            if (typeof props.codigoIata === 'string') enfocarAeropuerto(props.codigoIata);
          }
        }}
        interactiveLayerIds={['point', 'plane']}
        onLoad={handleMapLoad}
      >
        <Source id="rutas-data" type="geojson" data={{ type: 'FeatureCollection', features: [] }}>
          <Layer {...layerStyleLine} />
        </Source>
        <Source id="envio-ruta-data" type="geojson" data={{ type: 'FeatureCollection', features: [] }}>
          <Layer {...layerStyleRutaEnvio} />
        </Source>

        
        {iconosAeropuertoListos && (
          <Source id="aeropuertos-data" type="geojson" data={{ type: 'FeatureCollection', features: featuresAeropuertosIniciales }}>
            <Layer {...layerStyleAeropuertos} />
          </Source>
        )}
        {/* Aviones: se montan aparte, apenas su propio ícono esta listo */}
        {iconosAvionListos && (
          <Source id="aviones-data" type="geojson" data={{ type: 'FeatureCollection', features: [] }}>
            <Layer {...layerStyleAirplane} />
          </Source>
        )}

        {showPopup && selFeature && (
          <Popup
            longitude={selFeature.geometry.type === 'Point' ? (selFeature.geometry.coordinates[0] as number) : 0}
            latitude={selFeature.geometry.type === 'Point' ? (selFeature.geometry.coordinates[1] as number) : 0}
            anchor="bottom" ref={popupRef} closeButton={false} offset={15}
          >
            {selFeature.properties?.isAirport
              ? <AeropuertoPopupContent codigoIata={selFeature.properties.codigoIata} aeropuertosRef={aeropuertosRef} />
              : <div style={{ color: 'black' }}>
                  <b>Vuelo {selFeature.properties?.codigoVuelo}</b>
                  <p>{selFeature.properties?.origenIata} → {selFeature.properties?.destinoIata}</p>
                  <p>{selFeature.properties?.cantidadMaletas} maletas</p>
                </div>
            }
          </Popup>
        )}
      </MapLibre>

      <RelojSimulacionOverlay tiempoRef={tiempoSimulacionRef} ocupacionFlota={ocupacionPromedioFlota} />
    </div>
  );
}
