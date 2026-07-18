import { AeropuertoService } from '@/app/services/aeropueto.service';
import { SimulacionCliente } from './simulacion-cliente';
import { Aeropuerto } from '@/app/shared/types/Aeropuerto';

export default async function SimulacionPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ idSimulacion: string }>;
  searchParams: Promise<{ topic?: string, k?: string, modo?: string, fechaInicio?:string }>;
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    let aeropuertosIniciales: Aeropuerto[] = [];
    let errorInicial: string | null = null;

    try {
      aeropuertosIniciales = (await AeropuertoService.listarAeropuertos()).data;
    } catch {
      errorInicial = 'No se pudieron cargar los aeropuertos iniciales. Verifica que el backend este activo.';
    }

    const k = Number(resolvedSearchParams.k ?? 60);
  return (
    <SimulacionCliente
      id={resolvedParams.idSimulacion}
      topic={resolvedSearchParams.topic ?? ''}
      k={Number.isFinite(k) && k > 0 ? k : 60}
      fechaInicial={resolvedSearchParams.fechaInicio}
      modo={resolvedSearchParams.modo ?? ''}
      aeropuertosIniciales={aeropuertosIniciales}
      errorInicial={errorInicial}
    />
  );
}
