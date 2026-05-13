'use client';

import {
  Map,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Popup,
  PopupInstance,
  Source,
  Layer,
  CircleLayerSpecification, LineLayerSpecification, MapRef,
} from '@vis.gl/react-maplibre';
import {createElement, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Feature, FeatureCollection} from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Aeropuerto, AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import { useSimulacion } from '../hooks/useSimulacion';
import {Evento, EventoVuelo, SimulationEvent} from "@/app/shared/types/Evento";
import {SymbolStyleLayer} from "maplibre-gl/src/style/style_layer/symbol_style_layer";
import {MapLibreEvent, SymbolLayerSpecification} from "maplibre-gl";
import {clamp} from "@mui/utils";
//import AirplaneImage from '@/assets/png/airplane.png';
import {Air} from "@mui/icons-material";
import * as fs from "node:fs";


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
    'icon-image': 'airplane',
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
    _tiempoActual: Date
}

function AvionesSimulacion({aeropuertos,vuelos,_tiempoActual}:AvionesSimulacionProps){
  const SIM_SECONDS_TO_REAL_SECONDS = 6000; //Hardcodeado por el momento, deberia de pasarse como un valor al back
  //const [initTime,setInitTime] = useState(new Date());
  const [actualMs,setActualMs] = useState(0);
  const [tiempoActual,setTiempoActual] = useState(new Date(_tiempoActual));
  const [abortController, setAbortController] = useState(new AbortController());
  const { signal } = abortController;

  useEffect(() => {
    let _now = Date.now();
    //const _actual = new Date(_tiempoActual)
    //let abort = false;
    console.log(Date.now() - _now)
    //const diff = Date.now() - _now
    _now = Date.now();
    let timeout : NodeJS.Timeout | null = null;
    const timer = new Promise(r => {
      timeout = setTimeout(r,1000)
      return timeout
    });
    timer.then(()=>{
      const diff = Date.now() - _now
      /*
      if((new Date(_tiempoActual)).toDateString()!==tiempoActual.toDateString()){
        setActualMs(0)
        setTiempoActual(new Date(_tiempoActual))}
      else setActualMs(actualMs + diff)});*/
      setActualMs(actualMs + diff)
    })
    //cleanup
    return () => {
      if((new Date(_tiempoActual)).toDateString()!==tiempoActual.toDateString()){
        console.log("Siguiente batch");
        if(timeout)clearTimeout(timeout)
        setActualMs(0)
        setTiempoActual(new Date(_tiempoActual))
      }
      //console.log(_actual)
      //console.log(new Date(tiempoActual))
      //if(_actual.toDateString()!=(new Date(tiempoActual)).toDateString())setActualMs(0)
      }
  }, [actualMs,tiempoActual]);
  console.log(`Actual Ms: ${actualMs}`)
  const getPercTraveled = useCallback((flight:EventoVuelo)=>{
    let horaInicio = flight.horaSalida ?? flight.horaSalidaLocal
    let horaFin = flight.horaLlegada ?? flight.horaLlegadaLocal
    if(!horaInicio || !horaFin){return null}
    horaInicio = new Date(horaInicio)
    horaFin = new Date(horaFin)


    const tiempoActualReal = new Date(tiempoActual.getTime()
        + actualMs*SIM_SECONDS_TO_REAL_SECONDS //Ajustar por tiempo elapsado interno
        + 5*60*60*1000 //Ajustar por GMT
    )
    console.log(`Tiempo actual real: ${tiempoActualReal}`)
    console.log(`Hora inicio: ${horaInicio}`)
    console.log(`Dividendo: ${tiempoActualReal.getTime() - horaInicio.getTime()}`)
    console.log(`Divisor: ${horaFin.getTime() - horaInicio.getTime()}`)
    const percTraveled =
        clamp((tiempoActualReal.getTime() - horaInicio.getTime())
            /(horaFin.getTime() - horaInicio.getTime()),0,1)
    console.log(`Porcentaje viajado: ${percTraveled}`)
    return percTraveled
  },[actualMs, tiempoActual])


  const planeCoords = useCallback(
      (flight:EventoVuelo) => {
        const aeropuertoOrigen = aeropuertos.find((e)=>e.codigoIata===flight.origenIata)
        const aeropuertoDestino = aeropuertos.find((e)=>e.codigoIata===flight.destinoIata)
        const origCoords = [aeropuertoOrigen?.longitud ?? 0,aeropuertoOrigen?.latitud ?? 0]
        const destCoords = [aeropuertoDestino?.longitud ?? 0,aeropuertoDestino?.latitud ?? 0]
        const percTraveled = getPercTraveled(flight)
        const res = [
          origCoords[0] + (destCoords[0]-origCoords[0])*(percTraveled??0),
          origCoords[1] + (destCoords[1]-origCoords[1])*(percTraveled??0)
        ]
        console.log(`Porcentaje viajado: ${percTraveled}`)
        console.log(`Coordenadas actuales: ${res}`)
        return res
      }
      ,[aeropuertos, getPercTraveled])

  const initFeatures : Feature[] = [];
  const geojson: FeatureCollection = useMemo(() => ({
    type: 'FeatureCollection',
    features: vuelos.reduce((acum,vuelo) => {
      if((getPercTraveled(vuelo)??1.0)>=1.0)return acum;
      return [...acum,({
        type: 'Feature',
        properties: { ...vuelo,bearing:Math.atan2(
              (aeropuertos.find((e)=>e.codigoIata===vuelo.destinoIata)?.latitud ?? 0)
              - (aeropuertos.find((e)=>e.codigoIata===vuelo.destinoIata)?.latitud ?? 0),
              (aeropuertos.find((e)=>e.codigoIata===vuelo.destinoIata)?.longitud ?? 0)
              - (aeropuertos.find((e)=>e.codigoIata===vuelo.destinoIata)?.longitud ?? 0)
          ) },
        geometry: {
          type: 'Point',
          coordinates: planeCoords(vuelo) ?? [0,0],
        },
      })]
    },initFeatures),
  }), [vuelos,actualMs]);
  return (
      <Source id="aviones-data" type="geojson" data={geojson}>
        <Layer {...layerStyleAirplane} />
      </Source>
  )
}

function RutasSimulacion({aeropuertos}:RutasSimulacionProps){
  //state of current flights
  const [currentFlights,setCurrentFlights] = useState<Record<string, EventoVuelo>>(JSON.parse(localStorage.getItem("currentFlights") ?? "{}"))
  const futureFlightRef = useRef(currentFlights);
  const [initTime,setInitTime] = useState(new Date(localStorage.getItem("fechaInicio") ?? 0));
  console.log("Vuelos actuales")
  console.log(currentFlights)
  //Event handling callback
  const cbEvent = useCallback((_event:Event)=>{
      if(!(_event instanceof SimulationEvent))return;
      const eventoSim = _event as SimulationEvent;
      const evSimArr = eventoSim.event
      const _curFlights = {...futureFlightRef.current};
      for(const evSim of evSimArr){
        if(evSim.tipo === "VUELO_DESPEGA"){
          const evVuelo = evSim as EventoVuelo;
          _curFlights[evVuelo.codigoVuelo] = evVuelo
        }
      }
      setCurrentFlights(_curFlights)
      for(const evSim of evSimArr){
        if(evSim.tipo==="VUELO_ATERRIZA"){
          const evVuelo = evSim as EventoVuelo;
          delete _curFlights[evVuelo.codigoVuelo]
        }
      }
      futureFlightRef.current = _curFlights
      setInitTime(_event.horaActual)
  },[])
  useEffect(()=>{
    console.log("event was subscribed to")
    SimulationEvent.subscribe(cbEvent)
    //Cleanup callback (and persistence in local storage)
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
      <>
        <Source id="vuelos-data" type="geojson" data={geojson}>
          <Layer {...layerStyleLine} />
        </Source>
        <AvionesSimulacion aeropuertos={aeropuertos} vuelos={arrFlights} _tiempoActual={initTime}/>
      </>
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
  /*const mapRef = useRef<MapRef>(null);
  const setMapRef = useCallback((node:MapRef)=>{
    if(node){
      console.log("Sprite agregado")
      node.addSprite("airplane","https://w7.pngwing.com/pngs/303/986/png-transparent-plane-illustration-airplane-computer-icons-avion-angle-monochrome-vehicle-thumbnail.png")
    }
    mapRef.current = node;
  },[])*/

  return (
    <Map
      initialViewState={{ longitude: 0, latitude: 0, zoom: 3.5 }}
      mapStyle="https://demotiles.maplibre.org/style.json"
      onMouseEnter={handleMouseEnter}
      onLoad={async (e:MapLibreEvent)=>{
        //const img: HTMLImageElement = createElement("img",{src:AirplaneImage})
        //const img = fs.readFileSync("../assets/png/airplane.png")
        const img = await e.target.loadImage('http://localhost:3000/airplane.png')

        e.target.addImage("airplane",img.data)
      }}
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