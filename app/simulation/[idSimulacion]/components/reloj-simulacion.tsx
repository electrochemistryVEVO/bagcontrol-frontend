import { RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { formatAirportLocalDisplay, formatDuration, formatUtcDisplay } from '@/app/shared/dateTime';
import type { EstadoSimulacion } from '../hooks/useSimulacion';
import Draggable from 'react-draggable';

function formatearTiempoReal(ms: number) {
  const segundosTotales = Math.max(0, Math.floor(ms / 1000));
  const horas = Math.floor(segundosTotales / 3600);
  const minutos = Math.floor((segundosTotales % 3600) / 60);
  const segundos = segundosTotales % 60;
  return `${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m ${String(segundos).padStart(2, '0')}s`;
}

function formatearHoraLocal(epoch: number) {
  const fecha = new Date(epoch);
  const dosDigitos = (valor: number) => String(valor).padStart(2, '0');
  return `${dosDigitos(fecha.getDate())}/${dosDigitos(fecha.getMonth() + 1)}/${fecha.getFullYear()} ${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}:${dosDigitos(fecha.getSeconds())}`;
}

export function RelojSimulacionOverlay({
  tiempoRef,
  fechaInicio,
  modo,
  gmtUsuario,
  aeropuertoUsuario,
  fechaHoraInicioReal,
  fechaHoraFinReal,
  estadoSim,
}: {
  tiempoRef: RefObject<number>;
  ocupacionFlota?: number;
  fechaInicio: string;
  modo?: string;
  aeropuertoSeleccionado?: Aeropuerto | null;
  gmtUsuario?: number | null;
  aeropuertoUsuario?: Aeropuerto | null;
  fechaHoraInicioReal?: string | null;
  fechaHoraFinReal?: string | null;
  estadoSim: EstadoSimulacion;
}) {
  const inicioEpoch = useMemo(() => {
    const normalizada = /[zZ]|[+-]\d{2}:?\d{2}$/.test(fechaInicio) ? fechaInicio : `${fechaInicio}Z`;
    const parsed = new Date(normalizada).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }, [fechaInicio]);
  const [epoch, setEpoch] = useState<number>(() => inicioEpoch);
  const [ahoraReal, setAhoraReal] = useState(() => Date.now());
  const finVisualRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const actualizar = () => {
      if (Number.isFinite(tiempoRef.current)) setEpoch(tiempoRef.current);
      setAhoraReal(Date.now());
    };
    actualizar();
    const timer = setInterval(actualizar, 250);
    return () => clearInterval(timer);
  }, [tiempoRef]);

  const fechaSimulada = useMemo(() => {
    if (typeof gmtUsuario === 'number' && aeropuertoUsuario) {
      return formatAirportLocalDisplay(epoch, aeropuertoUsuario);
    }
    return formatUtcDisplay(epoch);
  }, [aeropuertoUsuario, epoch, gmtUsuario]);
  const tiempoSimulado = useMemo(() => formatDuration(epoch - inicioEpoch), [epoch, inicioEpoch]);
  const restanteSim5D = useMemo(() => {
    if (modo !== '1') return null;
    return formatDuration(inicioEpoch + 5 * 24 * 60 * 60 * 1000 - epoch);
  }, [epoch, inicioEpoch, modo]);

  const esTerminal = ['colapsada', 'finalizada', 'detenida', 'error'].includes(estadoSim);
  if (esTerminal && finVisualRef.current === null) finVisualRef.current = ahoraReal;
  if (!esTerminal) finVisualRef.current = null;
  const inicioRealEpoch = fechaHoraInicioReal ? new Date(fechaHoraInicioReal).getTime() : Number.NaN;
  const finRealEpoch = fechaHoraFinReal ? new Date(fechaHoraFinReal).getTime() : Number.NaN;
  const extremoReal = Number.isFinite(finRealEpoch)
    ? finRealEpoch
    : esTerminal ? (finVisualRef.current ?? ahoraReal) : ahoraReal;
  const tiempoReal = Number.isFinite(inicioRealEpoch)
    ? formatearTiempoReal(extremoReal - inicioRealEpoch)
    : '00h 00m 00s';
  const zonaHoraria = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const fila = {
    display: 'grid',
    gridTemplateColumns: '88px minmax(0, 1fr)',
    gap: '8px',
    alignItems: 'baseline',
  } as const;

  return (
    <Draggable nodeRef={panelRef} bounds="parent">
      <section
        ref={panelRef}
        aria-label="Tiempos de la simulacion"
        title="Arrastra para mover el panel"
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          zIndex: 23,
          width: 'min(300px, calc(100vw - 32px))',
          overflow: 'hidden',
          color: '#e2e8f0',
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(56, 189, 248, 0.28)',
          borderRadius: 10,
          boxShadow: '0 6px 18px rgba(0, 0, 0, 0.28)',
          backdropFilter: 'blur(5px)',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: 12,
          lineHeight: 1.55,
          cursor: 'grab',
          userSelect: 'none',
          pointerEvents: 'auto',
        }}
      >
      <div style={{ padding: '9px 12px 8px' }}>
        <div style={{ marginBottom: 3, color: '#38bdf8', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Simulado
        </div>
        <div style={fila}><span style={{ color: '#94a3b8' }}>Transcurrido</span><strong>{tiempoSimulado}</strong></div>
        {restanteSim5D && <div style={fila}><span style={{ color: '#94a3b8' }}>Restante</span><strong>{restanteSim5D}</strong></div>}
        <div style={fila}><span style={{ color: '#94a3b8' }}>Fecha sim.</span><strong>{fechaSimulada}</strong></div>
      </div>
      <div style={{ padding: '8px 12px 9px', borderTop: '1px solid rgba(148, 163, 184, 0.2)', background: 'rgba(30, 41, 59, 0.42)' }}>
        <div style={{ marginBottom: 3, color: '#38bdf8', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Real
        </div>
        <div style={fila}><span style={{ color: '#94a3b8' }}>Transcurrido</span><strong>{tiempoReal}</strong></div>
        <div style={fila} title={zonaHoraria}><span style={{ color: '#94a3b8' }}>Hora local</span><strong>{formatearHoraLocal(ahoraReal)}</strong></div>
      </div>
      </section>
    </Draggable>
  );
}
