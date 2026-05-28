'use client';

import { useSimulacion } from './hooks/useSimulacion';
import { Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { MapaSimulacion } from './components/mapa-simulacion';
import { useToast } from '@/app/shared/hooks/useToast';

interface Props {
  id: string;
  topic: string;
  k: number;
  aeropuertosIniciales: Aeropuerto[];
}

export function SimulacionCliente({ id, topic, k, aeropuertosIniciales }: Props) {
  const SaS_SEGUNDOS = 30;
  const { showToast, ToastComponent } = useToast();
  // 1. Extraemos la fecha que el formulario dejó guardada en el localStorage
  const fechaGuardada = typeof window !== 'undefined' ? localStorage.getItem("fechaInicio") : null;
  
  // 2. Construimos la fecha de arranque forzando UTC para evitar desajustes de zona horaria.
  const fechaInicioReal = fechaGuardada 
      ? new Date(`${fechaGuardada}T00:00:00Z`).toISOString() 
      : new Date('2026-02-10T00:00:00Z').toISOString(); 
  
  // Extraemos 'aeropuertosRef' en lugar del estado reactivo para evitar congelar la UI
  const { 
    conectado, 
    aeropuertosRef, 
    vuelosActivosRef, 
    tiempoSimulacionRef 
  } = useSimulacion(
    id, 
    topic, 
    aeropuertosIniciales, 
    k, 
    SaS_SEGUNDOS, 
    fechaInicioReal,
    () => {
      showToast("Nuevo lote de eventos recibido", "info");
    }
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1rem', background: '#1e293b', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
        <div>
            <span>ID Simulación: {id}</span>
            <span style={{ marginLeft: '20px', color: conectado ? '#4ade80' : '#f87171' }}>
            ● {conectado ? 'En vivo' : 'Sincronizando...'}
            </span>
        </div>
        <div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Velocidad: {k} min simulados / {SaS_SEGUNDOS}s reales
            </span>
        </div>
      </header>
      
      <div style={{ flex: 1 }}>
        <MapaSimulacion            
            aeropuertosIniciales={aeropuertosIniciales}
            aeropuertosRef={aeropuertosRef} // Pasamos la referencia mutable directa
            vuelosActivosRef={vuelosActivosRef}
            tiempoSimulacionRef={tiempoSimulacionRef}
        />
        {ToastComponent}
      </div>
    </div>
  );
}
