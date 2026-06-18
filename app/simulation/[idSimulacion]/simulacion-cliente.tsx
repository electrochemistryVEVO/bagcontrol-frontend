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
  errorInicial?: string | null;
}

export function SimulacionCliente({ id, topic, k, aeropuertosIniciales, errorInicial }: Props) {
  const SaS_SEGUNDOS = 90;
  const { showToast, ToastComponent } = useToast();

  // 1. Extraemos la fecha que el formulario dejó guardada en el localStorage
  const fechaGuardada = typeof window !== 'undefined' ? localStorage.getItem("fechaInicio") : null;
  
  // 2. Construimos la fecha de arranque de forma segura
  const obtenerFechaInicioISO = (): string => {
    if (fechaGuardada) {
      // Devuelve "2026-02-10T23:45:00.000Z" directamente al hook
      return fechaGuardada;
    }
    return '2026-02-10T00:00:00.000Z';
  };

  const fechaInicioReal = obtenerFechaInicioISO();
  
  // El estado del ciclo de vida vive en el hook — lo recibimos directamente.
  const { 
    conectado,
    estadoSim,
    setEstadoSim,
    aeropuertosRef, 
    vuelosActivosRef,
      enviosPlanificadosRef,
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
    sincronizando: '#b91c1c',
    en_vivo:       '#15803d',
    pausada:       '#a16207',
    detenida:      '#b91c1c',
    finalizada:    '#475569',
    error:         '#dc2626',
  };


  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '6px 16px', borderRadius: '6px', fontWeight: 600,
    fontSize: '14px', cursor: 'pointer', border: '2px solid',
    color: '#111827', transition: 'opacity .15s',
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '0.6rem 1rem', background: '#ffffff', color: '#111827', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* ID y estado */}
        <span style={{ fontSize: '13px', opacity: 0.8 }}>ID Simulación: {id}</span>
        <span style={{ color: colorEstado[estadoSim], fontWeight: 600 }}>
          ● {etiquetaEstado[estadoSim]}
        </span>

        {/* Botones de control */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            style={{ ...btnBase, borderColor: '#0891b2', background: '#22d3ee',
              opacity: estaActiva ? 1 : 0.35,
              cursor: estaActiva ? 'pointer' : 'not-allowed' }}
            onClick={handlePausar}
            disabled={!estaActiva}
          >
            ⏸ Pausar
          </button>
          <button
            style={{ ...btnBase, borderColor: '#94a3b8', background: '#e2e8f0',
              opacity: estaPausada ? 1 : 0.35,
              cursor: estaPausada ? 'pointer' : 'not-allowed' }}
            onClick={handleReanudar}
            disabled={!estaPausada}
          >
            ▶ Reanudar
          </button>
          <button
            style={{ ...btnBase, borderColor: '#dc2626', background: '#f87171',
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
          <span style={{ fontSize: '0.8rem', color: '#334155' }}>
            Velocidad: {k} min simulados / {SaS_SEGUNDOS}s reales
          </span>
        </div>
      </header>
      {errorInicial && (
        <div style={{ padding: '8px 16px', background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>
          {errorInicial}
        </div>
      )}
      
      <div style={{ flex: 1 }}>
        <MapaSimulacion            
            aeropuertosIniciales={aeropuertosIniciales}
            aeropuertosRef={aeropuertosRef}
            vuelosActivosRef={vuelosActivosRef}
            enviosPlanificadosRef = {enviosPlanificadosRef}
            tiempoSimulacionRef={tiempoSimulacionRef}
            idSimulacion={id}
            conectado={conectado}
        />
        {ToastComponent}
      </div>
    </div>
  );
}
