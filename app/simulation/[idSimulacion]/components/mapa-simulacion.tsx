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
import { useMemo, useRef, useState, useEffect, RefObject } from 'react';
import { FeatureCollection, Feature } from 'geojson';
import { MapLibreEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { AeropuertoSimulacion, Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { EventoVuelo } from "@/app/shared/types/Evento";
import { AeropuertoPopupContent } from './pop-up-aeropuerto';
import { RelojSimulacionOverlay } from './reloj-simulacion';
import AvionSidePanel, {useOpenPanel} from "@/app/simulation/components/avion-sidepanel";
import {Drawer} from "@mui/material";
import globals from '../../../globals.css';

// ============================================================================
// 1. ESTILOS DE CAPAS (Layers)
// ============================================================================
const layerStyleAeropuertos: CircleLayerSpecification = {
  id: 'point',
  type: 'circle',
  source: 'aeropuertos-data',
  paint: {
    'circle-radius': 8,
    // Sincronizado con el DTO del backend usando 'estadoCapacidad'
    'circle-color': [
      'match',
      ['get', 'estadoCapacidad'],
      'ROJO', '#ef4444',
      'AMARILLO', '#eab308',
      'VERDE', '#22c55e',
      '#007cbf' // Fallback
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
    "line-color":[
      'match',
      ['get', 'estado'],
      'ROJO', '#ef4444',
      'AMARILLO', '#eab308',
      'VERDE', '#22c55e',
      '#007cbf' // Fallback
    ],
    "line-width": 2,
    "line-opacity": 0.6,
    "line-dasharray": [2, 2]
  }
};

const layerStyleAirplane: SymbolLayerSpecification = {
  id: 'plane',
  type: 'symbol',
  source: 'aviones-data',
  paint: {
    'icon-opacity': 1,
    'icon-color':[
      'match',
      ['get', 'estado'],
      'ROJO', '#ef4444',
      'AMARILLO', '#eab308',
      'VERDE', '#22c55e',
      '#007cbf' // Fallback
    ],
    'icon-opacity-transition': { duration: 0 } // Eliminamos el delay de 300ms de MapLibre
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

// ============================================================================
// 2. FUNCIONES MATEMÁTICAS (Helpers)
// ============================================================================
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
  
  // Ajuste matemático de 180 grados para corregir la inversión de dirección de iconos que miran al norte
  return 90 - theta
}

// ============================================================================
// 3. COMPONENTE PRINCIPAL
// ============================================================================
interface Props {
  aeropuertosIniciales: Aeropuerto[];
  aeropuertosRef: RefObject<Record<string, AeropuertoSimulacion>>; // Recibe la referencia en memoria RAM
  vuelosActivosRef: RefObject<Map<string, EventoVuelo>>;
  tiempoSimulacionRef: RefObject<number>;
  idSimulacion: string;
}

export function MapaSimulacion({ aeropuertosIniciales, aeropuertosRef, vuelosActivosRef, tiempoSimulacionRef,idSimulacion }: Props) {
  const mapRef = useRef<MapRef>(null);
  const popupRef = useRef<PopupInstance | null>(null);
  
  const [showPopup, setShowPopup] = useState(false);
  const [selFeature, setSelFeature] = useState<MapGeoJSONFeature | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Logica de panel para los aviones
  //const openPanel = useOpenPanel();
  const [panelOpen,setPanelOpen] = useState(false);
  const [selFlight,setSelFlight] = useState<MapGeoJSONFeature|null>(null);

  // Diccionario ultra-rápido para coordenadas estáticas
  const coordsAeropuertos = useMemo(() => {
    const dict: Record<string, number[]> = {};
    aeropuertosIniciales.forEach(a => {
      dict[a.codigoIata] = [a.longitud, a.latitud];
    });
    return dict;
  }, [aeropuertosIniciales]);

  // ============================================================================
  // 4. EL MOTOR GRÁFICO (WebGL Loop)
  // FIX: Se agregó `imageLoaded` a las dependencias para que el loop de animación
  // se reinicie una vez que la Source 'aviones-data' exista en el mapa.
  // Sin esto, el loop arrancaba antes de que la Source fuera montada (porque
  // dependía del condicional `{imageLoaded && <Source ...>}`), y
  // map.getSource('aviones-data') devolvía undefined en cada frame.
  // ============================================================================
  useEffect(() => {
    let animationFrameId: number;

    const animar = () => {
      const map = mapRef.current?.getMap();
      if (!map || !map.isStyleLoaded()) {
        animationFrameId = requestAnimationFrame(animar);
        return;
      }

      const tiempoActual = tiempoSimulacionRef.current;
      const featuresAviones: Feature[] = [];
      const featuresRutas: Feature[] = [];

      // 1. Procesar y animar vuelos activos
      vuelosActivosRef.current.forEach((vuelo) => {
        const coordsOrigen = coordsAeropuertos[vuelo.origenIata];
        const coordsDestino = coordsAeropuertos[vuelo.destinoIata];

        if (!coordsOrigen || !coordsDestino) return;

        const inicioMs = new Date(vuelo.horaSalidaUtc).getTime();
        const finMs = new Date(vuelo.horaLlegadaUtc).getTime();
        
        const duracion = finMs - inicioMs;
        let progreso = duracion > 0 ? (tiempoActual - inicioMs) / duracion : 1;
        progreso = Math.max(0, Math.min(1, progreso)); 
        
        const posicionActual = interpolar(coordsOrigen, coordsDestino, progreso);
        const bearing = calcularBearing(coordsOrigen, coordsDestino);
        // Feature del Avión
        featuresAviones.push({
          type: 'Feature',
          properties: { ...vuelo, bearing, isAirplane: true },
          geometry: { type: 'Point', coordinates: posicionActual }
        });

        // Feature de la Ruta Dinámica progresiva (crece junto al avión)
        if (progreso > 0.001) {
          featuresRutas.push({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [coordsOrigen, posicionActual] }
          });
        }
      });

      // 2. Extraer y construir la data de Aeropuertos en caliente desde la referencia RAM
      const featuresAeropuertos: Feature[] = Object.values(aeropuertosRef.current || {}).map((airport) => ({
        type: 'Feature',
        properties: { ...airport, isAirport: true },
        geometry: { type: 'Point', coordinates: [airport.longitud, airport.latitud] },
      }));

      // 3. Inyección síncrona simultánea a las fuentes WebGL
      const sourceAviones = map.getSource('aviones-data') as maplibregl.GeoJSONSource;
      const sourceRutas = map.getSource('rutas-data') as maplibregl.GeoJSONSource;
      const sourceAeropuertos = map.getSource('aeropuertos-data') as maplibregl.GeoJSONSource;

      if (sourceAviones) sourceAviones.setData({ type: 'FeatureCollection', features: featuresAviones });
      if (sourceRutas) sourceRutas.setData({ type: 'FeatureCollection', features: featuresRutas });
      if (sourceAeropuertos) sourceAeropuertos.setData({ type: 'FeatureCollection', features: featuresAeropuertos });

      animationFrameId = requestAnimationFrame(animar);
    };

    animar();
    return () => cancelAnimationFrame(animationFrameId);
  }, [coordsAeropuertos, vuelosActivosRef, tiempoSimulacionRef, aeropuertosRef, imageLoaded]); // <-- FIX: imageLoaded agregado

  // ============================================================================
  // 5. EVENTOS DE INTERACCIÓN (Hover y Popups)
  // ============================================================================
  const handleMouseEnter = (event: MapLayerMouseEvent) => {
    setSelFeature(event.features?.[0] ?? null);
    setShowPopup(true);
    popupRef.current?.trackPointer();
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Drawer open={panelOpen} onClose={()=>{setPanelOpen(false)}}>
        <AvionSidePanel openPanel={panelOpen} selFlight={selFlight} idSimulacion={idSimulacion} aeropuertos={aeropuertosIniciales}/>
      </Drawer>
      <MapLibre
        ref={mapRef}
        initialViewState={{ longitude: -75, latitude: -10, zoom: 4 }} 
        mapStyle="https://tiles.openfreemap.org/styles/bright"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowPopup(false)}
        onMouseDown={(e:MapLayerMouseEvent)=> {
          const properties = e.features?.[0]?.properties;
          if (!(properties?.isAirplane)) return;
          setSelFlight(e.features?.[0] ?? null);
          setPanelOpen(true)
        }}
        interactiveLayerIds={['point', 'plane']}
        onLoad={async (e: MapLibreEvent) => {
          const map = e.target;
          if (!map.hasImage('airplane')) {
            const img = await map.loadImage('/avion.png');     
            map.addImage('airplane', img.data,{sdf:true})
            console.log("image is loaded")
            setImageLoaded(true);
          }
        }}
      >
        <Source id="rutas-data" type="geojson" data={{ type: 'FeatureCollection', features: [] }}>
          <Layer {...layerStyleLine} />
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
      <RelojSimulacionOverlay tiempoRef={tiempoSimulacionRef} />
    </div>
  );
}
