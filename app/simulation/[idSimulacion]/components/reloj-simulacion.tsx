import { RefObject, useEffect, useState } from 'react';

export function RelojSimulacionOverlay({ tiempoRef }: { tiempoRef: RefObject<number> }) {
  const [hora, setHora] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      if (tiempoRef.current) {
        // Formateamos la fecha a algo legible (ej: 09/02/2026 14:30:00)
        const d = new Date(tiempoRef.current);
        setHora(d.toLocaleString('es-PE', { timeZone: 'UTC' }));
      }
    }, 100); // Se actualiza 10 veces por segundo
    return () => clearInterval(timer);
  }, [tiempoRef]);

  if (!hora) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: '30px',
      right: '30px',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      color: '#38bdf8',
      padding: '10px 20px',
      borderRadius: '8px',
      fontFamily: 'monospace',
      fontSize: '1.2rem',
      fontWeight: 'bold',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      zIndex: 10,
      pointerEvents: 'none',
      boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
    }}>
      {hora} UTC
    </div>
  );
}