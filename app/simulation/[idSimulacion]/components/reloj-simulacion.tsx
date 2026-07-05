import {RefObject, useEffect, useMemo, useState} from 'react';
import { Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { formatAirportLocalDisplay, formatDuration, formatUtcDisplay } from '@/app/shared/dateTime';

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
}: {
  tiempoRef: RefObject<number>;
  ocupacionFlota?: number;
  fechaInicio: string;
  modo?: string;
  aeropuertoSeleccionado?: Aeropuerto | null;
  gmtUsuario?: number | null;
  aeropuertoUsuario?: Aeropuerto | null;
}) {
  const [epoch, setEpoch] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (tiempoRef.current) {
        setEpoch(tiempoRef.current);
      }
    }, 100);
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

  return (
    <>
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
            {restanteSim5D && <span>Restante Sim5D: {restanteSim5D}</span>}
        </div>
    </>
  );
}
