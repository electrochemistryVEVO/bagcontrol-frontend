import {RefObject, useEffect, useMemo, useState} from 'react';

function obtenerColorFlota(ocupacion: number) {
  if (ocupacion < 33) return '#22c55e';
  if (ocupacion <= 66) return '#eab308';
  return '#ef4444';
}

export function RelojSimulacionOverlay({
  tiempoRef,
  ocupacionFlota,
}: {
  tiempoRef: RefObject<number>;
  ocupacionFlota?: number;
}) {
  const [hora, setHora] = useState<string>('');
  const [segsElapsados,setSegsElapsados] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (tiempoRef.current) {
        const d = new Date(tiempoRef.current);
        setHora(d.toLocaleString('es-PE', { timeZone: 'UTC' }));
        setSegsElapsados(segsElapsados+0.1)
      }
    }, 100);
    return () => clearInterval(timer);
  }, [segsElapsados,tiempoRef]);

  const textElapsado : string = useMemo(()=>
          (segsElapsados>=3600?`${Math.floor(segsElapsados/3600)}h`.toString().padStart(2,'0'):'')+
          (segsElapsados>=60?`${Math.floor(segsElapsados/60)}m`.toString().padStart(2,'0'):'')
          +`${Math.floor(segsElapsados%60).toString().padStart(2,'0')}s`,
      [segsElapsados])

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
            <span>{hora} UTC</span>
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
            <span>Tiempo elapsado: {textElapsado}</span>
        </div>
    </>
  );
}
