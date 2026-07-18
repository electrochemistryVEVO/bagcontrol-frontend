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
import { CoordinadorLotes, LoteFisico } from './coordinadorLotes';

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
  const coordinadorLotesRef = useRef<CoordinadorLotes>(new CoordinadorLotes(id));
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
  const [fechaHoraInicioReal, setFechaHoraInicioReal] = useState<string | null>(null);
  const [fechaHoraFinReal, setFechaHoraFinReal] = useState<string | null>(null);
  const saSRef = useRef(SaS);
  const [saActual, setSaActual] = useState(SaS);
  const primerEventoRecibidoRef = useRef(false);
  const primerLoteRecibidoRef = useRef(false);
  const clockEstadoRef = useRef(0); //Tiempo obtenido del estado al iniciar

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

  const sincronizarTiemposReales = useCallback(async () => {
    try {
      const { data } = await SimulacionService.obtenerEstado(id);
      setFechaHoraInicioReal(data.fechaHoraInicioReal ?? null);
      setFechaHoraFinReal(data.fechaHoraFinReal ?? null);
    } catch (error) {
      console.warn('[SIM] No se pudieron sincronizar los timestamps reales:', error);
    }
  }, [id]);

  // ============================================================================
  // Encolar eventos entrantes y gestionar el arranque con búfer de 2 lotes
  // ============================================================================
  const encolarEventos = useCallback((lote: EventoBatch) => {
    if (estadoSimRef.current === 'colapsada') return;
    if (!lote.eventos || !Array.isArray(lote.eventos)) return;
    if (lote.saMs && lote.saMs > 0) {
      const siguienteSa = lote.saMs / 1000;
      saSRef.current = siguienteSa;
      setSaActual(siguienteSa);
    }
    if (!primerLoteRecibidoRef.current) {
      primerLoteRecibidoRef.current = true;
      simTime('primer lote recibido', `numero=${lote.numeroLote} eventos=${lote.eventos.length}`);
    }
    if (!primerEventoRecibidoRef.current && lote.eventos.length > 0) {
      primerEventoRecibidoRef.current = true;
      simTime('primer evento recibido', `tipo=${lote.eventos[0].tipo}`);
    }

    let cambioInmediato = false;
    // 1. Procesar eventos de control (ciclo de vida)
    for (const e of lote.eventos) {
      const tipo = e.tipo;
      switch (tipo) {
        case 'SIMULACION_INICIADA':
          setConectado(true);
          setEstadoSim(modo === '0' ? 'en_vivo' : 'preparando');
          break;
        case 'OPERACION_DIA_ACTIVA':
          setConectado(true);
          setEstadoSim('en_vivo');
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
        case 'REPLANIFICACION_ENVIO': {
          const replanificacion = e as EventoReplanificacionEnvio;
          setReplanificaciones(actuales => [replanificacion, ...actuales].slice(0, 20));
          const envioReplanificado = enviosPlanificados.current[replanificacion.idPedido];
          if (envioReplanificado && envioReplanificado._estado !== 'ENTREGADO') {
            envioReplanificado._estado = replanificacion.estadoNuevo === 'ASIGNADO'
              ? 'PLANIFICADO'
              : 'POR_PLANIFICAR';
            cambioInmediato = true;
          }
          break;
        }
        case 'SIMULACION_DETENIDA':
          //setResumenFinal({vueloFinal:vueloFinalRef.current});
          setEstadoSim('detenida');
          void sincronizarTiemposReales();
          break;
        case 'VUELO_CANCELADO':
          for (const envio of (e as EventoVuelo).codigoEnvios ?? []) {
            const envioAfectado = enviosPlanificados.current[envio];
            if (envioAfectado) {
              envioAfectado._estado = 'POR_PLANIFICAR';
              cambioInmediato = true;
            }
          }
          break;
        case 'ERROR':
          setEstadoSim('error');
          break;
      }
    }

    // Registrar las asignaciones aunque el lote solo contenga eventos de control.
    // Antes este bloque estaba después del retorno temprano y una replanificación
    // podía quedarse indefinidamente como POR_PLANIFICAR.
    for (const envioNuevo of lote.envios || []) {
      const anterior = enviosPlanificados.current[envioNuevo.idPedido];
      const estadoAnterior = anterior?._estado;
      enviosPlanificados.current[envioNuevo.idPedido] = {
        ...anterior,
        ...envioNuevo,
        _estado: estadoAnterior === 'ENTREGADO'
          ? 'ENTREGADO'
          : estadoAnterior === 'EN_CURSO'
            ? 'EN_CURSO'
            : 'PLANIFICADO',
        _llegadaEpoch: anterior?._llegadaEpoch,
      };
      cambioInmediato = true;
    }

    // 2. Filtrar eventos de física (vuelos, aeropuertos)
    const TIPOS_IGNORADOS = [
      'SIMULACION_INICIADA', 'SIMULACION_PAUSADA', 'SIMULACION_EN_PAUSA',
      'SIMULACION_REANUDADA', 'OPERACION_DIA_ACTIVA',
      //'SIMULACION_FINALIZADA', 'COLAPSO_DETECTADO',
      'REPLANIFICACION_ENVIO', 'VUELO_CANCELADO', 'SIMULACION_DETENIDA', 'ERROR',
    ];

    const eventosFiltrados = lote.eventos.filter((e: Evento) => {
      const tipo = e.tipo || (e as EventoConTipoAlternativo).tipoEvento;
      return !TIPOS_IGNORADOS.includes(tipo);
    });

    if (lote.indiceFisico == null) {
      // Los controles pueden elevar versionPlan (p. ej. una cancelación) y deben
      // invalidar inmediatamente el futuro, pero nunca cuentan como lote físico.
      coordinadorLotesRef.current.recibir(lote);
      if (cambioInmediato) onNuevoLoteRef.current?.();
      return;
    }

    // 3. Los controles no ocupan una posición física en el doble buffer.
    const indiceActualAnterior = coordinadorLotesRef.current.loteActual?.indiceFisico;
    const resultado = coordinadorLotesRef.current.recibir({ ...lote, eventos: eventosFiltrados });
    if (resultado.estado !== 'aceptado') {
      if (resultado.estado !== 'duplicado') {
        console.warn(`[SIM-BUFFER] lote descartado: ${resultado.estado}`, {
          indiceFisico: lote.indiceFisico,
          versionPlan: lote.versionPlan,
        });
      }
      if (cambioInmediato) onNuevoLoteRef.current?.();
      return;
    }
    if (resultado.huecoDetectado) {
      console.warn('[SIM-BUFFER] hueco de lote detectado; se conserva el orden sin mezclar eventos');
    }

    const actual = coordinadorLotesRef.current.loteActual;
    if (actual && (indiceActualAnterior == null || resultado.reemplazoActual)) {
      // Una versión nueva de la ventana actual conserva el pasado ya consumido.
      colaEventos.current = actual.eventos.filter(evento =>
        !resultado.reemplazoActual || new Date(evento.fechaHoraEvento).getTime() > tiempoSimulacion.current);
    }
    lotesRecibidosRef.current += 1;

    // 4. Arrancar el motor solo cuando tenemos ≥2 lotes (colchón de seguridad)
    if (['conectando', 'conectado', 'preparando'].includes(estadoSimRef.current)) {
      tiempoSimulacion.current = new Date(colaEventos.current[0].fechaHoraEvento).getTime();
      clockEstadoRef.current = tiempoSimulacion.current;
      simTime('estado cambia de SINCRONIZANDO a EN_EJECUCION', `primerEvento=${colaEventos.current[0].fechaHoraEvento}`);
      setEstadoSim('en_vivo');
    }

    onNuevoLoteRef.current?.();
  }, [setEstadoSim, modo, sincronizarTiemposReales]);

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
            setFechaHoraInicioReal(estado.fechaHoraInicioReal ?? null);
            setFechaHoraFinReal(estado.fechaHoraFinReal ?? null);
            tiempoSimulacion.current = parseFechaInicio(estado.tiempoSimuladoActual ?? estado.fechaInicio);
            clockEstadoRef.current = tiempoSimulacion.current
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
              await sincronizarTiemposReales();
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
      coordinadorLotesRef.current.limpiar();
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
    const msSimuladosPorLote = K * 60 * 1000;   // ej: 120min → 7_200_000 ms
    let running = true;
    let ultimoFrame = Date.now();
    let tickCount = 0;
    let colaEstabaVacia = true;
    let loteStartTime = 0;
    let eventosEnLote = 0;
    let animationId: number | null = null;
    // Opción A: anclar el reloj al tiempo real para evitar drift
    let batchStartTime: number = 0;    // Date.now() cuando el batch empieza
    let batchStartClock: number = 0;   // tiempoSimulacion.current cuando el batch empieza
    let lastElapsed: number = 0;       // para cap de seguridad (evitar saltos por suspense)

    function cargarLotePromovido(lote: LoteFisico) {
      colaEventos.current = [...lote.eventos];
      batchStartTime = Date.now();
      batchStartClock = tiempoSimulacion.current;
      lastElapsed = 0;
      colaEstabaVacia = true;
      onNuevoLoteRef.current?.();
    }

    function tick() {
      if (!running) return;
      //console.log("tock")

      // Re-agendar siempre para mantener el loop vivo a 60fps
      animationId = requestAnimationFrame(tick);

      function elapseTime(){ //Dejar que tiempo transcurra
        // Si no hay anchor (antes del primer lote), inicializar desde clockEstadoRef
        // para que elapsed=~0 y el cap de 200ms no haga saltar el reloj hacia adelante.
        if (batchStartTime === 0 && clockEstadoRef.current > 0) {
          batchStartTime = Date.now();
          batchStartClock = tiempoSimulacion.current;
          lastElapsed = 0;
        }
        const ahora = Date.now();
        const elapsed = ahora - (batchStartTime || clockEstadoRef.current);
        // Cap de seguridad: máximo 200ms por tick para evitar saltos por suspense del sistema
        const safeElapsed = Math.min(elapsed, lastElapsed + 200);
        lastElapsed = safeElapsed;
        const factorAceleracion = modo === '0'
          ? 1
          : msSimuladosPorLote / (saSRef.current * 1000);
        tiempoSimulacion.current = (batchStartClock || clockEstadoRef.current) + safeElapsed * factorAceleracion;
        ultimoFrame = ahora;
      }

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
        const loteActual = coordinadorLotesRef.current.loteActual;
        const fronteraSimulada = loteActual?.ventanaFin
          ? new Date(loteActual.ventanaFin).getTime()
          : Number.NaN;
        if (loteActual && Number.isFinite(fronteraSimulada)) {
          elapseTime();
          if (tiempoSimulacion.current >= fronteraSimulada) {
            tiempoSimulacion.current = fronteraSimulada;
            const promovido = coordinadorLotesRef.current.promover();
            if (promovido) cargarLotePromovido(promovido);
            else ultimoFrame = Date.now();
          }
        } else if(modo==="0") elapseTime();
        else ultimoFrame = Date.now();
        return;
      }
      //vueloFinalRef.current = (colaEventos.current.filter((e)=>e.tipo==="VUELO_ATERRIZA").pop() as EventoVuelo);


      if (colaEstabaVacia) {
        loteStartTime = Date.now();
        eventosEnLote = colaEventos.current.length;
        console.log(`[DIAG-LOTE-INICIO] eventos=${eventosEnLote} | tiempoSim=${new Date(tiempoSimulacion.current).toISOString()}`);
        tickCount = 0;
        // Anclar el batch al tiempo real
        batchStartTime = Date.now();
        batchStartClock = tiempoSimulacion.current;
        console.log(`Modo: ${modo}`)
        lastElapsed = 0;
      }
      colaEstabaVacia = false;

      tickCount++;

      // Opción A: reloj anclado al tiempo real (sin drift)
      elapseTime();
      const tiempoActual = tiempoSimulacion.current;

      for(const key in enviosPlanificados.current){
        const envio = enviosPlanificados.current[key]
        const epoch = envio._llegadaEpoch;
        //console.log(ahora-epoch)
        if(epoch && ((tiempoActual - epoch) > 1000 * 60 * 60 * 168)){
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
          const vuelo = vuelosActivos.current.get(evVuelo.codigoVuelo.toString());
          if(vuelo)console.log(`Vuelo repetido: ${evVuelo.codigoVuelo.toString()}`)
          //if(vuelo)vuelo.cantidadMaletas += evVuelo.cantidadMaletas;
          //else
            vuelosActivos.current.set(evVuelo.codigoVuelo.toString(), evVuelo);
          //Modificar estado de envios
          for(const env of evVuelo.codigoEnvios){
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
          for(const env of evVuelo.codigoEnvios){
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
          void sincronizarTiemposReales();
          procesados++;
          break;
        }
        else if (tipo === "COLAPSO_DETECTADO"){
          setColapso(ev as EventoColapso);
          colaEventos.current = [];
          setEstadoSim('colapsada');
          void sincronizarTiemposReales();
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
  }, [K, modo]); // estadoSim y SA dinámico se acceden mediante refs

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
    fechaHoraInicioReal,
    fechaHoraFinReal,
    saSegundos: saActual,
  };
}
