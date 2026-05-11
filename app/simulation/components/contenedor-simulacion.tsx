'use client';

import { ParametrosSimulacion, SimulacionService } from '@/app/services/simulation.service';
import { useRouter } from 'next/navigation';
import {
  Map,
} from '@vis.gl/react-maplibre';

export function ContenedorSimulacion() {
  const router = useRouter();

  const handlePreparar = async () => {
    const params : ParametrosSimulacion = { fechaInicio: '2026-02-10',fechaFin: '2026-02-15' , k: 300};
    const { data } = await SimulacionService.prepararInicio(params); 
    router.push(`/simulation/${data.simulacionId}?topic=${encodeURIComponent(data.websocketTopic)}`);
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>      
        <Map
            initialViewState={{ longitude: 0, latitude: 0, zoom: 3.5 }}
            mapStyle="https://demotiles.maplibre.org/style.json"
            interactiveLayerIds={['point']}
        >            
        </Map>
            
      <div style={{ 
        position: 'absolute', 
        top: '15%', left: '50%', 
        transform: 'translate(-50%, -50%)', 
        zIndex: 10,
        backgroundColor: 'rgba(30, 41, 59, 0.95)', 
        color: '#f8fafc', 
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        textAlign: 'center',
        minWidth: '300px'
        }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Configurar Simulación</h2>
        <p>Acá irá el formulario para configurar fecha inicio, fin y escenario, por ahora esta harcoded</p>
        <button 
            onClick={handlePreparar} 
            style={{ 
            padding: '12px 24px', 
            cursor: 'pointer',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)'
            }}            
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'} 
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
        >
            Preparar e Iniciar
        </button>
        </div>
    </div>
  );
}