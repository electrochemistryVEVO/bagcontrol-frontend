import { AeropuertoService } from '@/app/services/aeropueto.service';
import { MapaSimulacion } from './components/mapa-simulacion';

export default async function SimulacionPage() {
  const { data: aeropuertos } = await AeropuertoService.listarAeropuertos();

  return (
    <div style={{ height: '80vh' }}>
      <h1>Página de simulación</h1>
      <MapaSimulacion aeropuertosIniciales={aeropuertos} />
    </div>
  );
}