import { useEffect, useState, useRef, useCallback } from 'react';
import { simulacionWS } from '@/app/services/config/webSocket';
import { SimulacionService } from '@/app/services/simulation.service';
import { Aeropuerto, AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import {
  Evento,
  EventoVuelo,
  EventoAeropuerto,
  EventoBatch,
  EventoColapso,
  EventoReplanificacionEnvio,
} from "@/app/shared/types/Evento";
import axios from 'axios';
import {Envio} from "@/app/shared/types/Envio";
import { obtenerEstadoAeropuerto } from '@/app/shared/simulation/semaforo';
import {ResumenFinalSimulacion} from "@/app/shared/types/Simulacion";

export type EstadoSimulacion = 'conectando' | 'conectado' | 'preparando' | 'en_vivo' | 'pausada' | 'detenida' | 'finalizada' | 'colapsada' | 'error';
type EventoConTipoAlternativo = Evento & { tipoEvento?: string };

const simTime = (mensaje: string, extra = '') => {
  console.log(`[FRONT-SIM-TIME] ${new Date().toISOString()} ${mensaje}${extra ? ` ${extra}` : ''}`);
};

export function useSimulacion(
  id: string,
  topic: string,
  aeropuertosIniciales: Aeropuerto[],
  K: number,
  SaS: number,
  fechaInicio: string,
  modo: string = '',
  onNuevoLote?: () => void
) {
  const [conectado, setConectado] = useState(false);
  const arrancadoRef = useRef(false);
  const vuelosActivos = useRef<Map<string, EventoVuelo>>(new Map());
  const enviosPlanificados = useRef<Record<string,Envio>>({});
  const colaEventos = useRef<Evento[]>([]);
  const parseFechaInicio = (value: string) => {
    const normalizada = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
    const epoch = new Date(normalizada).getTime();
    return Number.isFinite(epoch) ? epoch : Date.now();
  };
  const tiempoSimulacion = useRef<number>(parseFechaInicio(fechaInicio));
  const lotesRecibidosRef = useRef<number>(0);
  const [colapso, setColapso] = useState<EventoColapso | null>(null);
  const [replanificaciones, setReplanificaciones] = useState<EventoReplanificacionEnvio[]>([]);
  const [mensajeErrorSimulacion, setMensajeErrorSimulacion] = useState<string | null>(null);
  const primerEventoRecibidoRef = useRef(false);
  const primerLoteRecibidoRef = useRef(false);

  const onNuevoLoteRef = useRef(onNuevoLote);
  useEffect(() => { onNuevoLoteRef.current = onNuevoLote; }, [onNuevoLote]);

  const aeropuertosSimulacion = useRef<Record<string, AeropuertoSimulacion>>(
    Object.fromEntries(
      aeropuertosIniciales.map(a => [
        a.codigoIata?.trim().toUpperCase(),
        { ...a, maletasActuales: 0, porcentajeOcupacion: 0, estadoCapacidad: 'VACIO', enviosProximosAVencer: [], tieneDatos: false }
      ])
    )
  );

  // ─── Estado dual: ref para el motor (sin closure stale), state para la UI ───
  const estadoSimRef = useRef<EstadoSimulacion>('conectando');
  const [estadoSim, setEstadoSimInterno] = useState<EstadoSimulacion>('conectando');

  // Resumen final, y referencias necesarias
  const [resumenFinal,setResumenFinal] = useState<ResumenFinalSimulacion | null>(null);
  const vueloFinalRef = useRef<EventoVuelo | null>(null);


  const setEstadoSim = useCallback((nuevoEstado: EstadoSimulacion) => {
    if (estadoSimRef.current !== nuevoEstado) {
      simTime(`estado cambia de ${estadoSimRef.current.toUpperCase()} a ${nuevoEstado.toUpperCase()}`);
    }
    estadoSimRef.current = nuevoEstado;
    setEstadoSimInterno(nuevoEstado);
  }, []);

  // ============================================================================
  // Encolar eventos entrantes y gestionar el arranque con búfer de 2 lotes
  // ============================================================================
  const encolarEventos = useCallback((lote: EventoBatch) => {
    if (!lote.eventos || !Array.isArray(lote.eventos)) return;
    if (!primerLoteRecibidoRef.current) {
      primerLoteRecibidoRef.current = true;
      simTime('primer lote recibido', `numero=${lote.numeroLote} eventos=${lote.eventos.length}`);
    }
    if (!primerEventoRecibidoRef.current && lote.eventos.length > 0) {
      primerEventoRecibidoRef.current = true;
      simTime('primer evento recibido', `tipo=${lote.eventos[0].tipo}`);
    }

    // 1. Procesar eventos de control (ciclo de vida)
    for (const e of lote.eventos) {
      const tipo = e.tipo;
      switch (tipo) {
        case 'SIMULACION_INICIADA':
          setConectado(true);
          setEstadoSim('preparando');
          break;
        case 'SIMULACION_PAUSADA':
        case 'SIMULACION_EN_PAUSA':
          setEstadoSim('pausada');
          break;
        case 'SIMULACION_REANUDADA':
          setEstadoSim('en_vivo');
          break;
          /*
        case 'SIMULACION_FINALIZADA':
          setResumenFinal({vueloFinal:vueloFinalRef.current});
          setEstadoSim('finalizada');
          break;
        case 'COLAPSO_DETECTADO':
          setColapso(e as EventoColapso);
          setEstadoSim('colapsada');
          break;*/
        case 'REPLANIFICACION_ENVIO':
          setReplanificaciones(actuales => [e as EventoReplanificacionEnvio, ...actuales].slice(0, 20));
          break;
        case 'SIMULACION_DETENIDA':
          //setResumenFinal({vueloFinal:vueloFinalRef.current});
          setEstadoSim('detenida');
          break;
        case 'ERROR':
          setEstadoSim('error');
          break;
      }
    }

    // 2. Filtrar eventos de física (vuelos, aeropuertos)
    const TIPOS_IGNORADOS = [
      'SIMULACION_INICIADA', 'SIMULACION_PAUSADA', 'SIMULACION_EN_PAUSA',
      'SIMULACION_REANUDADA',
      //'SIMULACION_FINALIZADA', 'COLAPSO_DETECTADO',
      'REPLANIFICACION_ENVIO', 'SIMULACION_DETENIDA', 'ERROR',
    ];

    const eventosFiltrados = lote.eventos.filter((e: Evento) => {
      const tipo = e.tipo || (e as EventoConTipoAlternativo).tipoEvento;
      return !TIPOS_IGNORADOS.includes(tipo);
    });

    if (eventosFiltrados.length === 0) return;

    // 3. Acumular en la cola
    colaEventos.current.push(...eventosFiltrados);
    lotesRecibidosRef.current += 1;

    // 4. Arrancar el motor solo cuando tenemos ≥2 lotes (colchón de seguridad)
    if (['conectando', 'conectado', 'preparando'].includes(estadoSimRef.current)) {
      tiempoSimulacion.current = new Date(colaEventos.current[0].fechaHoraEvento).getTime();
      simTime('estado cambia de SINCRONIZANDO a EN_EJECUCION', `primerEvento=${colaEventos.current[0].fechaHoraEvento}`);
      setEstadoSim('en_vivo');
    }

    // 5. Agregar eventos planificados
    enviosPlanificados.current = {...enviosPlanificados.current,
    ...(lote.envios || []).reduce((acum:Record<string, Envio>,val)=>{
      (val as any)._estado = "PLANIFICADO"
      acum[val.idPedido] = val;
      return acum;},{})};

    onNuevoLoteRef.current?.();
  }, [setEstadoSim]);

  // ============================================================================
  // Conexión WebSocket
  // ============================================================================
  useEffect(() => {
    if (!topic || !id) return;
    simTime('page mounted', `id=${id}`);
    simTime('conectando WebSocket', `topic=${topic}`);

    simulacionWS.conectar(
        id,
      topic,
      encolarEventos,
      async () => {
        if (!arrancadoRef.current) {
          arrancadoRef.current = true;
          try {
            setMensajeErrorSimulacion(null);
            simTime('solicitando estado/snapshot');
            const { data: estado } = await SimulacionService.obtenerEstado(id);
            if (estado.tiempoSimuladoActual) {
              tiempoSimulacion.current = parseFechaInicio(estado.tiempoSimuladoActual);
            }
            if (estado.estado && estado.estado !== 'CREADA') {
              setEstadoSim(estado.pausada ? 'pausada' : estado.detenida ? 'detenida' : 'preparando');
              try {
                const { data: snapshot } = await SimulacionService.obtenerSnapshot(id);
                simTime('snapshot recibido', `numero=${snapshot?.numeroLote ?? 'n/a'} eventos=${snapshot?.eventos?.length ?? 0}`);
                if (snapshot?.eventos?.length) encolarEventos(snapshot);
              } catch (snapshotError) {
                console.warn('[WS] No se pudo cargar snapshot inicial:', snapshotError);
              }
            } else {
              await SimulacionService.iniciar(id);
            }
          } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              const mensaje = 'La simulacion no existe o el backend fue reiniciado. Vuelve a preparar una simulacion.';
              console.warn('[WS] Simulacion no encontrada al iniciar visualizador:', {
                idSimulacion: id,
                status: error.response.status,
                url: error.config?.url,
              });
              setMensajeErrorSimulacion(mensaje);
              setEstadoSim('error');
              setConectado(false);
              return;
            }
            if (!axios.isAxiosError(error) || error.response?.status !== 409) {
              console.error('[WS] Error al iniciar la simulación:', error);
              arrancadoRef.current = false;
              return;
            }
            // 409 = ya estaba corriendo, ignorar
          }
          setConectado(true);
          if (estadoSimRef.current === 'conectando') setEstadoSim('conectado');
        }
      }
    );

    return () => {
      simulacionWS.desconectar(id);
      colaEventos.current = [];
      lotesRecibidosRef.current = 0;
      arrancadoRef.current = false;
      primerEventoRecibidoRef.current = false;
      primerLoteRecibidoRef.current = false;
    };
  }, [id, topic, encolarEventos]);

  // ============================================================================
  // Motor lógico — intervalo estable, lee estadoSimRef para evitar closure stale
  // ============================================================================
  useEffect(() => {
    const msSimuladosPorLote = K * 60 * 1000;   // ej: 90min → 5_400_000 ms
    const msRealesPorLote    = SaS * 1000;       // ej: 90s  →    90_000 ms
    // En operación día a día, el reloj debe avanzar en tiempo real (1s real = 1s sim)
    // independientemente de K y SaS, para que un vuelo de 2h demore 2h reales
    const factorAceleracion  = modo === '0'
      ? 1
      : msSimuladosPorLote / msRealesPorLote;
    let running = true;
    let ultimoFrame = Date.now();
    let tickCount = 0;
    let colaEstabaVacia = true;
    let loteStartTime = 0;
    let eventosEnLote = 0;
    let animationId: number | null = null;

    function tick() {
      if (!running) return;

      // Re-agendar siempre para mantener el loop vivo a 60fps
      animationId = requestAnimationFrame(tick);

      if (estadoSimRef.current !== 'en_vivo') {
        ultimoFrame = Date.now();
        return;
      }
      if (colaEventos.current.length === 0) {
        if (!colaEstabaVacia) {
          console.log(`[DIAG-LOTE-FIN] duracionReal=${Date.now() - loteStartTime}ms | ticksUsados=${tickCount} | tiempoSim=${new Date(tiempoSimulacion.current).toISOString()}`);
          tickCount = 0;
        }
        colaEstabaVacia = true;
        ultimoFrame = Date.now();
        return;
      }
      //vueloFinalRef.current = (colaEventos.current.filter((e)=>e.tipo==="VUELO_ATERRIZA").pop() as EventoVuelo);

      if (colaEstabaVacia) {
        loteStartTime = Date.now();
        eventosEnLote = colaEventos.current.length;
        console.log(`[DIAG-LOTE-INICIO] eventos=${eventosEnLote} | tiempoSim=${new Date(tiempoSimulacion.current).toISOString()}`);
        tickCount = 0;
      }
      colaEstabaVacia = false;

      tickCount++;

      const ahora = Date.now();
      tiempoSimulacion.current += (ahora - ultimoFrame) * factorAceleracion;
      ultimoFrame = ahora;
      const tiempoActual = tiempoSimulacion.current;

      for(let key in enviosPlanificados.current){
        const envio = enviosPlanificados.current[key]
        const epoch = envio._llegadaEpoch;
        //console.log(ahora-epoch)
        if(epoch && ((tiempoActual - epoch) >= 1000*60*60*4)){
          console.log(`${envio.idPedido} eliminado`)
          delete enviosPlanificados.current[key]
        }
      }

      let procesados = 0;
      while (colaEventos.current.length > 0) {
        const evento = colaEventos.current[0];
        const horaEvento = new Date(evento.fechaHoraEvento).getTime();
        if (horaEvento > tiempoActual) break;

        const ev = colaEventos.current.shift()!;
        const tipo = ev.tipo || (ev as EventoConTipoAlternativo).tipoEvento;

        if (tipo === 'VUELO_DESPEGA') {
          const evVuelo = ev as EventoVuelo;
          (evVuelo as any)._salidaEpoch = new Date(evVuelo.horaSalidaUtc).getTime();
          (evVuelo as any)._llegadaEpoch = new Date(evVuelo.horaLlegadaUtc).getTime()
          let vuelo = vuelosActivos.current.get(evVuelo.codigoVuelo.toString());
          if(vuelo)console.log(`Vuelo repetido: ${evVuelo.codigoVuelo.toString()}`)
          //if(vuelo)vuelo.cantidadMaletas += evVuelo.cantidadMaletas;
          //else
            vuelosActivos.current.set(evVuelo.codigoVuelo.toString(), evVuelo);
          //Modificar estado de envios
          for(let env of evVuelo.codigoEnvios){
            const _envio = enviosPlanificados.current[env]
            if(_envio){ //Vuelo es el primero
              _envio._estado = "EN_CURSO"
              enviosPlanificados.current[env] = _envio;
            }
          }
        } else if (tipo === 'VUELO_ATERRIZA') {
          const evVuelo = ev as EventoVuelo;
          vueloFinalRef.current = evVuelo;
          vuelosActivos.current.delete(evVuelo.codigoVuelo.toString());
          //Modificar estado de envios
          for(let env of evVuelo.codigoEnvios){
            const _envio = enviosPlanificados.current[env]
            if(_envio && _envio.destinoIata === evVuelo.destinoIata){ //Vuelo es el ultimo
              _envio._estado = "ENTREGADO";
              _envio._llegadaEpoch = tiempoActual;
              enviosPlanificados.current[env] = _envio;
            }
          }
        } else if (tipo === 'AEROPUERTO_ACTUALIZADO') {
          const evAero = ev as EventoAeropuerto;
          const codigo = evAero.codigoAeropuerto?.trim().toUpperCase();
          if (aeropuertosSimulacion.current[codigo]) {
            aeropuertosSimulacion.current[codigo].maletasActuales     = evAero.maletasActuales;
            aeropuertosSimulacion.current[codigo].porcentajeOcupacion = evAero.porcentajeOcupacion;
            aeropuertosSimulacion.current[codigo].estadoCapacidad     = obtenerEstadoAeropuerto({
              ...aeropuertosSimulacion.current[codigo],
              maletasActuales: evAero.maletasActuales,
              porcentajeOcupacion: evAero.porcentajeOcupacion,
              estadoCapacidad: evAero.estadoCapacidad,
            });
            aeropuertosSimulacion.current[codigo].enviosProximosAVencer = evAero.enviosProximosAVencer || [];
            aeropuertosSimulacion.current[codigo].tieneDatos = true;
          }
        }
        else if (tipo === "SIMULACION_FINALIZADA"){
          setResumenFinal({vueloFinal:vueloFinalRef.current});
          setEstadoSim('finalizada');
          procesados++;
          break;
        }
        else if (tipo === "COLAPSO_DETECTADO"){
          setColapso(ev as EventoColapso);
          setEstadoSim('colapsada');
          procesados++;
          break;
        }
        procesados++;
      }

      if (tickCount % 1800 === 0) {
        console.log(`[DIAG-TICK] frame=${tickCount} | procesados=${procesados} | enCola=${colaEventos.current.length} | tiempoSim=${new Date(tiempoSimulacion.current).toISOString()}`);
      }
    }

    animationId = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [K, SaS]); // ← estadoSim FUERA de deps; se accede via ref

  return {
    conectado,
    estadoSim,
    setEstadoSim,
    aeropuertosRef: aeropuertosSimulacion,
    vuelosActivosRef: vuelosActivos,
    enviosPlanificadosRef : enviosPlanificados,
    tiempoSimulacionRef: tiempoSimulacion,
    colapso,
    resumenFinal,
    replanificaciones,
    mensajeErrorSimulacion,
  };
}
