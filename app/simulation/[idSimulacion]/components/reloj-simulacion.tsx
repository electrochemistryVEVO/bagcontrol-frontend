import {RefObject, useEffect, useMemo, useRef, useState} from 'react';
import { Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { formatAirportLocalDisplay, formatDuration, formatUtcDisplay } from '@/app/shared/dateTime';
import type { EstadoSimulacion } from '../hooks/useSimulacion';

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

function obtenerColorFlota(ocupacion: number) {
  if (ocupacion < 33) return '#22c55e';
  if (ocupacion <= 66) return '#eab308';
  return '#ef4444';
}

export function RelojSimulacionOverlay({
  tiempoRef,
  ocupacionFlota,
  fechaInicio,
  modo,
  aeropuertoSeleccionado,
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
  const [epoch, setEpoch] = useState<number>(0);
  const [ahoraReal, setAhoraReal] = useState(() => Date.now());
  const finVisualRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      if (tiempoRef.current) {
        setEpoch(tiempoRef.current);
      }
      setAhoraReal(Date.now());
    }, 250);
    return () => clearInterval(timer);
  }, [tiempoRef]);

  const inicioEpoch = useMemo(() => {
    const normalizada = /[zZ]|[+-]\d{2}:?\d{2}$/.test(fechaInicio) ? fechaInicio : `${fechaInicio}Z`;
    const parsed = new Date(normalizada).getTime();
    return Number.isFinite(parsed) ? parsed : epoch;
  }, [epoch, fechaInicio]);

  // Display principal: hora local del usuario si tiene aeropuerto y GMT,
  // sino UTC. La conversion se hace siempre desde el epoch UTC.
  const hora = useMemo(() => {
    if (!epoch) return '';
    if (typeof gmtUsuario === 'number' && aeropuertoUsuario) {
      return formatAirportLocalDisplay(epoch, aeropuertoUsuario);
    }
    return formatUtcDisplay(epoch);
  }, [epoch, gmtUsuario, aeropuertoUsuario]);

  const textElapsado = useMemo(() => {
      return formatDuration(epoch - inicioEpoch)
  }, [epoch, inicioEpoch]);
  const restanteSim5D = useMemo(() => {
    if (modo !== '1') return null;
    return formatDuration(inicioEpoch + 5 * 24 * 60 * 60 * 1000 - epoch);
  }, [epoch, inicioEpoch, modo]);
  const horaLocal = useMemo(
    () => aeropuertoSeleccionado ? formatAirportLocalDisplay(epoch, aeropuertoSeleccionado) : null,
    [aeropuertoSeleccionado, epoch],
  );

  if (!hora) return null;

  const ocupacionNormalizada = typeof ocupacionFlota === 'number'
    ? Math.max(0, Math.min(100, Math.round(ocupacionFlota)))
    : null;
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

  const estiloIndicador = {
    position: 'absolute' as const,
    bottom: '84px',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    color: '#38bdf8',
    padding: '5px 10px',
    borderRadius: '7px',
    fontFamily: 'monospace',
    fontSize: 'clamp(0.68rem, 1.4vw, 0.78rem)',
    fontWeight: 600,
    border: '1px solid rgba(56, 189, 248, 0.3)',
    zIndex: 22,
    pointerEvents: 'none' as const,
    boxShadow: '0 3px 6px rgba(0,0,0,0.25)',
    whiteSpace: 'nowrap' as const,
    maxWidth: 'calc(50vw - 18px)',
  };

  return (
    <>
        <div style={{ ...estiloIndicador, left: 'clamp(12px, 3vw, 30px)' }}>
          Tiempo real: {tiempoReal}
        </div>
        <div
          style={{ ...estiloIndicador, right: 'clamp(12px, 3vw, 30px)' }}
          title={zonaHoraria}
        >
          Hora local: {formatearHoraLocal(ahoraReal)}
        </div>
        <div style={{
            position: 'absolute',
            bottom: '30px',
            right: '30px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            color: '#38bdf8',
            padding: '10px 20px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            zIndex: 22,
            pointerEvents: 'none',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
            {ocupacionNormalizada !== null && (
                <span style={{
                    color: '#0f172a',
                    backgroundColor: obtenerColorFlota(ocupacionNormalizada),
                    borderRadius: '999px',
                    padding: '3px 9px',
                    fontSize: '0.8rem',
                    lineHeight: 1.2,
                }}>
          Flota: {ocupacionNormalizada}%
        </span>
            )}
            <span>{hora}</span>
            {horaLocal && <span style={{ color: '#e2e8f0' }}>Local: {horaLocal}</span>}
        </div>
        <div style={{
            position: 'absolute',
            bottom: '30px',
            left: '30px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            color: '#38bdf8',
            padding: '10px 20px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            zIndex: 22,
            pointerEvents: 'none',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
            <span>Transcurrido: {textElapsado}</span>
        </div>
    </>
  );
}
