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


export function useSimulacion(
  id: string,
  topic: string,
  aeropuertosIniciales: Aeropuerto[],
  K: number, // Minutos simulados por ciclo
  SaS: number, // Segundos reales por ciclo
  fechaInicio: string, // Fecha/Hora en la que arranca la simulación (ISO String)
  onNuevoLote?: () => void
) {

  const [conectado, setConectado] = useState(false);
  const arrancadoRef = useRef(false);
  const vuelosActivos = useRef<Map<string, EventoVuelo>>(new Map());
  const colaEventos = useRef<Evento[]>([]);
  const tiempoSimulacion = useRef<number>(new Date(fechaInicio).getTime());

  // Estado para la UI (React renderiza con esto)
  const [aeropuertosUI, setAeropuertosUI] = useState<Record<string, AeropuertoSimulacion>>(() =>
    Object.fromEntries(
      aeropuertosIniciales.map(a => [
        a.codigoIata, 
        { ...a, maletasActuales: 0, porcentajeOcupacion: 0, estadoCapacidad: 'VERDE' }
      ])
    )
  );

  // Referencias (El mapa y la lógica usan esto para calcular rápidamente)
  const aeropuertosLogica = useRef<Record<string, AeropuertoSimulacion>>(
    Object.fromEntries(
      aeropuertosIniciales.map(a => [
        a.codigoIata, 
        { ...a, maletasActuales: 0, porcentajeOcupacion: 0, estadoCapacidad: 'VERDE' }
      ])
    )
  )

  // ============================================================================
  // 2. Callback para encolar eventos nuevos que llegan por WebSocket (se usa para evitar saturar el canal WS)
  // ============================================================================
  const encolarEventos = useCallback((lote: EventoBatch) => {
    if (!lote.eventos || !Array.isArray(lote.eventos)) return;

    const TIPOS_IGNORADOS = ['SIMULACION_INICIADA', 'SIMULACION_PAUSADA', 'SIMULACION_FINALIZADA'];
    
    const eventosFiltrados = lote.eventos.filter(
      (e: any) => !TIPOS_IGNORADOS.includes(e.tipo)
    );
    colaEventos.current.push(...eventosFiltrados);
    if (eventosFiltrados.length > 0) {
      colaEventos.current.push(...eventosFiltrados);
      if (onNuevoLote) onNuevoLote();
    }
  }, []);

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
            // 409 = ya estaba iniciada, está bien
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
      arrancadoRef.current = false;
    };
  }, [id, topic, encolarEventos]);

  // =================================================
  // 4. MOTOR LÓGICO Y CONTROL DEL TIEMPO
  // =================================================
  useEffect(() => {
    const msSimuladosPorLote = K * 60 * 1000;
    const msRealesPorLote = SaS * 1000;
    const factorAceleracion = msSimuladosPorLote / msRealesPorLote;
    
    const TICK_RATE = 100; // Evaluamos la cola cada 100ms reales
    
    const timer = setInterval(() => {
      // 1. Avanzar el reloj
      tiempoSimulacion.current += (TICK_RATE * factorAceleracion);
      const tiempoActual = tiempoSimulacion.current;
      let huboCambiosAeropuertos = false;

      // 2. Procesar eventos que ya deben ocurrir
      while (colaEventos.current.length > 0) {
        const evento = colaEventos.current[0];
        const fechaString = evento.fechaHoraEvento;
        const horaEvento = new Date(fechaString).getTime();

        // Si el evento es en el futuro de nuestra simulación, paramos
        if (horaEvento > tiempoActual) break;

        // Sacar de la cola
        const ev = colaEventos.current.shift()!;

        if (ev.tipo === "VUELO_DESPEGA") {
          const evVuelo = ev as EventoVuelo;
          vuelosActivos.current.set(evVuelo.codigoVuelo.toString(), evVuelo);
 
        } else if (ev.tipo === 'VUELO_ATERRIZA') {
          const evVuelo = ev as EventoVuelo;
          vuelosActivos.current.delete(evVuelo.codigoVuelo.toString());
          
        } else if (ev.tipo === 'AEROPUERTO_ACTUALIZADO') {
          const evAero = ev as EventoAeropuerto;
          const codigo = evAero.codigoAeropuerto
          
          if (aeropuertosLogica.current[codigo]) {
            aeropuertosLogica.current[codigo].maletasActuales = evAero.maletasActuales;
            aeropuertosLogica.current[codigo].porcentajeOcupacion = evAero.porcentajeOcupacion;
            aeropuertosLogica.current[codigo].estadoCapacidad = evAero.estadoCapacidad;
            huboCambiosAeropuertos = true;
          }
        }
      }      
      if (huboCambiosAeropuertos) {setAeropuertosUI({ ...aeropuertosLogica.current });}
    }, TICK_RATE);

    return () => clearInterval(timer);
  }, [K, SaS]); 

  return {
    conectado,
    aeropuertosRef: aeropuertosLogica, // <-- Pasamos el estado puro en RAM
    vuelosActivosRef: vuelosActivos,
    tiempoSimulacionRef: tiempoSimulacion
  };
}