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

export type EstadoSimulacion = 'sincronizando' | 'en_vivo' | 'pausada' | 'detenida' | 'finalizada' | 'error';

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

  // Búfer de acoplamiento para el desfase controlado de 1 lote
  const lotesRecibidosRef = useRef<number>(0);
  const [bufferListo, setBufferListo] = useState(false);

  const onNuevoLoteRef = useRef(onNuevoLote);
  useEffect(() => { onNuevoLoteRef.current = onNuevoLote; }, [onNuevoLote]);

  const aeropuertosSimulacion = useRef<Record<string, AeropuertoSimulacion>>(
    Object.fromEntries(
      aeropuertosIniciales.map(a => [
        a.codigoIata,
        { ...a, maletasActuales: 0, porcentajeOcupacion: 0, estadoCapacidad: 'VERDE', enviosProximosAVencer: [] }
      ])
    )
  );

  const [estadoSim, setEstadoSim] = useState<EstadoSimulacion>('sincronizando');

  // ============================================================================
  // Callback para encolar eventos y gestionar el búfer de inercia
  // ============================================================================
  const encolarEventos = useCallback((lote: EventoBatch) => {
    if (!lote.eventos || !Array.isArray(lote.eventos)) return;

    for (const e of lote.eventos) {
      switch ((e as any).tipo) {
        case 'SIMULACION_INICIADA':
          setConectado(true);
          break;
        case 'SIMULACION_PAUSADA':
        case 'SIMULACION_EN_PAUSA':
          setEstadoSim('pausada');
          break;
        case 'SIMULACION_REANUDADA':
          if (lotesRecibidosRef.current >= 1) setEstadoSim('en_vivo');
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

    const TIPOS_IGNORADOS = [
      'SIMULACION_INICIADA', 'SIMULACION_PAUSADA', 'SIMULACION_EN_PAUSA',
      'SIMULACION_REANUDADA', 'SIMULACION_FINALIZADA', 'COLAPSO_DETECTADO',
      'SIMULACION_DETENIDA', 'ERROR',
    ];

    const eventosFiltrados = lote.eventos.filter(
      (e: any) => !TIPOS_IGNORADOS.includes(e.tipo)
    );

    if (eventosFiltrados.length > 0) {
      colaEventos.current.push(...eventosFiltrados);
      lotesRecibidosRef.current += 1;

      // El mapa arranca a moverse SOLO cuando el primer batch de datos está a salvo en la memoria RAM
      if (lotesRecibidosRef.current >= 1 && !bufferListo) {
        setBufferListo(true);
        setEstadoSim('en_vivo');
      }

      onNuevoLoteRef.current?.();
    }
  }, [bufferListo]);

  // ======================
  // CONEXIÓN WEBSOCKET
  // ======================
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
          } catch (error: any) {
            if (error?.response?.status !== 409) {
              console.error("Error al iniciar la simulación:", error);
              arrancadoRef.current = false;
              return;
            }
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

  // =================================================
  // MOTOR LÓGICO Y CONTROL DEL TIEMPO
  // =================================================
  useEffect(() => {
    const msSimuladosPorLote = K * 60 * 1000;
    const msRealesPorLote = SaS * 1000;
    const factorAceleracion = msSimuladosPorLote / msRealesPorLote;
    const TICK_RATE = 100;

    const timer = setInterval(() => {
      // Bloquear el avance del reloj si la simulación no está activa o si vaciamos la cola
      if (estadoSim !== 'en_vivo' || colaEventos.current.length === 0) return;

      tiempoSimulacion.current += TICK_RATE * factorAceleracion;
      const tiempoActual = tiempoSimulacion.current;

      while (colaEventos.current.length > 0) {
        const evento = colaEventos.current[0];
        const horaEvento = new Date(evento.fechaHoraEvento).getTime();
        if (horaEvento > tiempoActual) break;

        const ev = colaEventos.current.shift()!;

        if (ev.tipo === 'VUELO_DESPEGA') {
          const evVuelo = ev as EventoVuelo;
          vuelosActivos.current.set(evVuelo.codigoVuelo.toString(), evVuelo);

        } else if (ev.tipo === 'VUELO_ATERRIZA') {
          const evVuelo = ev as EventoVuelo;
          vuelosActivos.current.delete(evVuelo.codigoVuelo.toString());

        } else if (ev.tipo === 'AEROPUERTO_ACTUALIZADO') {
          const evAero = ev as EventoAeropuerto;
          const codigo = evAero.codigoAeropuerto;
          
          if (aeropuertosSimulacion.current[codigo]) {
            aeropuertosSimulacion.current[codigo].maletasActuales = evAero.maletasActuales;
            aeropuertosSimulacion.current[codigo].porcentajeOcupacion = evAero.porcentajeOcupacion;
            aeropuertosSimulacion.current[codigo].estadoCapacidad = evAero.estadoCapacidad;
            // Inyección limpia del top crítico mapeado desde el backend
            aeropuertosSimulacion.current[codigo].enviosProximosAVencer = evAero.enviosProximosAVencer || [];
          }
        }
      }
    }, TICK_RATE);

    return () => clearInterval(timer);
  }, [K, SaS, estadoSim]);

  return {
    conectado,
    estadoSim,
    setEstadoSim,
    aeropuertosRef: aeropuertosSimulacion,
    vuelosActivosRef: vuelosActivos,
    tiempoSimulacionRef: tiempoSimulacion,
  };
}