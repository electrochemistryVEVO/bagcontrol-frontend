'use client';

import {
  Map,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Popup,
  PopupInstance,
  Source,
  Layer,
  CircleLayerSpecification, LineLayerSpecification,
} from '@vis.gl/react-maplibre';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Aeropuerto, AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import { useSimulacion } from '../hooks/useSimulacion';
import {Evento, EventoVuelo, SimulationEvent} from "@/app/shared/types/Evento";
import {SymbolStyleLayer} from "maplibre-gl/src/style/style_layer/symbol_style_layer";
import {SymbolLayerSpecification} from "maplibre-gl";


const layerStyle: CircleLayerSpecification = {
  id: 'point',
  type: 'circle',
  source: 'aeropuertos-data',
  paint: {
    'circle-radius': 10,
    'circle-color': '#007cbf',
  },
};

const layerStyleLine : LineLayerSpecification = {
  id: 'routes',
  type: 'line',
  source : 'vuelos-data',
  paint: {"line-color": "#198EC8"}
}

const layerStyleAirplane : SymbolLayerSpecification = {
  id: 'plane',
  type: 'symbol',
  source: 'aviones-data',
  layout: {
    'icon-image': 'airport',
    'icon-rotate': ['get', 'bearing'],
    'icon-rotation-alignment': 'map',
    'icon-overlap': 'always',
    'icon-ignore-placement': true
  }
}

interface Props {
    aeropuertosIniciales: Aeropuerto[]
}

interface RutasSimulacionProps{
    aeropuertos: Aeropuerto[]

}
interface AvionesSimulacionProps{
    aeropuertos: Aeropuerto[]
    vuelos: EventoVuelo[]
}

function AvionesSimulacion({aeropuertos,vuelos}:AvionesSimulacionProps){
  const SIM_SECONDS_TO_REAL_SECONDS = 300; //Hardcodeado por el momento, deberia de pasarse como un valor al back
  const [initTime,setInitTime] = useState(new Date());

}

function RutasSimulacion({aeropuertos}:RutasSimulacionProps){
  //state of current flights
  const [currentFlights,setCurrentFlights] = useState<Record<string, EventoVuelo>>(JSON.parse(localStorage.getItem("currentFlights") ?? "{}"))
  console.log("Vuelos actuales")
  console.log(currentFlights)
  //Event handling callback
  const cbEvent = useCallback((_event:Event)=>{
      if(!(_event instanceof SimulationEvent))return;
      const eventoSim = _event as SimulationEvent;
      const evSimArr = eventoSim.event
      const _curFlights = {...currentFlights};
      for(const evSim of evSimArr){
        if(evSim.tipo === "VUELO_DESPEGA" || evSim.tipo==="VUELO_ATERRIZA"){
          const evVuelo = evSim as EventoVuelo;
          if(evVuelo.tipo === "VUELO_DESPEGA"){
            _curFlights[evVuelo.codigoVuelo] = evVuelo
          }
          else if(evVuelo.tipo === "VUELO_ATERRIZA"){
            delete _curFlights[evVuelo.codigoVuelo]
          }
        }
      }
      setCurrentFlights(_curFlights)
  },[])
  useEffect(()=>{
    console.log("event was subscribed to")
    SimulationEvent.subscribe(cbEvent)
    //Cleanup callback (and persistence in local storage
    return ()=>{
      SimulationEvent.unsubscribe(cbEvent)
      localStorage.setItem("currentFlights",JSON.stringify(currentFlights))
    }
  },[])
  const arrFlights = Array.from(Object.values(currentFlights))
  const geojson: FeatureCollection = useMemo(() => ({
    type: 'FeatureCollection',
    features: arrFlights.map((flight:EventoVuelo) => ({
      type: 'Feature',
      properties: { ...flight },
      geometry: {
        type: 'LineString',
        coordinates: [[aeropuertos.find((e)=>e.codigoIata===flight.origenIata)?.longitud ?? 0,
          aeropuertos.find((e)=>e.codigoIata===flight.origenIata)?.latitud ?? 0],
        [aeropuertos.find((e)=>e.codigoIata===flight.destinoIata)?.longitud ?? 0,
          aeropuertos.find((e)=>e.codigoIata===flight.destinoIata)?.latitud ?? 0]],
      },
    })),
  }), [arrFlights, aeropuertos]);

  return (
      <Source id="vuelos-data" type="geojson" data={geojson}>
        <Layer {...layerStyleLine} />
      </Source>
  )
}

export function MapaSimulacion({ aeropuertosIniciales }: Props) {

  const { aeropuertos } = useSimulacion(aeropuertosIniciales);

  const [showPopup, setShowPopup] = useState(false);
  const [selAirport, setSelAirport] = useState<MapGeoJSONFeature | null>(null);
  const popupRef = useRef<PopupInstance | null>(null);

  const geojson: FeatureCollection = useMemo(() => ({
    type: 'FeatureCollection',
    features: aeropuertos.map((airport) => ({
      type: 'Feature',
      properties: { ...airport },
      geometry: {
        type: 'Point',
        coordinates: [airport.longitud, airport.latitud],
      },
    })),
  }), [aeropuertos]);

  const handleMouseEnter = (event: MapLayerMouseEvent) => {
    setSelAirport(event.features?.[0] ?? null);
    setShowPopup(true);
    popupRef.current?.trackPointer();
  };

  return (
    <Map
      initialViewState={{ longitude: 0, latitude: 0, zoom: 3.5 }}
      mapStyle="https://demotiles.maplibre.org/style.json"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowPopup(false)}
      interactiveLayerIds={['point']}
    >
      <Source id="aeropuertos-data" type="geojson" data={geojson}>
        <Layer {...layerStyle} />
      </Source>
      <RutasSimulacion aeropuertos={aeropuertos}/>

      {showPopup && selAirport && (
        <Popup
          longitude={selAirport.geometry.type === 'Point' ? (selAirport.geometry.coordinates[0] as number) : 0}
          latitude={selAirport.geometry.type === 'Point' ? (selAirport.geometry.coordinates[1] as number) : 0}
          anchor="bottom"
          ref={popupRef}
          closeButton={false}
        >
          <b>{selAirport.properties?.codigoIata}</b>
          <p>
            {selAirport.properties?.cantidadAlmacen}/
            {selAirport.properties?.capacidadAlmacen} maletas
          </p>
        </Popup>
      )}
    </Map>
  );
}