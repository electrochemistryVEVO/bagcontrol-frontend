import { AeropuertoService } from '@/app/services/aeropueto.service';
import { SimulacionCliente } from './simulacion-cliente';

export default async function SimulacionPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ idSimulacion: string }>;
  searchParams: Promise<{ topic: string, k: number }>; 
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const aeropuertosIniciales = (await AeropuertoService.listarAeropuertos()).data;
  return (
    <SimulacionCliente 
      id={resolvedParams.idSimulacion}
      topic={resolvedSearchParams.topic}
      k = {resolvedSearchParams.k}
      aeropuertosIniciales={aeropuertosIniciales} 
    />
  );
}