import { Suspense } from 'react';
import { ContenedorSimulacion } from './components/contenedor-simulacion';

export default async function SimulacionPage() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h1>Panel de Simulacion</h1>
      <Suspense fallback={null}>
        <ContenedorSimulacion />
      </Suspense>
    </div>
  );
}
