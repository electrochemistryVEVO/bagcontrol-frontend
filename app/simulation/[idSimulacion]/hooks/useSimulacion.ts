import { useState } from 'react';
import { Aeropuerto, AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';

//Este hook va ser para gestionar las listas de aeropuertos y aviones que el frontend va usar para mostrar en el mapa

export function useSimulacion(aeropuertosIniciales: Aeropuerto[]) {
  const [aeropuertos, setAeropuertos] = useState<Record<string, AeropuertoSimulacion>>(
    () => Object.fromEntries(
      aeropuertosIniciales.map(a => [a.codigoIata, { ...a, cantidadAlmacen: 0 }])
    )
  );
  return { aeropuertos: Object.values(aeropuertos) };
}