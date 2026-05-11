import { AeropuertoService } from '@/app/services/aeropueto.service';
import { ContenedorSimulacion } from './components/contenedor-simulacion';

export default async function SimulacionPage() {

  return (
    <div style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
      <h1>Panel de Simulación</h1>
      
      {/* Delegamos la lógica del botón y el WebSocket al cliente */}
      <ContenedorSimulacion />
    </div>
  );
}