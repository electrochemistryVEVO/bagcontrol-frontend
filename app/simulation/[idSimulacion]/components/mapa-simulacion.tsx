'use client';

import {
  Map as MapLibre,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Popup,
  PopupInstance,
  Source,
  Layer,
  MapRef,
} from '@vis.gl/react-maplibre';
import { useMemo, useRef, useState, useEffect, useCallback, RefObject } from 'react';
import { Feature, FeatureCollection } from 'geojson';
import { MapLibreEvent } from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreNative, LayerSpecification } from 'maplibre-gl';
import Draggable from 'react-draggable';
import 'maplibre-gl/dist/maplibre-gl.css';

import { AeropuertoSimulacion, Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { EventoColapso, EventoReplanificacionEnvio, EventoVuelo } from '@/app/shared/types/Evento';
import { Envio, EnvioRuta } from '@/app/shared/types/Envio';
import { SimulacionService } from '@/app/services/simulation.service';
import { formatUtcDisplay } from '@/app/shared/dateTime';
import { AeropuertoPopupContent } from './pop-up-aeropuerto';
import { RelojSimulacionOverlay } from './reloj-simulacion';
import type { EstadoSimulacion } from '../hooks/useSimulacion';
import { PanelLateral } from './panel-lateral';
import { PanelMetricas } from './panel-metricas';
import AeropuertoSidePanel from '@/app/simulation/components/aeropuerto-sidepanel';
import AvionSidePanel from '@/app/simulation/components/avion-sidepanel';
import { Drawer } from '@mui/material';

import {
  COLOR_POR_ESTADO,
  EMPTY_MAP_STYLE,
  layerStyleAeropuertos,
  layerStyleLine,
  layerStyleRutaEnvio,
  layerStyleAirplane,
} from './mapa-simulacion.constants';
import { cargarIconosColoreados, cargarIconosAeropuerto } from './mapa-simulacion.icons';
import {
  normalizarAeropuertoInicial,
  crearAeropuertosSimulacionEstables,
  crearFeaturesAeropuertoEstables,
  interpolar,
  calcularBearing,
  obtenerCoordenadasFeature,
} from './mapa-simulacion.utils';
import { obtenerEstadoAeropuerto, obtenerEstadoVuelo } from '@/app/shared/simulation/semaforo';

interface Props {
  aeropuertosIniciales: Aeropuerto[];
  aeropuertosRef: RefObject<Record<string, AeropuertoSimulacion>>;
  vuelosActivosRef: RefObject<Map<string, EventoVuelo>>;
  tiempoSimulacionRef: RefObject<number>;
  enviosPlanificadosRef: RefObject<Record<string, Envio>>;
  idSimulacion: string;
  conectado: boolean;
  fechaInicio: string;
  modo?: string;
  colapso?: EventoColapso | null;
  replanificaciones: EventoReplanificacionEnvio[];
  gmtUsuario?: number | null;
  aeropuertoUsuario?: Aeropuerto | null;
  fechaHoraInicioReal?: string | null;
  fechaHoraFinReal?: string | null;
  estadoSim: EstadoSimulacion;
}

type VueloAnimado = EventoVuelo & { _salidaEpoch?: number; _llegadaEpoch?: number };
type FiltroRelacion = {
  vuelos?: Set<string>;
  aeropuertos?: Set<string>;
  envios?: Set<string>;
};

function crearFeatureCollection(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

function actualizarSourceGeoJson(map: MapLibreNative, id: string, data: FeatureCollection) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  source?.setData(data);
}

function asegurarLayer(map: MapLibreNative, layer: LayerSpecification) {
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer);
  }
}

function quitarLayer(map: MapLibreNative, layerId: string) {
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
}

function reordenarCapasDatos(map: MapLibreNative) {
  ['routes', 'envio-ruta', 'replanificacion-ruta-line', 'point', 'plane'].forEach((layerId) => {
    if (map.getLayer(layerId)) map.moveLayer(layerId);
  });
}

function coordenadaValida(coords: number[] | undefined): coords is [number, number] {
  return Array.isArray(coords)
    && coords.length >= 2
    && Number.isFinite(coords[0])
    && Number.isFinite(coords[1]);
}

export function MapaSimulacion({
  aeropuertosIniciales,
  aeropuertosRef,
  vuelosActivosRef,
  enviosPlanificadosRef,
  tiempoSimulacionRef,
  idSimulacion,
  conectado,
  fechaInicio,
  modo,
  colapso,
  replanificaciones,
  gmtUsuario,
  aeropuertoUsuario,
  fechaHoraInicioReal,
  fechaHoraFinReal,
  estadoSim,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const backgroundMapRef = useRef<MapRef>(null);
  const popupRef = useRef<PopupInstance | null>(null);
  const syncRegistradoRef = useRef(false);
  const limpiarSyncRef = useRef<(() => void) | null>(null);
  const mapasAuditadosRef = useRef<Set<string>>(new Set());
  const vuelosConCoordenadasInvalidasRef = useRef<Set<string>>(new Set());
  const ultimoDiagnosticoAeropuertosRef = useRef('');

  const [showPopup, setShowPopup] = useState(false);
  const [selFeature, setSelFeature] = useState<MapGeoJSONFeature | null>(null);

  // Cada ícono (avión / aeropuerto) tiene su propio flag para que las capas se
  // monten en paralelo sin bloquearse entre sí.
  const [iconosAeropuertoListos, setIconosAeropuertoListos] = useState(false);
  const [iconosAvionListos, setIconosAvionListos] = useState(false);

  const [vuelosActivosSnapshot, setVuelosActivosSnapshot] = useState<EventoVuelo[]>([]);
  const [enviosSnapshot, setEnviosSnapshot] = useState<Envio[]>([]);
  const [tiempoSimulacionSnapshot, setTiempoSimulacionSnapshot] = useState(() => Date.parse(fechaInicio));
  const [aeropuertosSnapshot, setAeropuertosSnapshot] = useState<AeropuertoSimulacion[]>(() =>
    aeropuertosIniciales.map(normalizarAeropuertoInicial)
  );

  const [panelOpen, setPanelOpen] = useState(false);
  const [selFlight, setSelFlight] = useState<MapGeoJSONFeature | null>(null);
  const [airportPanelOpen, setAirportPanelOpen] = useState(false);
  const [selAirport, setSelAirport] = useState<MapGeoJSONFeature | null>(null);
  const [idEnvioBusqueda, setIdEnvioBusqueda] = useState('');
  const [rutaEnvio, setRutaEnvio] = useState<EnvioRuta | null>(null);
  const [rutaError, setRutaError] = useState<string | null>(null);
  const [replanificacionSeleccionada, setReplanificacionSeleccionada] = useState<EventoReplanificacionEnvio | null>(null);
  const [filtroRelacion, setFiltroRelacion] = useState<FiltroRelacion>({});

  const coordsAeropuertos = useMemo(() => {
    const dict: Record<string, number[]> = {};
    aeropuertosIniciales.forEach(a => { dict[a.codigoIata] = [a.longitud, a.latitud]; });
    return dict;
  }, [aeropuertosIniciales]);

  // Refs para los filtros de los paneles (sin re-render, leídos por el RAF)
  const filtroAeropuertosRef = useRef<Set<string> | null>(null);
  const filtroVuelosRef = useRef<Set<string> | null>(null);
  const filtroRelacionRef = useRef<FiltroRelacion>({});

  const handleFiltradoAeropuertosCambiado = useCallback((iatas: string[] | null) => {
    filtroAeropuertosRef.current = iatas ? new Set(iatas) : null;
  }, []);

  const handleFiltradoVuelosCambiado = useCallback((codigos: string[] | null) => {
    filtroVuelosRef.current = codigos ? new Set(codigos) : null;
  }, []);

  useEffect(() => {
    filtroRelacionRef.current = filtroRelacion;
  }, [filtroRelacion]);

  const crearFeaturesAeropuertosMapa = useCallback(() => (
    crearFeaturesAeropuertoEstables(aeropuertosIniciales, aeropuertosRef.current)
  ), [aeropuertosIniciales, aeropuertosRef]);

  const featuresAeropuertosIniciales = useMemo<Feature[]>(
    () => crearFeaturesAeropuertoEstables(aeropuertosIniciales, aeropuertosRef.current),
    [aeropuertosIniciales, aeropuertosRef]
  );

  const logDiagnosticoAeropuertos = useCallback((
    map: MapLibreNative,
    features: Feature[],
    motivo: string
  ) => {
    const invalidos = features.filter((feature) => (
      feature.geometry.type !== 'Point'
      || !coordenadaValida(feature.geometry.coordinates as number[])
      || Math.abs((feature.geometry.coordinates as number[])[0]) > 180
      || Math.abs((feature.geometry.coordinates as number[])[1]) > 90
    ));
    const sourceExiste = Boolean(map.getSource('aeropuertos-data'));
    const layerIconoExiste = Boolean(map.getLayer('point'));
    const styleLoaded = map.isStyleLoaded();
    const key = [
      motivo,
      aeropuertosIniciales.length,
      Object.keys(aeropuertosRef.current || {}).length,
      features.length,
      invalidos.length,
      sourceExiste,
      layerIconoExiste,
      styleLoaded,
      iconosAeropuertoListos,
    ].join('|');

    if (ultimoDiagnosticoAeropuertosRef.current === key) return;
    ultimoDiagnosticoAeropuertosRef.current = key;
    console.log('[MAPA-AEROPUERTOS] aeropuertosEstado=', {
      motivo,
      base: aeropuertosIniciales.length,
      estado: Object.keys(aeropuertosRef.current || {}).length,
      iconosAeropuertoListos,
    });
    console.log('[MAPA-AEROPUERTOS] features=', {
      total: features.length,
      invalidos: invalidos.length,
      muestra: features.slice(0, 3).map((feature) => ({
        codigoIata: feature.properties?.codigoIata,
        coordinates: feature.geometry.type === 'Point' ? feature.geometry.coordinates : null,
        estadoCapacidad: feature.properties?.estadoCapacidad,
      })),
    });
    console.log('[MAPA-AEROPUERTOS] sourceExiste=', sourceExiste);
    console.log('[MAPA-AEROPUERTOS] layerExiste=', {
      icono: layerIconoExiste,
    });
    console.log('[MAPA-AEROPUERTOS] styleLoaded=', styleLoaded);
  }, [aeropuertosIniciales, aeropuertosRef, iconosAeropuertoListos]);

  const crearFeaturesVuelosMapa = useCallback(() => {
    const t = tiempoSimulacionRef.current;
    const featuresAviones: Feature[] = [];
    const featuresRutas: Feature[] = [];

    vuelosActivosRef.current.forEach((vuelo) => {
      const codigoVuelo = String(vuelo.codigoVuelo);
      const o = coordsAeropuertos[vuelo.origenIata];
      const d = coordsAeropuertos[vuelo.destinoIata];
      if (!coordenadaValida(o) || !coordenadaValida(d)) {
        if (!vuelosConCoordenadasInvalidasRef.current.has(codigoVuelo)) {
          vuelosConCoordenadasInvalidasRef.current.add(codigoVuelo);
          console.warn('[MAPA-VUELOS] Vuelo omitido por coordenadas invalidas', {
            codigoVuelo,
            origenIata: vuelo.origenIata,
            destinoIata: vuelo.destinoIata,
          });
        }
        return;
      }
      const v = vuelo as VueloAnimado;
      const ini = v._salidaEpoch ?? Date.parse(vuelo.horaSalidaUtc);
      const fin = v._llegadaEpoch ?? Date.parse(vuelo.horaLlegadaUtc);
      if (!Number.isFinite(ini) || !Number.isFinite(fin)) {
        if (!vuelosConCoordenadasInvalidasRef.current.has(codigoVuelo)) {
          vuelosConCoordenadasInvalidasRef.current.add(codigoVuelo);
          console.warn('[MAPA-VUELOS] Vuelo omitido por tiempos invalidos', {
            codigoVuelo,
            horaSalidaUtc: vuelo.horaSalidaUtc,
            horaLlegadaUtc: vuelo.horaLlegadaUtc,
          });
        }
        return;
      }
      let p = (fin - ini) > 0 ? (t - ini) / (fin - ini) : 1;
      p = Math.max(0, Math.min(1, p));
      const pos = interpolar(o, d, p);
      if (!coordenadaValida(pos)) {
        if (!vuelosConCoordenadasInvalidasRef.current.has(codigoVuelo)) {
          vuelosConCoordenadasInvalidasRef.current.add(codigoVuelo);
          console.warn('[MAPA-VUELOS] Vuelo omitido por posicion interpolada invalida', { codigoVuelo });
        }
        return;
      }
      const bearing = calcularBearing(o, d);
      featuresAviones.push({
        type: 'Feature',
        properties: {
          ...vuelo,
          codigoVuelo,
          bearing,
          color: COLOR_POR_ESTADO[vuelo.estado] ?? '#ffffff',
          iconColor: vuelo.cantidadMaletas === 0 ? 'GRIS' : (vuelo.estado ?? 'VERDE'),
          isAirplane: true,
        },
        geometry: { type: 'Point', coordinates: pos },
      });
      if (p < 0.999) {
        featuresRutas.push({
          type: 'Feature',
          properties: { estado: vuelo.estado },
          geometry: { type: 'LineString', coordinates: [pos, d] },
        });
      }
    });

    return { featuresAviones, featuresRutas };
  }, [coordsAeropuertos, tiempoSimulacionRef, vuelosActivosRef]);

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

  const mostrarRutaEnvio = useCallback(async (idPedido: string) => {
    const id = idPedido.trim();
    if (!id) return;
    try {
      setRutaError(null);
      const ts = new Date(tiempoSimulacionRef.current).toISOString();
      const { data } = await SimulacionService.obtenerRutaEnvio(idSimulacion, id, ts);
      setRutaEnvio(data);
      setIdEnvioBusqueda(id);
      const vuelos = new Set(data.escalas.map((escala) => String(escala.codigoVuelo)));
      const aeropuertos = new Set<string>();
      data.escalas.forEach((escala) => {
        aeropuertos.add(escala.origenIata);
        aeropuertos.add(escala.destinoIata);
      });
      if (data.aeropuertoActual) aeropuertos.add(data.aeropuertoActual);
      setFiltroRelacion({ envios: new Set([data.envio.idPedido]), vuelos });
    } catch {
      setRutaEnvio(null);
      setRutaError(`No se encontró ruta para el envío ${id}`);
    }
  }, [idSimulacion, tiempoSimulacionRef]);

  const featuresRutaEnvio = useMemo<Feature[]>(() => {
    if (!rutaEnvio) return [];
    return rutaEnvio.escalas.map((escala, i): Feature | null => {
      const o = coordsAeropuertos[escala.origenIata];
      const d = coordsAeropuertos[escala.destinoIata];
      if (!o || !d) return null;
      return {
        type: 'Feature',
        properties: { index: i + 1, codigoVuelo: String(escala.codigoVuelo), origenIata: escala.origenIata, destinoIata: escala.destinoIata },
        geometry: { type: 'LineString', coordinates: [o, d] },
      };
    }).filter((f): f is Feature => f !== null);
  }, [coordsAeropuertos, rutaEnvio]);

  const seleccionarVuelo = useCallback(async (codigoVuelo: string) => {
    try {
      const crearFeatureDesdeVuelo = (vuelo: EventoVuelo): MapGeoJSONFeature => {
        const o = coordsAeropuertos[vuelo.origenIata];
        const d = coordsAeropuertos[vuelo.destinoIata];
        let coords: [number, number] = o && d ? [o[0], o[1]] : [0, 0];

        if (o && d) {
          const ini = (vuelo as VueloAnimado)._salidaEpoch ?? Date.parse(vuelo.horaSalidaUtc);
          const fin = (vuelo as VueloAnimado)._llegadaEpoch ?? Date.parse(vuelo.horaLlegadaUtc);
          if (Number.isFinite(ini) && Number.isFinite(fin) && fin > ini) {
            const p = Math.max(0, Math.min(1, (tiempoSimulacionRef.current - ini) / (fin - ini)));
            coords = interpolar(o, d, p);
          }
        }

        return ({
          type: 'Feature',
          properties: { ...vuelo, codigoVuelo: String(vuelo.codigoVuelo), isAirplane: true },
          geometry: { type: 'Point', coordinates: coords },
        } as unknown) as MapGeoJSONFeature;
      };

      const map = mapRef.current?.getMap();
      let feature: MapGeoJSONFeature | null = null;

      if (!map) {
        console.warn('[MAPA-VUELOS] Mapa no disponible al seleccionar vuelo', codigoVuelo);
      } else {
        const sourceAviones = map.getSource('aviones-data') as (GeoJSONSource & { getData?: () => Promise<FeatureCollection> | FeatureCollection }) | undefined;
        if (sourceAviones && typeof sourceAviones.getData === 'function') {
          const data = await sourceAviones.getData();
          const featureCollection = data as Partial<FeatureCollection>;
          const features = Array.isArray(featureCollection.features) ? featureCollection.features : [];
          feature = (features.find(e => e.properties?.codigoVuelo === codigoVuelo) as MapGeoJSONFeature | undefined) ?? null;
        }
      }

      const vueloFallback = vuelosActivosRef.current.get(codigoVuelo)
        ?? vuelosActivosSnapshot.find(v => String(v.codigoVuelo) === codigoVuelo);
      if (!feature && vueloFallback) {
        feature = crearFeatureDesdeVuelo(vueloFallback);
      }

      if (!feature) {
        console.warn('[MAPA-VUELOS] Vuelo no encontrado para seleccionar', codigoVuelo);
        return;
      }

      setSelFlight(feature);
      setPanelOpen(true);
      const vueloSeleccionado = feature.properties as EventoVuelo;
      setFiltroRelacion({
        vuelos: new Set([codigoVuelo]),
      });

      const coords = obtenerCoordenadasFeature(feature);
      if (coords && (coords[0] !== 0 || coords[1] !== 0)) enfocarCoordenadas(coords, 6.5);
    } catch (error) {
      console.warn('[MAPA-VUELOS] No se pudo seleccionar vuelo', error);
    }
  }, [coordsAeropuertos, enfocarCoordenadas, tiempoSimulacionRef, vuelosActivosRef, vuelosActivosSnapshot]);

  const enfocarRutaEnvio = useCallback(() => {
    const coords = featuresRutaEnvio.flatMap(f =>
      f.geometry.type === 'LineString' ? (f.geometry.coordinates as [number, number][]) : []
    );
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (coords.length === 0 && rutaEnvio?.aeropuertoActual) {
      enfocarAeropuerto(rutaEnvio.aeropuertoActual);
      return;
    }
    if (coords.length === 0) return;
    const lngs = coords.map(([lng]) => lng);
    const lats = coords.map(([, lat]) => lat);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 90, duration: 700, maxZoom: 6.5 }
    );
  }, [enfocarAeropuerto, featuresRutaEnvio, rutaEnvio]);

  const enfocarReplanificacion = useCallback((replanificacion: EventoReplanificacionEnvio) => {
    setReplanificacionSeleccionada(replanificacion);
    const origen = coordsAeropuertos[replanificacion.origenIata];
    const destino = coordsAeropuertos[replanificacion.destinoIata];
    const map = mapRef.current?.getMap();
    if (!map || !origen || !destino) return;
    map.fitBounds(
      [[Math.min(origen[0], destino[0]), Math.min(origen[1], destino[1])], [Math.max(origen[0], destino[0]), Math.max(origen[1], destino[1])]],
      { padding: 100, duration: 700, maxZoom: 5.8 }
    );
  }, [coordsAeropuertos]);

  useEffect(() => {
    if (rutaEnvio) enfocarRutaEnvio();
  }, [rutaEnvio]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (replanificaciones.length > 0) {
      setReplanificacionSeleccionada(replanificaciones[0]);
    }
  }, [replanificaciones]);

  const featuresReplanificacion = useMemo<Feature[]>(() => {
    const r = replanificacionSeleccionada;
    if (!r) return [];
    const origen = coordsAeropuertos[r.origenIata];
    const destino = coordsAeropuertos[r.destinoIata];
    if (!origen || !destino) return [];
    return [
      {
        type: 'Feature',
        properties: {
          idPedido: r.idPedido,
          motivo: r.motivo,
          tipoRuta: 'nueva',
        },
        geometry: { type: 'LineString', coordinates: [origen, destino] },
      },
    ];
  }, [coordsAeropuertos, replanificacionSeleccionada]);

  const asegurarSourcesYLayers = useCallback((map: MapLibreNative) => {
    if (!map.isStyleLoaded()) return;
    const { featuresAviones, featuresRutas } = crearFeaturesVuelosMapa();
    const featuresAeropuertos = crearFeaturesAeropuertosMapa();
    const sourcesListos = Boolean(
      map.getSource('rutas-data')
      && map.getSource('envio-ruta-data')
      && map.getSource('replanificacion-ruta-data')
      && map.getSource('aeropuertos-data')
      && map.getSource('aviones-data')
    );
    if (!sourcesListos) return;

    actualizarSourceGeoJson(map, 'rutas-data', crearFeatureCollection(featuresRutas));
    actualizarSourceGeoJson(map, 'envio-ruta-data', crearFeatureCollection(featuresRutaEnvio));
    actualizarSourceGeoJson(map, 'replanificacion-ruta-data', crearFeatureCollection(featuresReplanificacion));
    actualizarSourceGeoJson(map, 'aeropuertos-data', crearFeatureCollection(featuresAeropuertos));
    actualizarSourceGeoJson(map, 'aviones-data', crearFeatureCollection(featuresAviones));

    asegurarLayer(map, layerStyleLine as LayerSpecification);
    asegurarLayer(map, layerStyleRutaEnvio as LayerSpecification);
    asegurarLayer(map, {
      id: 'replanificacion-ruta-line',
      type: 'line',
      source: 'replanificacion-ruta-data',
      paint: {
        'line-color': '#f97316',
        'line-width': 4,
        'line-opacity': 0.9,
        'line-dasharray': [1, 1.2],
      },
    });
    if (iconosAeropuertoListos) {
      asegurarLayer(map, layerStyleAeropuertos as LayerSpecification);
    } else {
      quitarLayer(map, 'point');
    }

    if (iconosAvionListos) {
      asegurarLayer(map, layerStyleAirplane as LayerSpecification);
    } else {
      quitarLayer(map, 'plane');
    }
    reordenarCapasDatos(map);
    logDiagnosticoAeropuertos(map, featuresAeropuertos, 'asegurarSourcesYLayers');
  }, [
    crearFeaturesAeropuertosMapa,
    crearFeaturesVuelosMapa,
    featuresReplanificacion,
    featuresRutaEnvio,
    iconosAeropuertoListos,
    iconosAvionListos,
    logDiagnosticoAeropuertos,
  ]);

  // Snapshot cada 500ms para los paneles (vuelos, aeropuertos, envíos)
  useEffect(() => {
    if (!conectado) return;
    const timer = setInterval(() => {
      setVuelosActivosSnapshot(Array.from(vuelosActivosRef.current.values()));
      setAeropuertosSnapshot(crearAeropuertosSimulacionEstables(aeropuertosIniciales, aeropuertosRef.current));
      setEnviosSnapshot(Object.values(enviosPlanificadosRef.current || {}));
      setTiempoSimulacionSnapshot(tiempoSimulacionRef.current);
    }, 500);
    return () => clearInterval(timer);
  }, [aeropuertosIniciales, aeropuertosRef, conectado, enviosPlanificadosRef, tiempoSimulacionRef, vuelosActivosRef]);

  const ocupacionPromedioFlota = useMemo(() => {
    if (vuelosActivosSnapshot.length === 0) return 0;
    return vuelosActivosSnapshot.reduce(
      (acc, v) => acc + (v.capacidadMax ? (v.cantidadMaletas / v.capacidadMax) * 100 : 0), 0
    ) / vuelosActivosSnapshot.length;
  }, [vuelosActivosSnapshot]);

  const metricasGlobales = useMemo(() => {
    const ocupacionAeropuertos = aeropuertosSnapshot.filter(a => a.tieneDatos);
    const ocupacionPromedioAeropuertos = ocupacionAeropuertos.length === 0 ? 0 :
      ocupacionAeropuertos.reduce((acc, a) => acc + (a.porcentajeOcupacion || 0), 0) / ocupacionAeropuertos.length;
    const enviosEntregados = enviosSnapshot.filter(e => (e as any)._estado === 'ENTREGADO').length;
    const enviosTransito = enviosSnapshot.filter(e => (e as any)._estado === 'EN_CURSO').length;
    const enviosPendientes = enviosSnapshot.filter(e => (e as any)._estado === 'PLANIFICADO').length;

    // Maletas que aún no llegan a destino (planificadas o en curso)
    const maletasPendientes = enviosSnapshot
      .filter(e => (e as any)._estado !== 'ENTREGADO')
      .reduce((acc, e) => acc + (e.cantidadMaletas || 0), 0);

    // Tiempo promedio de entrega: diferencia entre _llegadaEpoch y fechaHora de creación,
    // solo para envíos ya entregados.
    const entregadosConTiempos = enviosSnapshot.filter(e => {
      const env = e as any;
      return env._estado === 'ENTREGADO' && env._llegadaEpoch && env.fechaHora;
    });
    const tiempoPromedioEntregaMs = entregadosConTiempos.length === 0 ? null :
      entregadosConTiempos.reduce((acc, e) => {
        const env = e as any;
        const inicio = Date.parse(env.fechaHora);
        const duracion = Number.isFinite(inicio) ? env._llegadaEpoch - inicio : 0;
        return acc + Math.max(0, duracion);
      }, 0) / entregadosConTiempos.length;

    return {
      maletasPendientes,
      tiempoPromedioEntregaMs,
      ocupacionPromedioAeropuertos,
      enviosEntregados,
      enviosTransito,
      enviosPendientes,
      aeropuertosVacio: aeropuertosSnapshot.filter(a => obtenerEstadoAeropuerto(a) === 'VACIO').length,
      aeropuertosRojo: aeropuertosSnapshot.filter(a => obtenerEstadoAeropuerto(a) === 'ROJO').length,
      aeropuertosAmbar: aeropuertosSnapshot.filter(a => obtenerEstadoAeropuerto(a) === 'AMARILLO').length,
      aeropuertosVerde: aeropuertosSnapshot.filter(a => obtenerEstadoAeropuerto(a) === 'VERDE').length,
      vuelosVacio: vuelosActivosSnapshot.filter(v => obtenerEstadoVuelo(v) === 'VACIO').length,
      vuelosRojo: vuelosActivosSnapshot.filter(v => obtenerEstadoVuelo(v) === 'ROJO').length,
      vuelosAmbar: vuelosActivosSnapshot.filter(v => obtenerEstadoVuelo(v) === 'AMARILLO').length,
      vuelosVerde: vuelosActivosSnapshot.filter(v => obtenerEstadoVuelo(v) === 'VERDE').length,
    };
  }, [aeropuertosSnapshot, enviosSnapshot, vuelosActivosSnapshot]);

  const aeropuertoSeleccionado = useMemo(() => {
    const codigo = selAirport?.properties?.codigoIata;
    return typeof codigo === 'string'
      ? aeropuertosIniciales.find(a => a.codigoIata === codigo) ?? null
      : null;
  }, [aeropuertosIniciales, selAirport]);

  const seleccionarAeropuerto = useCallback((codigoIata: string) => {
    const aeropuerto = aeropuertosSnapshot.find((a) => a.codigoIata === codigoIata)
      ?? aeropuertosIniciales.find((a) => a.codigoIata === codigoIata);
    setSelAirport(({
      type: 'Feature',
      properties: { ...(aeropuerto ?? {}), codigoIata, isAirport: true },
      geometry: { type: 'Point', coordinates: coordsAeropuertos[codigoIata] ?? [0, 0] },
    } as unknown) as MapGeoJSONFeature);
    setAirportPanelOpen(true);
    enfocarAeropuerto(codigoIata);
    setFiltroRelacion({
      vuelos: new Set(vuelosActivosSnapshot
        .filter((vuelo) => vuelo.origenIata === codigoIata || vuelo.destinoIata === codigoIata)
        .map((vuelo) => String(vuelo.codigoVuelo))),
    });
  }, [aeropuertosIniciales, aeropuertosSnapshot, coordsAeropuertos, enfocarAeropuerto, vuelosActivosSnapshot]);

  const limpiarSeleccionRelacionada = useCallback(() => {
    setFiltroRelacion({});
    setRutaEnvio(null);
    setRutaError(null);
  }, []);

  const vuelosPanel = useMemo(() => {
    const filtro = filtroRelacion.vuelos;
    return filtro ? vuelosActivosSnapshot.filter((vuelo) => filtro.has(String(vuelo.codigoVuelo))) : vuelosActivosSnapshot;
  }, [filtroRelacion.vuelos, vuelosActivosSnapshot]);

  const aeropuertosPanel = useMemo(() => {
    const filtro = filtroRelacion.aeropuertos;
    return filtro ? aeropuertosSnapshot.filter((aeropuerto) => filtro.has(aeropuerto.codigoIata)) : aeropuertosSnapshot;
  }, [aeropuertosSnapshot, filtroRelacion.aeropuertos]);

  const enviosPanel = useMemo(() => {
    const filtro = filtroRelacion.envios;
    return filtro ? enviosSnapshot.filter((envio) => filtro.has(envio.idPedido)) : enviosSnapshot;
  }, [enviosSnapshot, filtroRelacion.envios]);

  // Motor gráfico a 60fps. Aviones/rutas cada frame, aeropuertos cada 30 frames.
  useEffect(() => {
    let rafId: number;
    let frame = 0;

    const animar = () => {
      const map = mapRef.current?.getMap();
      if (!map || !map.isStyleLoaded()) { rafId = requestAnimationFrame(animar); return; }

      const t = tiempoSimulacionRef.current;
      const featuresAviones: Feature[] = [];
      const featuresRutas: Feature[] = [];

      vuelosActivosRef.current.forEach((vuelo) => {
        const codigoVuelo = String(vuelo.codigoVuelo);
        if (filtroVuelosRef.current && !filtroVuelosRef.current.has(codigoVuelo)) return;
        if (filtroRelacionRef.current.vuelos && !filtroRelacionRef.current.vuelos.has(codigoVuelo)) return;
        const o = coordsAeropuertos[vuelo.origenIata];
        const d = coordsAeropuertos[vuelo.destinoIata];
        if (!o || !d) return;
        const v = vuelo as VueloAnimado;
        const ini = v._salidaEpoch ?? Date.parse(vuelo.horaSalidaUtc);
        const fin = v._llegadaEpoch ?? Date.parse(vuelo.horaLlegadaUtc);
        if (!Number.isFinite(ini) || !Number.isFinite(fin)) return;
        let p = (fin - ini) > 0 ? (t - ini) / (fin - ini) : 1;
        p = Math.max(0, Math.min(1, p));
        const pos = interpolar(o, d, p);
        const bearing = calcularBearing(o, d);
        featuresAviones.push({
          type: 'Feature',
          properties: {
            ...vuelo,
            codigoVuelo: String(vuelo.codigoVuelo),
            bearing,
            color: COLOR_POR_ESTADO[vuelo.estado] ?? '#ffffff',
            iconColor: vuelo.cantidadMaletas === 0 ? 'GRIS' : (vuelo.estado ?? 'VERDE'),
            isAirplane: true,
          },
          geometry: { type: 'Point', coordinates: pos },
        });
        if (p < 0.999) {
          featuresRutas.push({
            type: 'Feature',
            properties: { estado: vuelo.estado },
            geometry: { type: 'LineString', coordinates: [pos, d] },
          });
        }
      });

      (map.getSource('aviones-data') as GeoJSONSource | undefined)?.setData(crearFeatureCollection(featuresAviones));
      (map.getSource('rutas-data') as GeoJSONSource | undefined)?.setData(crearFeatureCollection(featuresRutas));

      if (++frame % 30 === 0) {
        const todasFeatures = crearFeaturesAeropuertosMapa();
        const featuresFiltradas = filtroAeropuertosRef.current
          ? todasFeatures.filter(f => filtroAeropuertosRef.current!.has(f.properties?.codigoIata as string))
          : todasFeatures;
        const featuresRelacionadas = filtroRelacionRef.current.aeropuertos
          ? featuresFiltradas.filter(f => filtroRelacionRef.current.aeropuertos!.has(f.properties?.codigoIata as string))
          : featuresFiltradas;
        (map.getSource('aeropuertos-data') as GeoJSONSource)?.setData({
          type: 'FeatureCollection',
          features: featuresRelacionadas,
        });
      }

      rafId = requestAnimationFrame(animar);
    };

    animar();
    return () => cancelAnimationFrame(rafId);
  }, [asegurarSourcesYLayers, crearFeaturesAeropuertosMapa, crearFeaturesVuelosMapa, logDiagnosticoAeropuertos]);

  // Capa de ruta de envío: se actualiza solo cuando cambia la ruta buscada
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) return;
    if (!map.getSource('envio-ruta-data')) asegurarSourcesYLayers(map);
    (map.getSource('envio-ruta-data') as GeoJSONSource | undefined)?.setData(crearFeatureCollection(featuresRutaEnvio));
  }, [asegurarSourcesYLayers, featuresRutaEnvio]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) return;
    if (!map.getSource('replanificacion-ruta-data')) asegurarSourcesYLayers(map);
    (map.getSource('replanificacion-ruta-data') as GeoJSONSource | undefined)?.setData(crearFeatureCollection(featuresReplanificacion));
  }, [asegurarSourcesYLayers, featuresReplanificacion]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const asegurar = () => asegurarSourcesYLayers(map);
    if (map.isStyleLoaded()) asegurar();
    map.on('load', asegurar);
    map.on('styledata', asegurar);
    return () => {
      map.off('load', asegurar);
      map.off('styledata', asegurar);
    };
  }, [asegurarSourcesYLayers]);

  // Sincronizar cámara entre mapa de datos y mapa de fondo. Polling liviano
  // (intervalo corto) hasta detectar que ambas instancias existen, sin depender
  // del evento 'load' de ninguno (que dispara hasta terminar de bajar el basemap).
  useEffect(() => {
    if (syncRegistradoRef.current) return;
    const intervalo = setInterval(() => {
      const mapaDatos = mapRef.current?.getMap();
      const mapaFondo = backgroundMapRef.current?.getMap();
      if (mapaDatos && mapaFondo && !syncRegistradoRef.current) {
        const centroDatos = mapaDatos.getCenter();
        const centroFondo = mapaFondo.getCenter();
        const camarasValidas = [
          centroDatos.lng, centroDatos.lat, mapaDatos.getZoom(),
          centroFondo.lng, centroFondo.lat, mapaFondo.getZoom(),
        ].every(Number.isFinite);
        if (!camarasValidas) return;

        const copiarCamaraAlFondo = () => {
          const center = mapaDatos.getCenter();
          const zoom = mapaDatos.getZoom();
          const bearing = mapaDatos.getBearing();
          const pitch = mapaDatos.getPitch();
          if (![center.lng, center.lat, zoom, bearing, pitch].every(Number.isFinite)) return;
          mapaFondo.jumpTo({ center: [center.lng, center.lat], zoom, bearing, pitch });
        };
        mapaDatos.on('move', copiarCamaraAlFondo);
        copiarCamaraAlFondo();
        limpiarSyncRef.current = () => {
          mapaDatos.off('move', copiarCamaraAlFondo);
        };
        syncRegistradoRef.current = true;
        clearInterval(intervalo);
      }
    }, 30);
    return () => {
      clearInterval(intervalo);
      limpiarSyncRef.current?.();
      limpiarSyncRef.current = null;
      syncRegistradoRef.current = false;
    };
  }, []);

  const auditarCargaMapa = useCallback((mapa: MapLibreNative, nombre: 'principal' | 'secundario') => {
    if (mapasAuditadosRef.current.has(nombre)) return;
    mapasAuditadosRef.current.add(nombre);
    const centro = mapa.getCenter();
    const contenedor = mapa.getContainer();
    console.info('[MAP-LOAD-AUDIT]', {
      mapa: nombre,
      mapLoaded: mapa.loaded(),
      styleLoaded: mapa.isStyleLoaded(),
      containerWidth: contenedor.clientWidth,
      containerHeight: contenedor.clientHeight,
      zoom: mapa.getZoom(),
      center: [centro.lng, centro.lat],
      renderWorldCopies: false,
      maxBoundsConfigurado: false,
    });
    requestAnimationFrame(() => {
      const canvas = mapa.getCanvas();
      const contenedorRect = mapa.getContainer().getBoundingClientRect();
      const elementoSuperior = document.elementFromPoint(
        contenedorRect.left + contenedorRect.width / 2,
        contenedorRect.top + contenedorRect.height / 2,
      );
      console.info('[MAP-INTERACTION-AUDIT]', {
        mapa: nombre,
        interactive: true,
        dragPanEnabled: mapa.dragPan.isEnabled(),
        scrollZoomEnabled: mapa.scrollZoom.isEnabled(),
        doubleClickZoomEnabled: mapa.doubleClickZoom.isEnabled(),
        keyboardEnabled: mapa.keyboard.isEnabled(),
        boxZoomEnabled: mapa.boxZoom.isEnabled(),
        containerPointerEvents: getComputedStyle(mapa.getContainer()).pointerEvents,
        canvasPointerEvents: getComputedStyle(canvas).pointerEvents,
        overlayEncontrado: elementoSuperior !== null && !mapa.getContainer().contains(elementoSuperior),
      });
    });
  }, []);

  const registrarInteraccionUsuario = useCallback((mapa: MapLibreNative, evento: string) => {
    if (process.env.NODE_ENV !== 'development') return;
    const center = mapa.getCenter();
    console.debug('[MAP-USER-INTERACTION]', {
      mapa: 'principal',
      evento,
      center: [center.lng, center.lat],
      zoom: mapa.getZoom(),
    });
  }, []);

  const handleMapLoad = useCallback((e: MapLibreEvent) => {
    const map = e.target;
    auditarCargaMapa(map, 'principal');
    asegurarSourcesYLayers(map);

    cargarIconosAeropuerto(map, '/aeropuerto.png', 'airport', {
      verde:    '#22c55e',
      amarillo: '#eab308',
      rojo:     '#ef4444',
      vacio:    COLOR_POR_ESTADO.VACIO,
      default:  '#ffffff',
    })
      .then(() => {
        if (!map.hasImage('airport-vacio')) throw new Error('airport-vacio no registrado');
        setIconosAeropuertoListos(true);
      })
      .catch((err) => {
        console.error('Error al cargar íconos de aeropuerto:', err);
        setIconosAeropuertoListos(false);
      });

    cargarIconosColoreados(map, '/avion.png', 'airplane', {
      verde: '#22c55e', amarillo: '#eab308', rojo: '#ef4444', gris: '#94a3b8',
    })
      .then(() => {
        if (!map.hasImage('airplane-gris')) throw new Error('airplane-gris no registrado');
        setIconosAvionListos(true);
      })
      .catch((err) => {
        console.error('Error al cargar íconos de avión:', err);
        setIconosAvionListos(false);
      });
  }, [asegurarSourcesYLayers, auditarCargaMapa]);

  const handleMouseEnter = (event: MapLayerMouseEvent) => {
    setSelFeature(event.features?.[0] ?? null);
    setShowPopup(true);
    popupRef.current?.trackPointer();
  };

  const handleBackgroundLoad = useCallback((e: MapLibreEvent) => {
    const language = 'es';
    const map = e.target;
    auditarCargaMapa(map, 'secundario');
    map.setLayoutProperty('label_country_1', 'text-field', ['get', `name:${language}`]);
    map.setLayoutProperty('label_country_2', 'text-field', ['get', `name:${language}`]);
    map.setLayoutProperty('label_country_3', 'text-field', ['get', `name:${language}`]);
  }, [auditarCargaMapa]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Drawer open={panelOpen} onClose={() => setPanelOpen(false)}>
        <AvionSidePanel
          openPanel={panelOpen}
          selFlight={selFlight}
          idSimulacion={idSimulacion}
          aeropuertos={aeropuertosIniciales}
          tiempoSimulacionRef={tiempoSimulacionRef}
          onMostrarRutaEnvio={mostrarRutaEnvio}
          onEnfocarVuelo={enfocarVueloSeleccionado}
          onClose={() => setPanelOpen(false)}
        />
      </Drawer>
      <Drawer open={airportPanelOpen} onClose={() => setAirportPanelOpen(false)}>
        <AeropuertoSidePanel
          openPanel={airportPanelOpen}
          selAirport={selAirport}
          aeropuertosRef={aeropuertosRef}
          idSimulacion={idSimulacion}
          tiempoSimulacionRef={tiempoSimulacionRef}
          onMostrarRutaEnvio={mostrarRutaEnvio}
          onEnfocarAeropuerto={enfocarAeropuerto}
          onClose={() => setAirportPanelOpen(false)}
        />
      </Drawer>

      <PanelLateral
        visible={conectado}
        idSimulacion={idSimulacion}
        vuelosActivos={vuelosPanel}
        tiempoSimulacionRef={tiempoSimulacionRef}
        seleccionarVuelo={seleccionarVuelo}
        onEnfocarVuelo={enfocarVueloSeleccionado}
        onFiltradoVuelosCambiado={handleFiltradoVuelosCambiado}
        aeropuertos={aeropuertosPanel}
        onEnfocarAeropuerto={seleccionarAeropuerto}
        onFiltradoAeropuertosCambiado={handleFiltradoAeropuertosCambiado}
        envios={enviosPanel}
        tiempoSimulacion={tiempoSimulacionSnapshot}
        onMostrarRutaEnvio={mostrarRutaEnvio}
        haySeleccionRelacionada={Boolean(filtroRelacion.vuelos || filtroRelacion.aeropuertos || filtroRelacion.envios)}
        onLimpiarSeleccionRelacionada={limpiarSeleccionRelacionada}
      />

      <PanelMetricas
        visible={conectado}
        ocupacionFlota={ocupacionPromedioFlota}
        ocupacionAeropuertos={metricasGlobales.ocupacionPromedioAeropuertos}
        maletasPendientes={metricasGlobales.maletasPendientes}
        tiempoPromedioEntregaMs={metricasGlobales.tiempoPromedioEntregaMs}
      />

      {colapso && <PanelColapso colapso={colapso} />}

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
        boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
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
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              border: 'none', borderRadius: 6, padding: '7px 10px',
              background: '#38bdf8', color: '#0f172a', fontWeight: 700,
            }}
          >
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
        style={{ zIndex: 17, position: 'absolute', inset: 0, pointerEvents: 'none' }}
        mapStyle="https://tiles.openfreemap.org/styles/bright"
        renderWorldCopies={false}
        onLoad={handleBackgroundLoad}
      />
      <MapLibre
        ref={mapRef}
        style={{ position: 'absolute', inset: 0, zIndex: 18, pointerEvents: 'auto' }}
        initialViewState={{ longitude: 0, latitude: 10, zoom: 1.2 }}
        mapStyle={EMPTY_MAP_STYLE}
        renderWorldCopies={false}
        interactive={true}
        dragPan={true}
        scrollZoom={true}
        doubleClickZoom={true}
        touchZoomRotate={true}
        keyboard={true}
        boxZoom={true}
        onDragStart={(e) => registrarInteraccionUsuario(e.target, 'dragstart')}
        onDragEnd={(e) => registrarInteraccionUsuario(e.target, 'dragend')}
        onZoomStart={(e) => registrarInteraccionUsuario(e.target, 'zoomstart')}
        onZoomEnd={(e) => registrarInteraccionUsuario(e.target, 'zoomend')}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowPopup(false)}
        onMouseDown={(e: MapLayerMouseEvent) => {
          const feature = e.features?.[0];
          const props = feature?.properties;
          if (!props) return;
          if (props.isAirplane) {
            setSelFlight(feature ?? null);
            setPanelOpen(true);
            const coords = obtenerCoordenadasFeature(feature ?? null);
            if (coords) enfocarCoordenadas(coords, 6.5);
            if (typeof props.codigoVuelo === 'string' || typeof props.codigoVuelo === 'number') {
              setFiltroRelacion({
                vuelos: new Set([String(props.codigoVuelo)]),
              });
            }
          } else if (props.isAirport) {
            if (typeof props.codigoIata === 'string') seleccionarAeropuerto(props.codigoIata);
          }
        }}
        interactiveLayerIds={['point', 'plane']}
        onLoad={handleMapLoad}
      >
        <Source id="rutas-data" type="geojson" data={crearFeatureCollection([])}>
          <Layer {...layerStyleLine} />
        </Source>
        <Source id="envio-ruta-data" type="geojson" data={crearFeatureCollection(featuresRutaEnvio)}>
          <Layer {...layerStyleRutaEnvio} />
        </Source>
        <Source id="replanificacion-ruta-data" type="geojson" data={crearFeatureCollection(featuresReplanificacion)}>
          <Layer
            id="replanificacion-ruta-line"
            type="line"
            paint={{
              'line-color': '#f97316',
              'line-width': 4,
              'line-opacity': 0.9,
              'line-dasharray': [1, 1.2],
            }}
          />
        </Source>
        <Source id="aeropuertos-data" type="geojson" data={crearFeatureCollection(featuresAeropuertosIniciales)}>
          {iconosAeropuertoListos && <Layer {...layerStyleAeropuertos} />}
        </Source>
        <Source id="aviones-data" type="geojson" data={crearFeatureCollection([])}>
          {iconosAvionListos && <Layer {...layerStyleAirplane} />}
        </Source>

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

      <RelojSimulacionOverlay
        tiempoRef={tiempoSimulacionRef}
        ocupacionFlota={ocupacionPromedioFlota}
        fechaInicio={fechaInicio}
        modo={modo}
        aeropuertoSeleccionado={aeropuertoSeleccionado}
        gmtUsuario={gmtUsuario}
        aeropuertoUsuario={aeropuertoUsuario}
        fechaHoraInicioReal={fechaHoraInicioReal}
        fechaHoraFinReal={fechaHoraFinReal}
        estadoSim={estadoSim}
      />
    </div>
  );
}

function PanelResumenDerecho({
  visible,
  replanificaciones,
  replanificacionSeleccionada,
  onSeleccionarReplanificacion,
  ...metricas
}: {
  visible: boolean;
  ocupacionFlota: number;
  ocupacionAeropuertos: number;
  vuelosEnAire: number;
  enviosTransito: number;
  enviosEntregados: number;
  enviosPendientes: number;
  aeropuertos: { rojo: number; ambar: number; verde: number; vacio: number };
  vuelos: { rojo: number; ambar: number; verde: number; vacio: number };
  replanificaciones: EventoReplanificacionEnvio[];
  replanificacionSeleccionada: EventoReplanificacionEnvio | null;
  onSeleccionarReplanificacion: (replanificacion: EventoReplanificacionEnvio) => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  if (!visible) return null;
  return (
    <Draggable nodeRef={nodeRef as RefObject<HTMLDivElement>} handle=".metricas-drag-handle">
      <div
        ref={nodeRef}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 24,
          width: 340,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <PanelMetricasGlobales {...metricas} visible={visible} />
        <PanelReplanificaciones
          replanificaciones={replanificaciones}
          seleccionada={replanificacionSeleccionada}
          visible={visible}
          onSeleccionar={onSeleccionarReplanificacion}
        />
      </div>
    </Draggable>
  );
}

function PanelMetricasGlobales({
  visible,
  ocupacionFlota,
  ocupacionAeropuertos,
  vuelosEnAire,
  enviosTransito,
  enviosEntregados,
  enviosPendientes,
  aeropuertos,
  vuelos,
}: {
  visible: boolean;
  ocupacionFlota: number;
  ocupacionAeropuertos: number;
  vuelosEnAire: number;
  enviosTransito: number;
  enviosEntregados: number;
  enviosPendientes: number;
  aeropuertos: { rojo: number; ambar: number; verde: number; vacio: number };
  vuelos: { rojo: number; ambar: number; verde: number; vacio: number };
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  if (!visible) return null;
  const semaforo = Math.max(ocupacionFlota, ocupacionAeropuertos);
  const color = semaforo >= 85 ? '#ef4444' : semaforo >= 60 ? '#eab308' : '#22c55e';
  const item = (label: string, value: string | number) => (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
      <div style={{ fontWeight: 800 }}>{value}</div>
    </div>
  );
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.92)', color: '#fff',
      border: '1px solid rgba(148, 163, 184, 0.35)', borderRadius: 8,
      padding: 12, width: 340, boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
    }}>
      <div className="metricas-drag-handle" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'move' }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: color, display: 'inline-block' }} />
        <strong>Metricas globales</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 13 }}>
        {item('Flota', `${Math.round(ocupacionFlota)}%`)}
        {item('Aeropuertos', `${Math.round(ocupacionAeropuertos)}%`)}
        {item('Vuelos aire', vuelosEnAire)}
        {item('En transito', enviosTransito)}
        {item('Entregados', enviosEntregados)}
        {item('Pendientes', enviosPendientes)}
        {item('Aeropuertos vacíos', aeropuertos.vacio)}
        {item('Vuelos vacíos', vuelos.vacio)}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#cbd5e1' }}>
        Aeropuertos R/A/V: {aeropuertos.rojo}/{aeropuertos.ambar}/{aeropuertos.verde} · Vuelos R/A/V: {vuelos.rojo}/{vuelos.ambar}/{vuelos.verde}
      </div>
    </div>
  );
}

function PanelReplanificaciones({
  visible,
  replanificaciones,
  seleccionada,
  onSeleccionar,
}: {
  visible: boolean;
  replanificaciones: EventoReplanificacionEnvio[];
  seleccionada: EventoReplanificacionEnvio | null;
  onSeleccionar: (replanificacion: EventoReplanificacionEnvio) => void;
}) {
  if (!visible) return null;
  const lista = replanificaciones.slice(0, 10);
  return (
    <div style={{
      width: 340, maxHeight: 300, overflowY: 'auto',
      background: 'rgba(15, 23, 42, 0.92)', color: '#fff',
      border: '1px solid rgba(251, 146, 60, 0.45)', borderRadius: 8,
      padding: 12, boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <strong>Replanificaciones</strong>
        <span style={{ fontSize: 12, color: '#fed7aa' }}>{replanificaciones.length}</span>
      </div>
      {lista.length === 0 ? (
        <div style={{ fontSize: 12, color: '#cbd5e1' }}>Sin replanificaciones recientes.</div>
      ) : lista.map((r) => {
        const activa = seleccionada?.idPedido === r.idPedido && seleccionada?.fechaHoraEvento === r.fechaHoraEvento;
        return (
          <button
            key={`${r.idPedido}-${r.fechaHoraEvento}-${r.itinerarioNuevo ?? 'sin-ruta'}`}
            onClick={() => onSeleccionar(r)}
            style={{
              width: '100%', textAlign: 'left', display: 'block',
              border: activa ? '1px solid #fb923c' : '1px solid rgba(148, 163, 184, 0.25)',
              background: activa ? 'rgba(251, 146, 60, 0.16)' : 'rgba(30, 41, 59, 0.82)',
              color: '#fff', borderRadius: 6, padding: 8, marginBottom: 8,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ fontSize: 12 }}>{r.idPedido}</strong>
              <span style={{ fontSize: 11, color: '#fed7aa' }}>{r.motivo}</span>
            </div>
            <div style={{ fontSize: 12, color: '#e2e8f0', marginTop: 4 }}>{r.origenIata} - {r.destinoIata}</div>
            <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>
              Estado: {r.estadoAnterior ?? '-'} - {r.estadoNuevo ?? '-'}
            </div>
            <div style={{ fontSize: 11, color: '#cbd5e1' }}>
              Vuelo: {r.vueloAnterior ?? 'Sin ruta'} - {r.vueloNuevo ?? 'Sin ruta'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              {formatUtcDisplay(r.horaSimulada ?? r.fechaHoraEvento)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PanelColapso({ colapso }: { colapso: EventoColapso }) {
  const d = colapso.detalle;
  const esCapacidad = colapso.causaPrincipal === 'CAPACIDAD_AEROPUERTO_SUPERADA';
  return (
    <div style={{
      position: 'absolute', left: '50%', top: 24, transform: 'translateX(-50%)',
      zIndex: 30, width: 420, maxWidth: 'calc(100% - 32px)',
      background: '#fff7ed', color: '#7c2d12', border: '1px solid #fdba74',
      borderRadius: 8, padding: 16, boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Colapso logistico detectado</div>
      <div style={{ fontWeight: 700 }}>
        Causa: {esCapacidad ? 'Capacidad del aeropuerto superada' : 'Incumplimiento de SLA'}
      </div>
      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55 }}>
        {esCapacidad && <>
          <div><strong>Aeropuerto:</strong> {colapso.codigoAeropuerto ?? d?.codigoAeropuerto ?? 'No disponible'}{colapso.nombreAeropuerto ? ` - ${colapso.nombreAeropuerto}` : ''}</div>
          <div><strong>Capacidad máxima:</strong> {colapso.capacidadMaxima ?? d?.capacidad ?? '-'} maletas</div>
          <div><strong>Ocupación alcanzada:</strong> {colapso.ocupacionActual ?? d?.maletasActuales ?? '-'} maletas</div>
          <div><strong>Exceso:</strong> {colapso.exceso ?? '-'} maleta(s)</div>
          <div><strong>Ocupación:</strong> {(colapso.porcentajeOcupacion ?? d?.porcentajeOcupacion)?.toFixed(3) ?? '-'}%</div>
          <div><strong>Hora simulada:</strong> {formatUtcDisplay(d?.horaColapso ?? colapso.fechaHoraEvento)}</div>
          <div><strong>Motivo:</strong> {colapso.motivo ?? d?.motivo ?? 'CAPACIDAD_AEROPUERTO_SUPERADA'}</div>
        </>}
        {!esCapacidad && <>
        <div><strong>Envio/maleta responsable:</strong> {d?.idPedido ?? 'No disponible'}</div>
        <div><strong>Ruta:</strong> {d?.origenIata ?? '-'} - {d?.destinoIata ?? '-'} · {d?.cantidadMaletas ?? '-'} maletas</div>
        <div><strong>Registro:</strong> {formatUtcDisplay(d?.fechaHoraRegistro)}</div>
        <div><strong>Deadline:</strong> {formatUtcDisplay(d?.deadlineSla)}</div>
        <div><strong>Hora exacta de colapso:</strong> {formatUtcDisplay(d?.horaColapso ?? colapso.fechaHoraEvento)}</div>
        <div><strong>Tipo SLA:</strong> {d?.tipoSla ?? 'No disponible'}</div>
        <div><strong>Estado:</strong> {d?.estadoEnvio ?? 'No disponible'}</div>
        <div><strong>Ultimo aeropuerto:</strong> {d?.aeropuertoActual ?? 'No disponible'}</div>
        <div><strong>Vuelo/ruta:</strong> {d?.vueloAfectado ?? d?.itinerarioAfectado ?? 'No disponible'}</div>
        </>}
      </div>
    </div>
  );
}
