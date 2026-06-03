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
  const [data, setData] = useState(() => aeropuertosRef.current?.[codigoIata]);

  useEffect(() => {
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
    <div style={{ color: 'black' }}>
      <b>{data.codigoIata} - {data.nombre}</b>
      <p>{data.maletasActuales} / {data.capacidadAlmacen} maletas</p>
      <p>Estado: {data.estadoCapacidad}</p>
    </div>
  );
}