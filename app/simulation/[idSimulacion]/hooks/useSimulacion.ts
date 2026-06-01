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

  // Guardamos onNuevoLote en un ref para que encolarEventos nunca se recree
  // aunque el padre pase una nueva arrow function en cada render.
  const onNuevoLoteRef = useRef(onNuevoLote);
  useEffect(() => { onNuevoLoteRef.current = onNuevoLote; }, [onNuevoLote]);

  const [aeropuertosUI, setAeropuertosUI] = useState<Record<string, AeropuertoSimulacion>>(() =>
    Object.fromEntries(
      aeropuertosIniciales.map(a => [
        a.codigoIata,
        { ...a, maletasActuales: 0, porcentajeOcupacion: 0, estadoCapacidad: 'VERDE' }
      ])
    )
  );

  const aeropuertosLogica = useRef<Record<string, AeropuertoSimulacion>>(
    Object.fromEntries(
      aeropuertosIniciales.map(a => [
        a.codigoIata,
        { ...a, maletasActuales: 0, porcentajeOcupacion: 0, estadoCapacidad: 'VERDE' }
      ])
    )
  );

  const [estadoSim, setEstadoSim] = useState<EstadoSimulacion>('sincronizando');

  // ============================================================================
  // 2. Callback para encolar eventos nuevos que llegan por WebSocket
  //    Dependencia vacía [] — nunca se recrea, usa onNuevoLoteRef para el callback
  // ============================================================================
  const encolarEventos = useCallback((lote: EventoBatch) => {
    if (!lote.eventos || !Array.isArray(lote.eventos)) return;

    for (const e of lote.eventos) {
      switch ((e as any).tipo) {
        case 'SIMULACION_INICIADA':
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
      onNuevoLoteRef.current?.();
    }
  }, []); // [] estable — no depende de onNuevoLote directamente

  // ======================
  // 3. CONEXIÓN WEBSOCKET
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
          setEstadoSim('en_vivo');
        }
      }
    );

    return () => {
      simulacionWS.desconectar();
      colaEventos.current = [];
      arrancadoRef.current = false;
    };
  }, [id, topic, encolarEventos]);

  // =================================================
  // 4. MOTOR LÓGICO Y CONTROL DEL TIEMPO
  //    El reloj solo avanza cuando hay eventos en la cola
  //    (evita que K=300 "queme" los vuelos antes de verlos)
  // =================================================
  useEffect(() => {
    const msSimuladosPorLote = K * 60 * 1000;
    const msRealesPorLote = SaS * 1000;
    const factorAceleracion = msSimuladosPorLote / msRealesPorLote;

    const TICK_RATE = 100;

    const timer = setInterval(() => {
      // Solo avanzar el reloj simulado si hay eventos pendientes por procesar.
      // Sin esto, con K=300 el tiempo corre tan rápido que los vuelos "aterrizan"
      // antes de que el mapa tenga oportunidad de renderizarlos.
      if (colaEventos.current.length > 0) {
        tiempoSimulacion.current += TICK_RATE * factorAceleracion;
      }

      const tiempoActual = tiempoSimulacion.current;
      let huboCambiosAeropuertos = false;

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
          if (aeropuertosLogica.current[codigo]) {
            aeropuertosLogica.current[codigo].maletasActuales = evAero.maletasActuales;
            aeropuertosLogica.current[codigo].porcentajeOcupacion = evAero.porcentajeOcupacion;
            aeropuertosLogica.current[codigo].estadoCapacidad = evAero.estadoCapacidad;
            huboCambiosAeropuertos = true;
          }
        }
      }

      if (huboCambiosAeropuertos) {
        setAeropuertosUI({ ...aeropuertosLogica.current });
      }
    }, TICK_RATE);

    return () => clearInterval(timer);
  }, [K, SaS]);

  return {
    conectado,
    estadoSim,
    setEstadoSim,
    aeropuertosRef: aeropuertosLogica,
    vuelosActivosRef: vuelosActivos,
    tiempoSimulacionRef: tiempoSimulacion,
  };
}
