'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Map, MapRef } from '@vis.gl/react-maplibre';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Box, Button, Chip, Tab, Tabs, Typography } from '@mui/material';
import styles from '../../stylesheets/contenedor.module.css';
import {
  ParametrosSimulacion,
  SimulacionActiva,
  SimulacionService,
} from '@/app/services/simulation.service';
import { GestionAeropuertos } from '@/app/management/components/GestionAeropuertos';
import { GestionVuelos } from '@/app/management/components/GestionVuelos';
import { GestionEnvios } from '@/app/management/components/GestionEnvios';
import { GestionIncidencias } from '@/app/management/components/GestionIncidencias';
import { useToast } from '@/app/shared/hooks/useToast';

enum SimulationType {
  VENTANA_CINCO_DIAS,
  COLAPSO_OPERATIVO,
}

type GestionTab = 'aeropuertos' | 'vuelos' | 'envios' | 'incidencias';

const UN_DIA_MS = 24 * 60 * 60 * 1000;
const K_SIMULACION = 120;

function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function obtenerMensajeError(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('response' in error)) return null;
  const response = (error as { response?: { data?: { message?: string; error?: string; detail?: string } } }).response;
  return response?.data?.message || response?.data?.detail || response?.data?.error || null;
}

function modoLabel(modo?: string) {
  if (modo === String(SimulationType.VENTANA_CINCO_DIAS)) return '5 dias';
  if (modo === String(SimulationType.COLAPSO_OPERATIVO)) return 'Hasta colapso';
  return 'Simulacion';
}

export function ContenedorSimulacion() {
  const router = useRouter();
  const [startDate, setStartDate] = useState<Date | null>(new Date('2026-02-10T08:30:00'));
  const [simulationType, setSimulationType] = useState<SimulationType>(SimulationType.VENTANA_CINCO_DIAS);
  const [gestionTab, setGestionTab] = useState<GestionTab>('aeropuertos');
  const [activas, setActivas] = useState<SimulacionActiva[]>([]);
  const [cargandoActivas, setCargandoActivas] = useState(false);
  const [activaError, setActivaError] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const { showToast, ToastComponent } = useToast();
  const mapRef = useRef<MapRef | null>(null);

  const activasFiltradas = useMemo(() => {
    return activas.filter((s) => s.modo !== String(0));
  }, [activas]);

  useEffect(() => {
    let cancelado = false;
    setCargandoActivas(true);
    setActivaError(null);
    SimulacionService.listarActivas()
      .then(({ data }) => {
        if (!cancelado) setActivas(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelado) {
          setActivas([]);
          setActivaError('El backend aun no expone la lista de simulaciones activas.');
        }
      })
      .finally(() => {
        if (!cancelado) setCargandoActivas(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const abrirSimulacion = (simulacion: SimulacionActiva) => {
    const modo = simulacion.modo ?? '1';
    const k = simulacion.k ?? K_SIMULACION;
    const topic = simulacion.websocketTopic ?? `/topic/simulacion/${simulacion.simulacionId}/eventos`;
    const fechaInicio = simulacion.fechaInicio ? `&fechaInicio=${encodeURIComponent(simulacion.fechaInicio)}` : '';
    router.push(`/simulation/${simulacion.simulacionId}?topic=${encodeURIComponent(topic)}&k=${k}&modo=${modo}${fechaInicio}`);
  };

  const crearEscenario = async () => {
    const inicio = startDate;
    if (!inicio) {
      showToast('Selecciona la fecha de inicio', 'error');
      return;
    }

    const formattedStart = formatLocalDateTime(inicio);
    const modo = simulationType;
    const fechaFin =
      modo === SimulationType.VENTANA_CINCO_DIAS
        ? new Date(inicio.getTime() + 5 * UN_DIA_MS)
        : null;

    const params: ParametrosSimulacion = {
      fechaInicio: formattedStart,
      fechaFin: fechaFin ? formatLocalDateTime(fechaFin) : undefined,
      k: K_SIMULACION,
      modo: String(modo === SimulationType.VENTANA_CINCO_DIAS ? 1 : 2),
    };

    setPreparando(true);
    try {
      showToast('Preparando simulacion...', 'info');
      const { data } = await SimulacionService.prepararInicio(params);
      router.push(`/simulation/${data.simulacionId}?topic=${encodeURIComponent(data.websocketTopic)}&k=${params.k}&modo=${params.modo}&fechaInicio=${formattedStart}`);
    } catch (error) {
      showToast(obtenerMensajeError(error) || 'No se pudo crear el escenario', 'error');
    } finally {
      setPreparando(false);
    }
  };

  return (
    <div className={styles.mapContainer}>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -70, latitude: -10, zoom: 3.2 }}
        mapStyle="https://tiles.openfreemap.org/styles/bright"
        onLoad={() => {
          const language = 'es';
          mapRef.current?.getMap().setLayoutProperty('label_country_1', 'text-field', ['get', `name:${language}`]);
          mapRef.current?.getMap().setLayoutProperty('label_country_2', 'text-field', ['get', `name:${language}`]);
          mapRef.current?.getMap().setLayoutProperty('label_country_3', 'text-field', ['get', `name:${language}`]);
        }}
      />

      <div className={styles.workspacePanel}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Box>
            <Typography component="h1" variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Simulacion
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>
              Unete a una simulacion activa o prepara un escenario aislado antes de iniciarlo.
            </Typography>
          </Box>
          <Button variant="outlined" size="small" onClick={() => router.push('/')}>
            Inicio
          </Button>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '360px 1fr' }, gap: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={panelStyle}>
              <Typography variant="subtitle1" sx={sectionTitleStyle}>Escenarios activos</Typography>
              {activaError && <Alert severity="warning" sx={{ mb: 1 }}>{activaError}</Alert>}
              {cargandoActivas && <Typography variant="body2">Cargando escenarios...</Typography>}
              {!cargandoActivas && activasFiltradas.length === 0 && (
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  No hay simulaciones activas disponibles para unirse.
                </Typography>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: activasFiltradas.length ? 1 : 0 }}>
                {activasFiltradas.map((simulacion) => (
                  <Button
                    key={simulacion.simulacionId}
                    variant="outlined"
                    onClick={() => abrirSimulacion(simulacion)}
                    sx={{ justifyContent: 'space-between', textTransform: 'none', borderRadius: 1 }}
                  >
                    <span>{simulacion.simulacionId}</span>
                    <Chip size="small" label={modoLabel(simulacion.modo)} />
                  </Button>
                ))}
              </Box>
            </Box>

            <Box sx={panelStyle}>
              <Typography variant="subtitle1" sx={sectionTitleStyle}>Nueva simulacion</Typography>

              <Typography variant="caption" sx={fieldCaptionStyle}>Tipo de escenario</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1, mb: 2 }}>
                <Button
                  variant={simulationType === SimulationType.VENTANA_CINCO_DIAS ? 'contained' : 'outlined'}
                  onClick={() => setSimulationType(SimulationType.VENTANA_CINCO_DIAS)}
                >
                  Simulacion de 5 dias
                </Button>
                <Button
                  variant={simulationType === SimulationType.COLAPSO_OPERATIVO ? 'contained' : 'outlined'}
                  onClick={() => setSimulationType(SimulationType.COLAPSO_OPERATIVO)}
                >
                  Hasta el colapso
                </Button>
              </Box>

              <Typography variant="caption" sx={fieldCaptionStyle}>Fecha y hora de inicio</Typography>
              <div className={styles.datePickerWrapper}>
                <DatePicker
                  showMonthYearDropdown
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="yyyy-MM-dd HH:mm"
                  onChange={(date: Date | null) => setStartDate(date)}
                  selected={startDate}
                />
              </div>

              <Button fullWidth variant="contained" onClick={crearEscenario} disabled={preparando} sx={{ mt: 2 }}>
                {preparando ? 'Preparando...' : 'Crear simulacion'}
              </Button>
            </Box>
          </Box>

          <Box sx={panelStyle}>
            <Typography variant="subtitle1" sx={sectionTitleStyle}>Gestion previa del escenario</Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
              Ajusta entidades antes de crear la simulacion. Estos cambios usan los servicios actuales del backend.
            </Typography>
            <Tabs
              value={gestionTab}
              onChange={(_, value) => setGestionTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ mb: 2, borderBottom: '1px solid #e2e8f0' }}
            >
              <Tab value="aeropuertos" label="Aeropuertos" />
              <Tab value="vuelos" label="Vuelos" />
              <Tab value="envios" label="Envios" />
              <Tab value="incidencias" label="Incidencias" />
            </Tabs>
            <Box sx={{ maxHeight: '52vh', overflow: 'auto', pr: 1 }}>
              {gestionTab === 'aeropuertos' && <GestionAeropuertos />}
              {gestionTab === 'vuelos' && <GestionVuelos />}
              {gestionTab === 'envios' && <GestionEnvios />}
              {gestionTab === 'incidencias' && <GestionIncidencias />}
            </Box>
          </Box>
        </Box>
      </div>
      {ToastComponent}
    </div>
  );
}

const panelStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 2,
  p: 2,
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
};

const sectionTitleStyle = {
  fontWeight: 800,
  color: '#0f172a',
  mb: 1,
};

const fieldCaptionStyle = {
  display: 'block',
  color: '#334155',
  fontWeight: 700,
  mb: 0.75,
};
