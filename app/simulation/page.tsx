import { ContenedorSimulacion } from './components/contenedor-simulacion';

export default async function SimulacionPage() {

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h1>Panel de Simulación</h1>
        <ContenedorSimulacion />
    </div>
  );
}
