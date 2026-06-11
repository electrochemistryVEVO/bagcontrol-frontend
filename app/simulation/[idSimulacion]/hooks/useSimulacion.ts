import { useEffect, useState, useRef, useCallback } from 'react';
import { simulacionWS } from '@/app/services/config/webSocket';
import { SimulacionService } from '@/app/services/simulation.service';
import { Aeropuerto, AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import {
  Evento,
  EventoVuelo,
  EventoAeropuerto,
  EventoBatch,
} from "@/app/shared/types/Evento";
import axios from 'axios';

export type EstadoSimulacion = 'sincronizando' | 'en_vivo' | 'pausada' | 'detenida' | 'finalizada' | 'error';
type EventoConTipoAlternativo = Evento & { tipoEvento?: string };

export function useSimulacion(
  id: string,
  topic: string,
  aeropuertosIniciales: Aeropuerto[],
  K: number,
  SaS: number,
  fechaInicio: string,
  onNuevoLote?: () => void
) {
  const [conectado, setConectado] = useState(false);
  const arrancadoRef = useRef(false);
  const vuelosActivos = useRef<Map<string, EventoVuelo>>(new Map());
  const colaEventos = useRef<Evento[]>([]);
  const tiempoSimulacion = useRef<number>(new Date(fechaInicio).getTime());
  const lotesRecibidosRef = useRef<number>(0);

  const onNuevoLoteRef = useRef(onNuevoLote);
  useEffect(() => { onNuevoLoteRef.current = onNuevoLote; }, [onNuevoLote]);

  const aeropuertosSimulacion = useRef<Record<string, AeropuertoSimulacion>>(
    Object.fromEntries(
      aeropuertosIniciales.map(a => [
        a.codigoIata?.trim().toUpperCase(),
        { ...a, maletasActuales: 0, porcentajeOcupacion: 0, estadoCapacidad: 'VERDE', enviosProximosAVencer: [] }
      ])
    )
  );

  // ─── Estado dual: ref para el motor (sin closure stale), state para la UI ───
  const estadoSimRef = useRef<EstadoSimulacion>('sincronizando');
  const [estadoSim, setEstadoSimInterno] = useState<EstadoSimulacion>('sincronizando');

  const setEstadoSim = useCallback((nuevoEstado: EstadoSimulacion) => {
    estadoSimRef.current = nuevoEstado;
    setEstadoSimInterno(nuevoEstado);
  }, []);

  // ============================================================================
  // Encolar eventos entrantes y gestionar el arranque con búfer de 2 lotes
  // ============================================================================
  const encolarEventos = useCallback((lote: EventoBatch) => {
    if (!lote.eventos || !Array.isArray(lote.eventos)) return;

    // 1. Procesar eventos de control (ciclo de vida)
    for (const e of lote.eventos) {
      const tipo = e.tipo;
      switch (tipo) {
        case 'SIMULACION_INICIADA':
          setConectado(true);
          break;
        case 'SIMULACION_PAUSADA':
        case 'SIMULACION_EN_PAUSA':
          setEstadoSim('pausada');
          break;
        case 'SIMULACION_REANUDADA':
          setEstadoSim('en_vivo');
          break;
        case 'SIMULACION_FINALIZADA':
        case 'COLAPSO_DETECTADO':
          setEstadoSim('finalizada');
          break;
        case 'SIMULACION_DETENIDA':
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
      'SIMULACION_REANUDADA', 'SIMULACION_FINALIZADA', 'COLAPSO_DETECTADO',
      'SIMULACION_DETENIDA', 'ERROR',
    ];

    const eventosFiltrados = lote.eventos.filter((e: Evento) => {
      const tipo = e.tipo || (e as EventoConTipoAlternativo).tipoEvento;
      return !TIPOS_IGNORADOS.includes(tipo);
    });

    if (eventosFiltrados.length === 0) return;

    // 3. Acumular en la cola
    colaEventos.current.push(...eventosFiltrados);
    lotesRecibidosRef.current += 1;

    console.log('[LOTE RECIBIDO]', {
      numero: lotesRecibidosRef.current,
      eventosEnLote: eventosFiltrados.length,
      totalEnCola: colaEventos.current.length,
      primerEvento: eventosFiltrados[0]?.fechaHoraEvento,
      ultimoEvento: eventosFiltrados[eventosFiltrados.length - 1]?.fechaHoraEvento,
    });

    // 4. Arrancar el motor solo cuando tenemos ≥2 lotes (colchón de seguridad)
    if (lotesRecibidosRef.current >= 2 && estadoSimRef.current === 'sincronizando') {
      // Sincronizar el reloj simulado al primer evento real de la cola
      tiempoSimulacion.current = new Date(colaEventos.current[0].fechaHoraEvento).getTime();
      console.log('[MOTOR ARRANCA] reloj sincronizado a:', colaEventos.current[0].fechaHoraEvento);
      setEstadoSim('en_vivo');
    }

    onNuevoLoteRef.current?.();
  }, [setEstadoSim]);

  // ============================================================================
  // Conexión WebSocket
  // ============================================================================
  useEffect(() => {
    if (!topic || !id) return;

    simulacionWS.conectar(
      topic,
      encolarEventos,
      async () => {
        if (!arrancadoRef.current) {
          arrancadoRef.current = true;
          try {
            await SimulacionService.iniciar(id);
          } catch (error: unknown) {
            if (!axios.isAxiosError(error) || error.response?.status !== 409) {
              console.error('[WS] Error al iniciar la simulación:', error);
              arrancadoRef.current = false;
              return;
            }
            // 409 = ya estaba corriendo, ignorar
          }
          setConectado(true);
        }
      }
    );

    return () => {
      simulacionWS.desconectar();
      colaEventos.current = [];
      lotesRecibidosRef.current = 0;
      arrancadoRef.current = false;
    };
  }, [id, topic, encolarEventos]);

  // ============================================================================
  // Motor lógico — intervalo estable, lee estadoSimRef para evitar closure stale
  // ============================================================================
  useEffect(() => {
    const msSimuladosPorLote = K * 60 * 1000;   // ej: 90min → 5_400_000 ms
    const msRealesPorLote    = SaS * 1000;       // ej: 90s  →    90_000 ms
    const factorAceleracion  = msSimuladosPorLote / msRealesPorLote; // = 60
    const TICK_RATE = 100; // ms reales por tick

    const timer = setInterval(() => {
      // ← ref, nunca queda stale aunque el estado cambie
      if (estadoSimRef.current !== 'en_vivo') return;
      if (colaEventos.current.length === 0) return;

      // ── Diagnóstico (quitar en producción) ──
      console.log('[MOTOR-TICK]', {
        cola: colaEventos.current.length,
        tiempoSim: new Date(tiempoSimulacion.current).toISOString(),
        primerEventoPendiente: colaEventos.current[0]?.fechaHoraEvento,
      });

      // Avanzar el reloj simulado
      tiempoSimulacion.current += TICK_RATE * factorAceleracion;
      const tiempoActual = tiempoSimulacion.current;

      // Procesar todos los eventos cuyo timestamp ya fue alcanzado
      while (colaEventos.current.length > 0) {
        const evento = colaEventos.current[0];
        const horaEvento = new Date(evento.fechaHoraEvento).getTime();
        if (horaEvento > tiempoActual) break;

        const ev = colaEventos.current.shift()!;
        const tipo = ev.tipo || (ev as EventoConTipoAlternativo).tipoEvento;

        if (tipo === 'VUELO_DESPEGA') {
          const evVuelo = ev as EventoVuelo;
          vuelosActivos.current.set(evVuelo.codigoVuelo.toString(), evVuelo);
          console.log('[VUELO DESPEGA]', evVuelo.codigoVuelo, evVuelo.origenIata, '→', evVuelo.destinoIata);

        } else if (tipo === 'VUELO_ATERRIZA') {
          const evVuelo = ev as EventoVuelo;
          vuelosActivos.current.delete(evVuelo.codigoVuelo.toString());
          console.log('[VUELO ATERRIZA]', evVuelo.codigoVuelo, '→', evVuelo.destinoIata);

        } else if (tipo === 'AEROPUERTO_ACTUALIZADO') {
          const evAero = ev as EventoAeropuerto;
          const codigo = evAero.codigoAeropuerto?.trim().toUpperCase();
          if (aeropuertosSimulacion.current[codigo]) {
            aeropuertosSimulacion.current[codigo].maletasActuales     = evAero.maletasActuales;
            aeropuertosSimulacion.current[codigo].porcentajeOcupacion = evAero.porcentajeOcupacion;
            aeropuertosSimulacion.current[codigo].estadoCapacidad     = evAero.estadoCapacidad;
            aeropuertosSimulacion.current[codigo].enviosProximosAVencer = evAero.enviosProximosAVencer || [];
          } else {
            console.warn(
              '[AERO] clave no encontrada:',
              codigo,
              'keys disponibles:',
              Object.keys(aeropuertosSimulacion.current).slice(0, 5)
            );
          }
        }
      }
    }, TICK_RATE);

    return () => clearInterval(timer);
  }, [K, SaS]); // ← estadoSim FUERA de deps; se accede via ref

  return {
    conectado,
    estadoSim,
    setEstadoSim,
    aeropuertosRef: aeropuertosSimulacion,
    vuelosActivosRef: vuelosActivos,
    tiempoSimulacionRef: tiempoSimulacion,
  };
}
