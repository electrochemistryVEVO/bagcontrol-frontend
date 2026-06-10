import { AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import { RefObject, useState, useEffect } from 'react';

// Micro-componente que se actualiza a sí mismo leyendo la memoria RAM directamente
export function AeropuertoPopupContent({ 
  codigoIata, 
  aeropuertosRef 
}: { 
  codigoIata: string; 
  aeropuertosRef: RefObject<Record<string, AeropuertoSimulacion>> 
}) {
  // Estado local solo para este cuadrito de texto
  const [data, setData] = useState<AeropuertoSimulacion | undefined>();

  useEffect(() => {
    const liveData = aeropuertosRef.current?.[codigoIata];
    if (liveData) {
      setData({ ...liveData });
    }

    // Un relojito interno que corre a 10 fotogramas por segundo
    const timer = setInterval(() => {
      const liveData = aeropuertosRef.current?.[codigoIata];
      if (liveData) {
        // Forzamos la actualización clonando los datos mutados
        setData({ ...liveData }); 
      }
    }, 100);
    return () => clearInterval(timer);
  }, [codigoIata, aeropuertosRef]);

  if (!data) return null;

  return (
    <div style={{ color: 'black', maxWidth: '250px' }}>
      <b style={{ fontSize: '1.1rem' }}>{data.codigoIata} - {data.nombre}</b>
      <div style={{ margin: '8px 0', borderBottom: '1px solid #ccc' }}>
        <p style={{ margin: '2px 0' }}>Maletas: {data.maletasActuales} / {data.capacidadAlmacen}</p>
        <p style={{ margin: '2px 0' }}>Estado: <b>{data.estadoCapacidad}</b></p>
      </div>
    </div>
  );
}
