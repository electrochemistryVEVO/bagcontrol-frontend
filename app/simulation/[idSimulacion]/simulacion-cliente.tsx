'use client';

import {useEffect, useState, useRef, RefObject} from 'react';
import { SimulacionService } from '@/app/services/simulation.service';
import { simulacionWS } from '@/app/services/config/webSocket';
import { Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { MapaSimulacion } from './components/mapa-simulacion';
import {
    Evento,
    EventoAeropuerto,
    EventoBatch,
    EventoBatchSimulation,
    EventoVuelo,
    SimulationEvent
} from "@/app/shared/types/Evento";
import {RespuestaEstadoSimulacionDTO} from "@/app/shared/types/Simulacion";
import {clearInterval} from "node:timers";
import {binarySearch} from "@/app/shared/Utils";

interface Props {
  id: string;
  topic: string;
  aeropuertosIniciales: Aeropuerto[];
}

export function SimulacionCliente({ id, topic, aeropuertosIniciales }: Props) {
  const [conectado, setConectado] = useState(false);
  const arrancadoRef = useRef(false);
  
  // Referencias para llevar la cuenta en consola sin re-renderizar
  const totalLotesRef = useRef(0);
  const totalEventosRef = useRef(0);
  const batchesRef : RefObject<EventoBatch[]> = useRef([]);
  //const eventosRef : RefObject<EventoVuelo[]> = useRef([]);

  useEffect(() => {
    if (!topic || !id) return;

    let timer : NodeJS.Timeout;
    const iniciar = async (initDate : Date,timeScale:number) => {
      simulacionWS.conectar(
        topic, 
        (lote) => {        
          totalLotesRef.current++;
          totalEventosRef.current += lote.cantidadEventos || 0;

          console.log("\n==============================");
          console.log("LOTE RECIBIDO #" + totalLotesRef.current);
          console.log("numeroLote backend:", lote.numeroLote);
          console.log("Ventana:", lote.ventanaInicio + " → " + lote.ventanaFin);
          console.log("Cantidad eventos del lote:", lote.cantidadEventos);
          console.log("Total eventos acumulados:", totalEventosRef.current);
          console.log("==============================");

          if (!Array.isArray(lote.eventos)) {
            console.log("El lote no trae eventos[]:", lote);
            return;
          }
          const _batches_ref = batchesRef.current
          //const _eventosRef = eventosRef.current;
          lote.eventos.forEach((evento: Evento, index: number) => {
            //console.log(`\nEvento ${index + 1} del lote`);
            //console.log("Tipo:", evento.tipo);

            if (evento.tipo === "AEROPUERTO_ACTUALIZADO") {
                const _evento = evento as EventoAeropuerto;

              //console.log("Aeropuerto:", _evento.codigoAeropuerto);
              //console.log("Maletas:", `${_evento.maletasActuales}/${_evento.capacidadAlmacen}`);
              //console.log("Estado:", _evento.estado);
              //console.log("Ocupación:", _evento.porcentajeOcupacion);
            } else if (evento.tipo === "VUELO_DESPEGA" || evento.tipo === "VUELO_ATERRIZA") {
                const _evento = evento as EventoVuelo;
                if(evento.tipo==="VUELO_DESPEGA") {
                    //console.log(`Despega ${_evento.codigoVuelo}`)
                    //_eventosRef.push(_evento);
                    const batch_i = _batches_ref.findIndex(
                        (e:EventoBatch)=>(new Date(e.ventanaInicio) <= new Date(_evento.horaSalidaUtc) && new Date(e.ventanaFin) >= new Date(_evento.horaSalidaUtc)))
                    if(batch_i>=0){
                        _batches_ref[batch_i] = new EventoBatch({
                            numeroLote: _batches_ref[batch_i].numeroLote,
                            ventanaInicio: _batches_ref[batch_i].ventanaInicio,
                            ventanaFin: _batches_ref[batch_i].ventanaFin,
                            cantidadEventos: _batches_ref[batch_i].cantidadEventos+1,
                            eventos: [..._batches_ref[batch_i].eventos,_evento]
                        })
                        //.eventos.push(evento);
                    }
                }
                else{
                    const batch_i = _batches_ref.findIndex(
                        (e:EventoBatch)=>(new Date(e.ventanaInicio) <= new Date(_evento.horaLlegadaUtc) && new Date(e.ventanaFin) >= new Date(_evento.horaLlegadaUtc)))
                    if(batch_i>=0){
                        _batches_ref[batch_i] = new EventoBatch({
                            numeroLote: _batches_ref[batch_i].numeroLote,
                            ventanaInicio: _batches_ref[batch_i].ventanaInicio,
                            ventanaFin: _batches_ref[batch_i].ventanaFin,
                            cantidadEventos: _batches_ref[batch_i].cantidadEventos+1,
                            eventos: [..._batches_ref[batch_i].eventos,_evento]
                        })
                    }
                }
              //console.log("Vuelo:", _evento.codigoVuelo);
              //console.log("Ruta:", `${_evento.origenIata} → ${_evento.destinoIata}`);
              //console.log("Maletas:", _evento.cantidadMaletas);
              //console.log("Hora salida local:", _evento.horaSalidaLocal || _evento.horaSalida);
              //console.log("Hora llegada local:", _evento.horaLlegadaLocal || _evento.horaLlegada);
            } else {
              //console.log(evento);
            }
            //Activar evento

          });
            //eventosRef.current = _eventosRef;
            batchesRef.current = _batches_ref;
            //document.dispatchEvent(new SimulationEvent(lote));
        }, 
        async () => {
          if (!arrancadoRef.current) {
            arrancadoRef.current = true;
            console.log("✅ Suscrito al canal. Llamando a iniciarSimulacion...");
            await SimulacionService.iniciar(id);
            setConectado(true);
          }
        }
      );
      timer = setInterval(()=>{
          console.log(initDate)
          initDate = new Date(initDate.getTime() + timeScale); // Tiempo real
          //Identificar eventos que estan pasando y que pasaran hasta el siguiente intervalo
          console.log(batchesRef.current)
          const realInitDate = new Date(initDate.getTime() + 1000*60*60*5)
          //Fecha de ventana inicio esta en GMT+0, fechas de eventos no lo estan
          let _eventos = batchesRef.current.find(
              (e)=> initDate >= new Date(e.ventanaInicio) && initDate <= new Date(e.ventanaFin)
          )
          if(!_eventos)return;
          //console.log(`Seleccionado: Batch #${_eventos.numeroLote}`)
          let eventos = _eventos.eventos
          //console.log("Fecha inicio de lote:")
          //console.log(_eventos.ventanaInicio)
          //console.log("Fecha fin de lote:")
          //console.log(_eventos.ventanaFin)
          eventos = eventos.filter((e)=>e.tipo === "VUELO_DESPEGA")
          //console.log(eventos)

          //CODIGO DE PRUEBA

          let maxEvento : EventoVuelo | null = null;
          let minEvento : EventoVuelo | null = null;
          const max = eventos.reduce((acum:Date|undefined,val)=> {
              let val_vuelo = val as EventoVuelo;
              const val_HoraSalida = val_vuelo.horaSalidaUtc
                  //|| val_vuelo.horaSalida
              if(!val_HoraSalida)throw new Error("Hora de salida no presente");
              if(!acum)return val_HoraSalida
              if(new Date(acum)<new Date(val_HoraSalida)) {
                  maxEvento = val_vuelo;
                  return val_HoraSalida;
              }
              return acum
          },undefined)
          const min = eventos.reduce((acum:Date|undefined,val)=> {
              let val_vuelo = val as EventoVuelo;
              const val_HoraSalida = val_vuelo.horaSalidaUtc
                  //|| val_vuelo.horaSalida
              if(!val_HoraSalida)throw new Error("Hora de salida no presente");
              if(!acum)return val_HoraSalida
              if(new Date(acum)>new Date(val_HoraSalida)) {
                  minEvento = val_vuelo
                  return val_HoraSalida;
              }
              return acum
          },undefined)
          //console.log(`Fecha maxima de lote: ${max}`)
          //console.log(`gmt: ${aeropuertosIniciales.find((e)=>e.codigoIata===maxEvento?.origenIata)?.gmt}`)
          //console.log(`Fecha minima de lote: ${min}`)
          //console.log(`gmt: ${aeropuertosIniciales.find((e)=>e.codigoIata===minEvento?.origenIata)?.gmt}`)

          //FIN DE CODIGO DE PRUEBA

          //NOTA: Por la confusion en la emision de lotes, no se puede usar binarySearch
          //Sin embargo, queda como posible herramiente en el futuro
          /*
          const index = binarySearch<Evento,Date>(eventos,realInitDate,
              (a,b)=>{
                const _a = a as EventoVuelo;
                let HoraSalida = _a.horaSalidaUtc
                    //|| _a.horaSalida;
                if(!HoraSalida)throw new Error("Hora de salida no presente")
                  //console.log(HoraSalida)
                  const gmt = aeropuertosIniciales.find((e)=>e.codigoIata===_a.origenIata)?.gmt
                  if(typeof gmt === "undefined")throw new Error("Aeropuerto de salida no encontrado");
                  //console.log(`gmt = ${gmt}`)
                  //HoraSalida = new Date((new Date(HoraSalida)).getTime() - 1000*60*60*(gmt))
                  //console.log(HoraSalida)
                  const res = Math.floor((b.getTime() - (HoraSalida.getTime()))/timeScale);
                  //console.log(res)
                return res
              })*/
          let minValue = Number.MAX_VALUE;
          const eventsToSpawn = eventos.filter((e:Evento) => {
              if(e.tipo !== "VUELO_DESPEGA" && e.tipo !== "VUELO_ATERRIZA")return false;
              const _e = e as EventoVuelo;
              const dif = e.tipo === "VUELO_DESPEGA"
              ? Math.abs((new Date(_e.horaSalidaUtc)).getTime() - (new Date(initDate)).getTime())
              : Math.abs((new Date(_e.horaLlegadaUtc)).getTime() - (new Date(initDate)).getTime());
              minValue = dif < minValue ? dif : minValue
              return dif <= timeScale;
          })
          console.log(`Closest distance to an event (in seconds): ${Math.round(minValue/1000)}`)
          console.log(eventsToSpawn)
          //Borrar eventos que ya pasaron (como no se puede asegurar el orden, esto tampoco se puede realizar)
          /*
          for(let i=0;i<index;i++){
              const _eventos_i = eventos[i] as EventoVuelo
              let HoraLlegada = _eventos_i.horaLlegadaLocal
                  //|| _eventos_i.horaLlegada;
              if(!HoraLlegada)throw new Error("Hora de llegada no presente")
              //Ajustar por gmt
              //const gmt = aeropuertosIniciales.find((e)=>e.codigoIata===_eventos_i.destinoIata)?.gmt
              //if(typeof gmt === "undefined")throw new Error("Aeropuerto de llegada no encontrado");
              //HoraLlegada = new Date((new Date(HoraLlegada)).getTime() + 1000*60*60*gmt)
              if(HoraLlegada<=realInitDate)delete eventos[i];
          }*/
          //const eventsToSpawn = eventos.slice(0,index);
          //console.log(eventsToSpawn)
          //Presentar lista de eventos a componentes
          console.log("Event dispatched!")
          document.dispatchEvent(new SimulationEvent(new EventoBatchSimulation(initDate,eventsToSpawn)))
      },1000);
    };

    //Falta: Error handling
    SimulacionService.obtenerEstado(id)
        .then(({data})=> {
            console.log(data)
            console.log(`Tiempo actual: ${data.fechaInicio}`)
            console.log(`Escala de tiempo: 1:${data.k}`)
            if(!data.detenida && !data.pausada) {
                let _date = new Date(data.fechaInicio);
                let i=1;
                const _batches_ref : EventoBatch[] = [];
                while(i<30){
                    const _next_date = new Date(_date.getTime() + 1000*60*60*5)
                    //NOTA: Para el caso de hasta el colapso, setear un numero fijo de batches
                    //Agregar nuevos batches e ir removiendo los primeros a medida que aumenta la cantidad
                    _batches_ref.push(new EventoBatch({
                        numeroLote: String(i),
                        ventanaInicio: _date,
                        ventanaFin: _next_date,
                        cantidadEventos: 0,
                        eventos: []
                    }))
                    //Ventanas son 5 horas cada una
                    i++;
                    _date = _next_date;
                }
                console.log("NUmero inicial de batches:")
                console.log(_batches_ref)
                batchesRef.current = _batches_ref;
                iniciar(new Date(data.fechaInicio), data.k*1000)
            }
        });
    //iniciar();

    return () => {
      simulacionWS.desconectar();
      if(timer)clearInterval(timer);
      batchesRef.current = [];
      arrancadoRef.current = false;
    };
  }, [id, topic]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1rem', background: '#1e293b', color: 'white' }}>
        <span>ID Simulación: {id}</span>
        <span style={{ marginLeft: '20px', color: conectado ? '#4ade80' : '#f87171' }}>
          ● {conectado ? 'En vivo' : 'Sincronizando...'}
        </span>
      </header>

      <div style={{ flex: 1 }}>
        <MapaSimulacion aeropuertosIniciales={aeropuertosIniciales} />
      </div>
    </div>
  );
}