'use client';

import { useSimulacion } from './hooks/useSimulacion';
import { Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { MapaSimulacion } from './components/mapa-simulacion';
import { useToast } from '@/app/shared/hooks/useToast';
import { SimulacionService } from '@/app/services/simulation.service';

interface Props {
  id: string;
  topic: string;
  k: number;
  aeropuertosIniciales: Aeropuerto[];
}

export function SimulacionCliente({ id, topic, k, aeropuertosIniciales }: Props) {
  const SaS_SEGUNDOS = 60;
  const { showToast, ToastComponent } = useToast();

  // 1. Extraemos la fecha que el formulario dejó guardada en el localStorage
  const fechaGuardada = typeof window !== 'undefined' ? localStorage.getItem("fechaInicio") : null;
  
  // 2. Construimos la fecha de arranque de forma segura
  const obtenerFechaInicioISO = (): string => {
    if (fechaGuardada) {
      // Como 'fechaGuardada' ya viene con formato 'YYYY-MM-DDTHH:mm' (hora local elegida),
      // la parseamos directamente como hora local y la convertimos a ISO.
      const fechaLocal = new Date(fechaGuardada);
      if (!isNaN(fechaLocal.getTime())) {
        return fechaLocal.toISOString();
      }
    }
    // Fallback por defecto si no hay nada guardado o es inválido
    return new Date('2026-02-10T00:00:00Z').toISOString();
  };

  const fechaInicioReal = obtenerFechaInicioISO();
  
  // El estado del ciclo de vida vive en el hook — lo recibimos directamente.
  const { 
    conectado,
    estadoSim,
    setEstadoSim,
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

  const handlePausar = async () => {
    try {
      await SimulacionService.pausar(id);
      // El estado se actualizará cuando llegue el evento SIMULACION_PAUSADA por WS.
      // Anticipamos el cambio en la UI para respuesta inmediata:
      setEstadoSim('pausada');
      showToast('Simulación pausada', 'info');
    } catch {
      showToast('Error al pausar la simulación', 'error');
    }
  };

  const handleReanudar = async () => {
    try {
      await SimulacionService.reanudar(id);
      setEstadoSim('en_vivo');
      showToast('Simulación reanudada', 'success');
    } catch {
      showToast('Error al reanudar la simulación', 'error');
    }
  };

  const handleDetener = async () => {
    try {
      await SimulacionService.detener(id);
      setEstadoSim('detenida');
      showToast('Simulación detenida', 'info');
    } catch {
      showToast('Error al detener la simulación', 'error');
    }
  };

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '6px 16px', borderRadius: '6px', fontWeight: 600,
    fontSize: '14px', cursor: 'pointer', border: '2px solid',
    background: 'transparent', color: 'white', transition: 'opacity .2s',
  };

  const estaActiva  = estadoSim === 'en_vivo';
  const estaPausada = estadoSim === 'pausada';
  const terminada   = estadoSim === 'finalizada' || estadoSim === 'detenida' || estadoSim === 'error';

  // Texto de estado visible en la barra
  const etiquetaEstado: Record<typeof estadoSim, string> = {
    sincronizando: 'Sincronizando...',
    en_vivo:       'En vivo',
    pausada:       'Pausada',
    detenida:      'Detenida',
    finalizada:    'Finalizada',
    error:         'Error',
  };

  const colorEstado: Record<typeof estadoSim, string> = {
    sincronizando: '#f87171',
    en_vivo:       '#4ade80',
    pausada:       '#fbbf24',
    detenida:      '#f87171',
    finalizada:    '#94a3b8',
    error:         '#ef4444',
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '0.6rem 1rem', background: '#1e293b', color: 'white', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* ID y estado */}
        <span style={{ fontSize: '13px', opacity: 0.8 }}>ID Simulación: {id}</span>
        <span style={{ color: colorEstado[estadoSim], fontWeight: 600 }}>
          ● {etiquetaEstado[estadoSim]}
        </span>

        {/* Botones de control */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            style={{ ...btnBase, borderColor: '#22d3ee', color: '#22d3ee',
              opacity: estaActiva ? 1 : 0.35,
              cursor: estaActiva ? 'pointer' : 'not-allowed' }}
            onClick={handlePausar}
            disabled={!estaActiva}
          >
            ⏸ Pausar
          </button>
          <button
            style={{ ...btnBase, borderColor: '#e2e8f0', color: '#e2e8f0',
              opacity: estaPausada ? 1 : 0.35,
              cursor: estaPausada ? 'pointer' : 'not-allowed' }}
            onClick={handleReanudar}
            disabled={!estaPausada}
          >
            ▶ Reanudar
          </button>
          <button
            style={{ ...btnBase, borderColor: '#f87171', color: '#f87171',
              opacity: (estaActiva || estaPausada) ? 1 : 0.35,
              cursor: (estaActiva || estaPausada) ? 'pointer' : 'not-allowed' }}
            onClick={handleDetener}
            disabled={terminada || estadoSim === 'sincronizando'}
          >
            ⏹ Detener
          </button>
        </div>

        {/* Velocidad - empujado a la derecha */}
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Velocidad: {k} min simulados / {SaS_SEGUNDOS}s reales
          </span>
        </div>
      </header>
      
      <div style={{ flex: 1 }}>
        <MapaSimulacion            
            aeropuertosIniciales={aeropuertosIniciales}
            aeropuertosRef={aeropuertosRef}
            vuelosActivosRef={vuelosActivosRef}
            tiempoSimulacionRef={tiempoSimulacionRef}
        />
        {ToastComponent}
      </div>
    </div>
  );
}