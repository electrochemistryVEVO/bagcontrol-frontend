import {useCallback, useEffect, useState} from 'react';
import { Aeropuerto, AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import {EventoVuelo, SimulationEvent} from "@/app/shared/types/Evento";
import {clamp} from "@mui/utils";

//Este hook va ser para gestionar las listas de aeropuertos y aviones que el frontend va usar para mostrar en el mapa

export function useSimulacion(aeropuertosIniciales: Aeropuerto[]) {
  const [aeropuertos, setAeropuertos] = useState<Record<string, AeropuertoSimulacion>>(
    () => Object.fromEntries(
      aeropuertosIniciales.map(a => [a.codigoIata, { ...a, cantidadAlmacen: 0 }])
    )
  );
  /*
  const cbEvent = useCallback((_event:Event)=>{
    if(!(_event instanceof SimulationEvent))return;
    const eventoSim = _event as SimulationEvent;
    const evSimArr = eventoSim.event
    const _aeropuertos = aeropuertos;
    for(const evSim of evSimArr){
      if(evSim.tipo === "VUELO_DESPEGA" || evSim.tipo === "VUELO_ATERRIZA"){
        const evVuelo = evSim as EventoVuelo;
        let _aeropuertoOrigen = _aeropuertos[evVuelo.origenIata]
        let _aeropuertoDestino = _aeropuertos[evVuelo.destinoIata]
        if(evSim.tipo === "VUELO_DESPEGA"){
          _aeropuertoOrigen.cantidadAlmacen = clamp(_aeropuertoOrigen.cantidadAlmacen - evVuelo.cantidadMaletas);
        }
        else{
          _aeropuertoDestino.cantidadAlmacen += evVuelo.cantidadMaletas;
        }
      }
    }
  },[])
  useEffect(()=>{
    SimulationEvent.subscribe(cbEvent)
    //Cleanup callback
    return ()=>{
      SimulationEvent.unsubscribe(cbEvent)
    }
  },[])*/
  return { aeropuertos: Object.values(aeropuertos) };
}