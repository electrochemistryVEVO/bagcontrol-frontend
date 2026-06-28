'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSimulacion } from './hooks/useSimulacion';
import { Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { MapaSimulacion } from './components/mapa-simulacion';
import { useToast } from '@/app/shared/hooks/useToast';
import { SimulacionService } from '@/app/services/simulation.service';
import { simulacionWS } from '@/app/services/config/webSocket';
import {router} from "next/client";

interface Props {
  id: string;
  topic: string;
  k: number;
  modo?: string;
  aeropuertosIniciales: Aeropuerto[];
  errorInicial?: string | null;
}

export function SimulacionCliente({ id, topic, k, modo, aeropuertosIniciales, errorInicial }: Props) {
  const router = useRouter();
  const SaS_SEGUNDOS = modo === '0' ? k * 60 : 90;
  const { showToast, ToastComponent } = useToast();
  const [segundosPreparando, setSegundosPreparando] = useState(0);
  const fechaGuardada = typeof window !== 'undefined' ? localStorage.getItem('fechaInicio') : null;
  const fechaInicioReal = fechaGuardada || '2026-02-10T00:00:00.000Z';

  const {
    conectado,
    estadoSim,
    setEstadoSim,
    aeropuertosRef,
    vuelosActivosRef,
    enviosPlanificadosRef,
    tiempoSimulacionRef,
    colapso,
    replanificaciones,
    mensajeErrorSimulacion,
  } = useSimulacion(
    id,
    topic,
    aeropuertosIniciales,
    k,
    SaS_SEGUNDOS,
    fechaInicioReal,
    modo,
    () => showToast('Nuevo lote de eventos recibido', 'info'),
  );

  const handleDetener = async () => {
    try {
      await SimulacionService.detener(id);
      setEstadoSim('detenida');
      showToast('Simulacion detenida', 'info');
      showToast('Simulación detenida', 'info');
    } catch {
      showToast('No se pudo detener en backend; saliendo del visualizador', 'error');
    } finally {
      simulacionWS.desconectar();
      router.back();
      setTimeout(() => router.push('/simulation'), 500);
    }
  };

  const activaODetenible = estadoSim === 'en_vivo' || estadoSim === 'pausada';
  const terminada = estadoSim === 'finalizada' || estadoSim === 'colapsada' || estadoSim === 'detenida' || estadoSim === 'error';

  useEffect(() => {
    if (estadoSim !== 'preparando') {
      setSegundosPreparando(0);
      return;
    }
    const inicio = Date.now();
    const timer = setInterval(() => {
      setSegundosPreparando(Math.floor((Date.now() - inicio) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [estadoSim]);

  const etiquetaEstado: Record<typeof estadoSim, string> = {
    conectando: 'Conectando...',
    conectado: 'Conectado',
    preparando: 'Conectado · preparando primer bloque',
    en_vivo: 'Simulacion en ejecucion',
    pausada: 'Pausada',
    detenida: 'Detenida',
    finalizada: 'Finalizada',
    colapsada: 'Colapsada',
    error: 'Error',
  };

  const colorEstado: Record<typeof estadoSim, string> = {
    conectando: '#b91c1c',
    conectado: '#0369a1',
    preparando: '#a16207',
    en_vivo: '#15803d',
    pausada: '#a16207',
    detenida: '#b91c1c',
    finalizada: '#475569',
    colapsada: '#c2410c',
    error: '#dc2626',
  };

  const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 16px',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    border: '2px solid',
    color: '#111827',
    transition: 'opacity .15s',
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '0.6rem 1rem', background: '#ffffff', color: '#111827', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', opacity: 0.8 }}>ID Simulacion: {id}</span>
        <span style={{ color: colorEstado[estadoSim], fontWeight: 600 }}>
          ● {etiquetaEstado[estadoSim]}
        </span>

        <button
          style={{
            ...btnBase,
            borderColor: '#dc2626',
            background: '#f87171',
            opacity: activaODetenible ? 1 : 0.35,
            cursor: activaODetenible ? 'pointer' : 'not-allowed',
          }}
          onClick={handleDetener}
          disabled={terminada || estadoSim === 'conectando'}
        >
          Detener
        </button>

        <div style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.8rem', color: '#334155' }}>
            Velocidad: {k} min simulados / {SaS_SEGUNDOS}s reales
          </span>
          {estadoSim === 'preparando' && (
            <span style={{ marginLeft: 12, fontSize: '0.8rem', color: segundosPreparando >= 30 ? '#b45309' : '#334155', fontWeight: 600 }}>
              Primer bloque en preparacion: {segundosPreparando}s
              {segundosPreparando >= 30 ? ' · El planificador sigue calculando el primer bloque...' : ''}
            </span>
          )}
        </div>
      </header>
      {errorInicial && (
        <div style={{ padding: '8px 16px', background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>
          {errorInicial}
        </div>
      )}
      {mensajeErrorSimulacion && (
        <div style={{ padding: '8px 16px', background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>
          {mensajeErrorSimulacion}
        </div>
      )}

      <div style={{ flex: 1 }}>
        <MapaSimulacion
          aeropuertosIniciales={aeropuertosIniciales}
          aeropuertosRef={aeropuertosRef}
          vuelosActivosRef={vuelosActivosRef}
          enviosPlanificadosRef={enviosPlanificadosRef}
          tiempoSimulacionRef={tiempoSimulacionRef}
          idSimulacion={id}
          conectado={conectado}
          fechaInicio={fechaInicioReal}
          modo={modo}
          colapso={colapso}
          replanificaciones={replanificaciones}
        />
        {ToastComponent}
      </div>
    </div>
  );
}
