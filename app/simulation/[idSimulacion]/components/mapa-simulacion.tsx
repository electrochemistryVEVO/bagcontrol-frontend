'use client';

import {
  Map as MapLibre,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Popup,
  PopupInstance,
  Source,
  Layer,
  CircleLayerSpecification,
  LineLayerSpecification,
  MapRef,
  SymbolLayerSpecification,
} from '@vis.gl/react-maplibre';
import { useMemo, useRef, useState, useEffect, RefObject, useCallback } from 'react';
import { Feature } from 'geojson';
import { MapLibreEvent } from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
// @ts-ignore
import * as syncMaps from '@mapbox/mapbox-gl-sync-move';
import 'maplibre-gl/dist/maplibre-gl.css';

import { AeropuertoSimulacion, Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { EventoVuelo } from "@/app/shared/types/Evento";
import {Envio, EnvioRuta} from '@/app/shared/types/Envio';
import { SimulacionService } from '@/app/services/simulation.service';
import { AeropuertoPopupContent } from './pop-up-aeropuerto';
import { RelojSimulacionOverlay } from './reloj-simulacion';
import { PanelVuelos } from './panel-vuelos';
import { PanelAeropuertos } from './panel-aeropuertos';
import AvionSidePanel from "@/app/simulation/components/avion-sidepanel";
import AeropuertoSidePanel from "@/app/simulation/components/aeropuerto-sidepanel";
import { Drawer } from "@mui/material";
import {PanelEnvios} from "@/app/simulation/[idSimulacion]/components/panel-envios";

// ============================================================================
// STILOS DE CAPAS (Layers)
// ============================================================================
const layerStyleAeropuertos: CircleLayerSpecification = {
  id: 'point',
  type: 'circle',
  source: 'aeropuertos-data',
  paint: {
    'circle-radius': 8,
    'circle-color': [
      'match',
      ['get', 'estadoCapacidad'],
      'ROJO', '#ef4444',
      'AMARILLO', '#eab308',
      'VERDE', '#22c55e',
      '#007cbf'
    ],
    'circle-stroke-width': 1,
    'circle-stroke-color': '#ffffff'
  },
};

const layerStyleLine: LineLayerSpecification = {
  id: 'routes',
  type: 'line',
  source: 'rutas-data',
  paint: { 
    "line-color": [
      'match',
      ['get', 'estado'],
      'ROJO', '#ef4444',
      'AMARILLO', '#eab308',
      'VERDE', '#22c55e',
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
  paint: {
    'line-color': '#2563eb',
    'line-width': 4,
    'line-opacity': 0.9,
  }
};

const layerStyleAirplane: SymbolLayerSpecification = {
  id: 'plane',
  type: 'symbol',
  source: 'aviones-data',
  paint: {
    'icon-opacity': 1,
    'icon-color': [
      'match',
      ['get', 'estado'],
      'ROJO', '#ef4444',
      'AMARILLO', '#eab308',
      'VERDE', '#22c55e',
      '#ffffff'
    ]
  },
  layout: {
    'icon-image': 'airplane',
    'icon-rotate': ['get', 'bearing'],
    'icon-rotation-alignment': 'map',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'icon-size': 0.05
  }
};

function interpolar(inicio: number[], fin: number[], progreso: number) {
  return [
    inicio[0] + (fin[0] - inicio[0]) * progreso,
    inicio[1] + (fin[1] - inicio[1]) * progreso
  ];
}

function calcularBearing(inicio: number[], fin: number[]) {
  const dy = fin[1] - inicio[1];
  const dx = fin[0] - inicio[0];
  const theta = Math.atan2(dy, dx) * (180 / Math.PI);
  return 90 - theta;
}

function obtenerCoordenadasFeature(feature: MapGeoJSONFeature | null): [number, number] | null {
  if (!feature || feature.geometry.type !== 'Point') return null;
  const [lng, lat] = feature.geometry.coordinates;
  return [lng as number, lat as number];
}

interface Props {
  aeropuertosIniciales: Aeropuerto[];
  aeropuertosRef: RefObject<Record<string, AeropuertoSimulacion>>;
  vuelosActivosRef: RefObject<Map<string, EventoVuelo>>;
  tiempoSimulacionRef: RefObject<number>;
  enviosPlanificadosRef: RefObject<Record<string, Envio>>;
  idSimulacion: string;
  conectado: boolean;
}

export function MapaSimulacion({ aeropuertosIniciales, aeropuertosRef, vuelosActivosRef, enviosPlanificadosRef, tiempoSimulacionRef, idSimulacion, conectado }: Props) {
  const mapRef = useRef<MapRef>(null);
  const backgroundMapRef = useRef<MapRef>(null);
  const popupRef = useRef<PopupInstance | null>(null);
  
  const [showPopup, setShowPopup] = useState(false);
  const [selFeature, setSelFeature] = useState<MapGeoJSONFeature | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [backgroundLoaded,setBackgroundLoaded] = useState(false);
  const [vuelosActivosSnapshot, setVuelosActivosSnapshot] = useState<EventoVuelo[]>([]);
  const [aeropuertosSnapshot, setAeropuertosSnapshot] = useState<AeropuertoSimulacion[]>([]);
  const [enviosSnapshot, setEnviosSnapshot] = useState<Envio[]>([]);

  // Controladores de estado para los Drawers laterales
  const [panelOpen, setPanelOpen] = useState(false);
  const [selFlight, setSelFlight] = useState<MapGeoJSONFeature | null>(null);

  const [airportPanelOpen, setAirportPanelOpen] = useState(false);
  const [selAirport, setSelAirport] = useState<MapGeoJSONFeature | null>(null);
  const [idEnvioBusqueda, setIdEnvioBusqueda] = useState('');
  const [rutaEnvio, setRutaEnvio] = useState<EnvioRuta | null>(null);
  const [rutaError, setRutaError] = useState<string | null>(null);

  const coordsAeropuertos = useMemo(() => {
    const dict: Record<string, number[]> = {};
    aeropuertosIniciales.forEach(a => {
      dict[a.codigoIata] = [a.longitud, a.latitud];
    });
    return dict;
  }, [aeropuertosIniciales]);

  const enfocarCoordenadas = useCallback((coords: [number, number], zoom = 6) => {
    mapRef.current?.getMap().flyTo({
      center: coords,
      zoom,
      duration: 700,
      essential: true,
    });
  }, []);

  const enfocarAeropuerto = useCallback((codigoIata: string) => {
    const coords = coordsAeropuertos[codigoIata];
    if (coords) {
      enfocarCoordenadas([coords[0], coords[1]], 6.5);
    }
  }, [coordsAeropuertos, enfocarCoordenadas]);

  const enfocarVueloSeleccionado = useCallback(() => {
    const coords = obtenerCoordenadasFeature(selFlight);
    if (coords) {
      enfocarCoordenadas(coords, 6.5);
    }
  }, [enfocarCoordenadas, selFlight]);

  const mostrarRutaEnvio = useCallback(async (idPedido: string) => {
    const idNormalizado = idPedido.trim();
    if (!idNormalizado) return;

    try {
      setRutaError(null);
      const timestamp = new Date(tiempoSimulacionRef.current).toISOString();
      const { data } = await SimulacionService.obtenerRutaEnvio(idSimulacion, idNormalizado, timestamp);
      setRutaEnvio(data);
      setIdEnvioBusqueda(idNormalizado);
    } catch {
      setRutaEnvio(null);
      setRutaError(`No se encontro ruta para el envio ${idNormalizado}`);
    }
  }, [idSimulacion]);

  const featuresRutaEnvio = useMemo<Feature[]>(() => {
    if (!rutaEnvio) return [];
    return rutaEnvio.escalas
      .map((escala, index): Feature | null => {
        const origen = coordsAeropuertos[escala.origenIata];
        const destino = coordsAeropuertos[escala.destinoIata];
        if (!origen || !destino) return null;
        return {
          type: 'Feature' as const,
          properties: {
            index: index + 1,
            codigoVuelo: String(escala.codigoVuelo),
            origenIata: escala.origenIata,
            destinoIata: escala.destinoIata,
          },
          geometry: { type: 'LineString' as const, coordinates: [origen, destino] },
        };
      })
      .filter((feature): feature is Feature => feature !== null);
  }, [coordsAeropuertos, rutaEnvio]);

  const enfocarRutaEnvio = useCallback(() => {
    const coords = featuresRutaEnvio.flatMap((feature) => {
      if (feature.geometry.type !== 'LineString') return [];
      return feature.geometry.coordinates as [number, number][];
    });

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
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 90, duration: 700, maxZoom: 6.5 }
    );
  }, [enfocarAeropuerto, featuresRutaEnvio, rutaEnvio]);

  useEffect(() => {
    if (rutaEnvio) {
      enfocarRutaEnvio();
    }
  }, [enfocarRutaEnvio, rutaEnvio]);

  useEffect(() => {
    if (!conectado) {
      return;
    }

    const actualizarSnapshots = () => {
      setVuelosActivosSnapshot(Array.from(vuelosActivosRef.current.values()));
      setAeropuertosSnapshot(Object.values(aeropuertosRef.current || {}));
      setEnviosSnapshot(Object.values(enviosPlanificadosRef.current || {}))
    };

    const timer = setInterval(actualizarSnapshots, 500);
    return () => clearInterval(timer);
  }, [aeropuertosRef, conectado, vuelosActivosRef]);

  const ocupacionPromedioFlota = useMemo(() => {
    if (vuelosActivosSnapshot.length === 0) return 0;
    const total = vuelosActivosSnapshot.reduce((acum, vuelo) => {
      if (!vuelo.capacidadMax) return acum;
      return acum + (vuelo.cantidadMaletas / vuelo.capacidadMax) * 100;
    }, 0);
    return total / vuelosActivosSnapshot.length;
  }, [vuelosActivosSnapshot]);

  // ============================================================================
  // EL MOTOR GRÁFICO (WebGL Render Loop)
  // ============================================================================
  useEffect(() => {
    let animationFrameId: number;
    let frameContador = 0;

    const animar = () => {
      const map = mapRef.current?.getMap();
      if (!map || !map.isStyleLoaded()) {
        animationFrameId = requestAnimationFrame(animar);
        return;
      }

      const tiempoActual = tiempoSimulacionRef.current;
      const featuresAviones: Feature[] = [];
      const featuresRutas: Feature[] = [];

      vuelosActivosRef.current.forEach((vuelo) => {
        const coordsOrigen = coordsAeropuertos[vuelo.origenIata];
        const coordsDestino = coordsAeropuertos[vuelo.destinoIata];

        if (!coordsOrigen || !coordsDestino) return;

        const inicioMs = (vuelo as any)._salidaEpoch;
        const finMs = (vuelo as any)._llegadaEpoch;
        
        const duracion = finMs - inicioMs;
        let progreso = duracion > 0 ? (tiempoActual - inicioMs) / duracion : 1;
        progreso = Math.max(0, Math.min(1, progreso)); 
        
        const posicionActual = interpolar(coordsOrigen, coordsDestino, progreso);
        const bearing = calcularBearing(coordsOrigen, coordsDestino);

        featuresAviones.push({
          type: 'Feature',
          properties: { ...vuelo, codigoVuelo: String(vuelo.codigoVuelo), bearing, isAirplane: true },
          geometry: { type: 'Point', coordinates: posicionActual }
        });

        if (progreso > 0.001) {
          featuresRutas.push({
            type: 'Feature',
            properties: { estado: vuelo.estado },
            geometry: { type: 'LineString', coordinates: [coordsOrigen, posicionActual] }
          });
        }
      });

      const sourceAviones = map.getSource('aviones-data') as GeoJSONSource;
      const sourceRutas = map.getSource('rutas-data') as GeoJSONSource;

      if (sourceAviones) sourceAviones.setData({ type: 'FeatureCollection', features: featuresAviones });
      if (sourceRutas) sourceRutas.setData({ type: 'FeatureCollection', features: featuresRutas });

      // Aeropuertos: solo actualizar cada 30 frames (~500ms), no cambian posición ni a 60fps
      frameContador++;
      if (frameContador % 30 === 0) {
        const featuresAeropuertos: Feature[] = Object.values(aeropuertosRef.current || {}).map((airport) => ({
          type: 'Feature',
          properties: { ...airport, isAirport: true },
          geometry: { type: 'Point', coordinates: [airport.longitud, airport.latitud] },
        }));
        const sourceAeropuertos = map.getSource('aeropuertos-data') as GeoJSONSource;
        if (sourceAeropuertos) sourceAeropuertos.setData({ type: 'FeatureCollection', features: featuresAeropuertos });
      }

      animationFrameId = requestAnimationFrame(animar);
    };

    animar();
    return () => cancelAnimationFrame(animationFrameId);
  }, [coordsAeropuertos]); // solo depende de coordenadas (estables tras mount)

  // Ruta de envío: solo actualizar cuando featuresRutaEnvio cambia (búsqueda explícita)
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('envio-ruta-data') as GeoJSONSource;
    if (source) source.setData({ type: 'FeatureCollection', features: featuresRutaEnvio });
  }, [featuresRutaEnvio]);

  const handleMouseEnter = (event: MapLayerMouseEvent) => {
    setSelFeature(event.features?.[0] ?? null);
    setShowPopup(true);
    popupRef.current?.trackPointer();
  };

  useEffect(()=>{
    if(imageLoaded && backgroundLoaded)
      syncMaps(mapRef.current,backgroundMapRef.current);
  },[imageLoaded,backgroundLoaded])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* DRAWER PARA AVIONES */}
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

      {/* DRAWER PARA AEROPUERTOS */}
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
        visible={conectado}
      />

      <PanelEnvios aeropuertos={aeropuertosSnapshot} envios={enviosSnapshot} visible={conectado}/>

      <PanelAeropuertos
        aeropuertos={aeropuertosSnapshot}
        visible={conectado}
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
            placeholder="ID de envio"
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
            <div>Estado: {rutaEnvio.estado} · Actual: {rutaEnvio.aeropuertoActual ?? 'N/A'}</div>
            <div style={{ marginTop: 6, maxHeight: 120, overflowY: 'auto' }}>
              {rutaEnvio.escalas.length === 0 ? (
                <div>Sin itinerario asignado.</div>
              ) : rutaEnvio.escalas.map((escala, index) => (
                <div key={`${escala.codigoVuelo}-${index}`}>
                  {index + 1}. Vuelo {escala.codigoVuelo}: {escala.origenIata} - {escala.destinoIata}
                </div>
              ))}
            </div>
            {rutaEnvio.escalas.length > 0 && featuresRutaEnvio.length === 0 && (
              <div style={{ marginTop: 6, color: '#fde68a' }}>
                La ruta tiene escalas, pero faltan coordenadas de aeropuerto para pintarla.
              </div>
            )}
          </div>
        )}
      </div>
      <MapLibre
          ref={backgroundMapRef}
          style={{zIndex:17,position:'absolute'}}
          mapStyle="https://tiles.openfreemap.org/styles/bright"
          onLoad={async (e: MapLibreEvent) => {
            setBackgroundLoaded(true);
          }}
      ></MapLibre>
      <MapLibre
        ref={mapRef}
        style={{position:'absolute',zIndex:18}}
        initialViewState={{ longitude: -75, latitude: -10, zoom: 4 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowPopup(false)}
        onMouseDown={(e: MapLayerMouseEvent) => {
          const feature = e.features?.[0];
          const properties = feature?.properties;
          if (!properties) return;

          // Se discrimina qué tipo de capa interactiva recibió el click
          if (properties.isAirplane) {
            setSelFlight(feature ?? null);
            setPanelOpen(true);
            const coords = obtenerCoordenadasFeature(feature ?? null);
            if (coords) enfocarCoordenadas(coords, 6.5);
          } else if (properties.isAirport) {
            setSelAirport(feature ?? null);
            setAirportPanelOpen(true);
            if (typeof properties.codigoIata === 'string') {
              enfocarAeropuerto(properties.codigoIata);
            }
          }
        }}
        interactiveLayerIds={['point', 'plane']}
        onLoad={async (e: MapLibreEvent) => {
          const map = e.target;
          try {
            if (!map.hasImage('airplane')) {
              const img = await map.loadImage('/avion.png');     
              map.addImage('airplane', img.data, { sdf: true });
              setImageLoaded(true);
            }
          } catch (err) {
            console.error("Error al inyectar recurso gráfico:", err);
            setImageLoaded(true);
          }
        }}
      >
        <Source id="rutas-data" type="geojson" data={{ type: 'FeatureCollection', features: [] }}>
          <Layer {...layerStyleLine} />
        </Source>

        <Source id="envio-ruta-data" type="geojson" data={{ type: 'FeatureCollection', features: [] }}>
          <Layer {...layerStyleRutaEnvio} />
        </Source>

        <Source id="aeropuertos-data" type="geojson" data={{ type: 'FeatureCollection', features: [] }}>
          <Layer {...layerStyleAeropuertos} />
        </Source>

        {imageLoaded && (
          <Source id="aviones-data" type="geojson" data={{ type: 'FeatureCollection', features: [] }}>
            <Layer {...layerStyleAirplane} />
          </Source>
        )}

        {showPopup && selFeature && (
          <Popup
            longitude={selFeature.geometry.type === 'Point' ? (selFeature.geometry.coordinates[0] as number) : 0}
            latitude={selFeature.geometry.type === 'Point' ? (selFeature.geometry.coordinates[1] as number) : 0}
            anchor="bottom"
            ref={popupRef}
            closeButton={false}
            offset={15}
          >
            {selFeature.properties?.isAirport ? (                        
              <AeropuertoPopupContent 
                codigoIata={selFeature.properties.codigoIata} 
                aeropuertosRef={aeropuertosRef} 
              />
            ) : (
              <div style={{ color: 'black' }}>
                <b>Vuelo {selFeature.properties?.codigoVuelo}</b>
                <p>{selFeature.properties?.origenIata} {'\u2192'} {selFeature.properties?.destinoIata}</p>
                <p>{selFeature.properties?.cantidadMaletas} maletas</p>
              </div>
            )}
          </Popup>
        )}
      </MapLibre>
      <RelojSimulacionOverlay tiempoRef={tiempoSimulacionRef} ocupacionFlota={ocupacionPromedioFlota} />
    </div>
  );
}
