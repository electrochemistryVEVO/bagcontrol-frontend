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
import type { GeoJSONSource } from 'maplibre-gl';
// @ts-ignore
import * as syncMaps from '@mapbox/mapbox-gl-sync-move';
import 'maplibre-gl/dist/maplibre-gl.css';

import { AeropuertoSimulacion, Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { EventoVuelo } from '@/app/shared/types/Evento';
import { Envio, EnvioRuta } from '@/app/shared/types/Envio';
import { SimulacionService } from '@/app/services/simulation.service';
import { AeropuertoPopupContent } from './pop-up-aeropuerto';
import { RelojSimulacionOverlay } from './reloj-simulacion';
import { PanelVuelos } from './panel-vuelos';
import { PanelAeropuertos } from './panel-aeropuertos';
import AvionSidePanel from '@/app/simulation/components/avion-sidepanel';
import AeropuertoSidePanel from '@/app/simulation/components/aeropuerto-sidepanel';
import { PanelEnvios } from '@/app/simulation/[idSimulacion]/components/panel-envios';
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
  crearFeatureAeropuerto,
  crearFeaturesAeropuerto,
  interpolar,
  calcularBearing,
  obtenerCoordenadasFeature,
} from './mapa-simulacion.utils';

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

export function MapaSimulacion({
  aeropuertosIniciales,
  aeropuertosRef,
  vuelosActivosRef,
  enviosPlanificadosRef,
  tiempoSimulacionRef,
  idSimulacion,
  conectado,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const backgroundMapRef = useRef<MapRef>(null);
  const popupRef = useRef<PopupInstance | null>(null);
  const syncRegistradoRef = useRef(false);

  const [showPopup, setShowPopup] = useState(false);
  const [selFeature, setSelFeature] = useState<MapGeoJSONFeature | null>(null);

  // Cada ícono (avión / aeropuerto) tiene su propio flag para que las capas se
  // monten en paralelo sin bloquearse entre sí.
  const [iconosAeropuertoListos, setIconosAeropuertoListos] = useState(false);
  const [iconosAvionListos, setIconosAvionListos] = useState(false);

  const [vuelosActivosSnapshot, setVuelosActivosSnapshot] = useState<EventoVuelo[]>([]);
  const [enviosSnapshot, setEnviosSnapshot] = useState<Envio[]>([]);
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

  const mostrarRutaEnvio = useCallback(async (idPedido: string) => {
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
    const map = mapRef.current?.getMap();
    if (!map) return;
    const sourceAviones = map.getSource('aviones-data') as GeoJSONSource;
    const feature = ((await sourceAviones.getData()) as FeatureCollection)
      .features.find(e => e.properties?.codigoVuelo === codigoVuelo) as MapGeoJSONFeature;
    setSelFlight(feature ?? null);
    setPanelOpen(true);
    const coords = obtenerCoordenadasFeature(feature ?? null);
    if (coords) enfocarCoordenadas(coords, 6.5);
  }, [enfocarCoordenadas]);

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

  useEffect(() => {
    if (rutaEnvio) enfocarRutaEnvio();
  }, [rutaEnvio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Snapshot cada 500ms para los paneles (vuelos, aeropuertos, envíos)
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
    return vuelosActivosSnapshot.reduce(
      (acc, v) => acc + (v.capacidadMax ? (v.cantidadMaletas / v.capacidadMax) * 100 : 0), 0
    ) / vuelosActivosSnapshot.length;
  }, [vuelosActivosSnapshot]);

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

      (map.getSource('aviones-data') as GeoJSONSource)?.setData({ type: 'FeatureCollection', features: featuresAviones });
      (map.getSource('rutas-data') as GeoJSONSource)?.setData({ type: 'FeatureCollection', features: featuresRutas });

      if (++frame % 30 === 0) {
        (map.getSource('aeropuertos-data') as GeoJSONSource)?.setData({
          type: 'FeatureCollection',
          features: crearFeaturesAeropuerto(aeropuertosRef.current),
        });
      }

      rafId = requestAnimationFrame(animar);
    };

    animar();
    return () => cancelAnimationFrame(rafId);
  }, [aeropuertosRef, coordsAeropuertos, tiempoSimulacionRef, vuelosActivosRef]);

  // Capa de ruta de envío: se actualiza solo cuando cambia la ruta buscada
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) return;
    (map.getSource('envio-ruta-data') as GeoJSONSource)?.setData({
      type: 'FeatureCollection',
      features: featuresRutaEnvio,
    });
  }, [featuresRutaEnvio]);

  // Sincronizar cámara entre mapa de datos y mapa de fondo. Polling liviano
  // (intervalo corto) hasta detectar que ambas instancias existen, sin depender
  // del evento 'load' de ninguno (que dispara hasta terminar de bajar el basemap).
  useEffect(() => {
    if (syncRegistradoRef.current) return;
    const intervalo = setInterval(() => {
      const mapaDatos = mapRef.current?.getMap();
      const mapaFondo = backgroundMapRef.current?.getMap();
      if (mapaDatos && mapaFondo && !syncRegistradoRef.current) {
        syncMaps(mapaDatos, mapaFondo);
        syncRegistradoRef.current = true;
        clearInterval(intervalo);
      }
    }, 30);
    return () => clearInterval(intervalo);
  }, []);

  const handleMapLoad = useCallback((e: MapLibreEvent) => {
    const map = e.target;

    cargarIconosAeropuerto(map, '/aeropuerto.png', 'airport', {
      verde:    '#22c55e',
      amarillo: '#eab308',
      rojo:     '#ef4444',
      default:  '#ffffff',
    })
      .catch((err) => console.error('Error al cargar íconos de aeropuerto:', err))
      .finally(() => setIconosAeropuertoListos(true));

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

  const handleBackgroundLoad = useCallback((e: MapLibreEvent) => {
    const language = 'es';
    const map = e.target;
    map.setLayoutProperty('label_country_1', 'text-field', ['get', `name:${language}`]);
    map.setLayoutProperty('label_country_2', 'text-field', ['get', `name:${language}`]);
    map.setLayoutProperty('label_country_3', 'text-field', ['get', `name:${language}`]);
  }, []);

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
        />
      </Drawer>

      <PanelVuelos
        idSimulacion={idSimulacion}
        vuelosActivos={vuelosActivosSnapshot}
        tiempoSimulacionRef={tiempoSimulacionRef}
        seleccionarVuelo={seleccionarVuelo}
        visible={conectado}
        onEnfocarVuelo={enfocarVueloSeleccionado}
      />
      <PanelEnvios
        aeropuertos={aeropuertosSnapshot}
        envios={enviosSnapshot}
        visible={conectado}
        onMostrarRutaEnvio={mostrarRutaEnvio}
      />
      <PanelAeropuertos
        aeropuertos={aeropuertosSnapshot}
        visible={conectado}
        onEnfocarAeropuerto={enfocarAeropuerto}
      />

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
        style={{ zIndex: 17, position: 'absolute' }}
        mapStyle="https://tiles.openfreemap.org/styles/bright"
        onLoad={handleBackgroundLoad}
      />
      <MapLibre
        ref={mapRef}
        style={{ position: 'absolute', zIndex: 18 }}
        initialViewState={{ longitude: -75, latitude: -10, zoom: 4 }}
        mapStyle={EMPTY_MAP_STYLE}
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
          } else if (props.isAirport) {
            setSelAirport(feature ?? null);
            setAirportPanelOpen(true);
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
