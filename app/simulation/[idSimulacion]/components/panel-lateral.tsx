'use client';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import React, {RefObject, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Draggable from 'react-draggable';

import type { AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import type { EstadoCapacidad, EventoVuelo } from '@/app/shared/types/Evento';
import type { Envio, EnvioRuta, MaletaSimulacion } from '@/app/shared/types/Envio';
import { SimulacionService, type VueloCancelable } from '@/app/services/simulation.service';
import { formatShortDateTime } from '@/app/shared/dateTime';
import {
  calcularOcupacionAeropuerto,
  calcularOcupacionVuelo,
  obtenerEstadoAeropuerto,
  obtenerEstadoPorOcupacion,
  obtenerEstadoVuelo,
} from '@/app/shared/simulation/semaforo';
import styles from '../../../stylesheets/simpanel.module.css';
import {useToast} from "@/app/shared/hooks/useToast";

// ─── Tipos compartidos ────────────────────────────────────────────────────────

type OrdenVuelos = 'ocupacion' | 'salida' | 'llegada' | 'origen' | 'destino';
type OrdenAeropuertos = 'calcularOcupacion' | 'calcularProximidadSalida' | 'calcularProximidadLlegada';
type DireccionOrden = 'asc' | 'desc';
type EstadoEnvio = 'EN_CURSO' | 'ENTREGADO' | 'PLANIFICADO' | 'POR_PLANIFICAR';
type FiltroEnvio = EstadoEnvio | 'ULTIMAS_HORAS' | '';
type SeccionPanel = 'vuelos' | 'aeropuertos' | 'envios';

const etiquetaEstadoEnvio: Record<EstadoEnvio, string> = {
  PLANIFICADO: 'Planificado',
  POR_PLANIFICAR: 'Por planificar',
  EN_CURSO: 'En tránsito',
  ENTREGADO: 'Entregado',
};

const ESTADOS_CAPACIDAD: EstadoCapacidad[] = ['VACIO', 'VERDE', 'AMARILLO', 'ROJO'];

const colorPorEstado: Record<EstadoCapacidad, 'success' | 'warning' | 'error' | 'default'> = {
  VACIO: 'default',
  VERDE: 'success',
  AMARILLO: 'warning',
  ROJO: 'error',
};

const etiquetaPorEstado: Record<EstadoCapacidad, string> = {
  VACIO: 'Vacío',
  VERDE: 'Verde',
  AMARILLO: 'Amarillo',
  ROJO: 'Rojo',
};

// ─── Props ────────────────────────────────────────────────────────────────────

type PanelLateralProps = {
  // comunes
  visible: boolean;
  idSimulacion: string;
  tiempoSimulacionRef: RefObject<number>;
  modo:string|undefined;
  // vuelos
  vuelosActivos: EventoVuelo[];
  vuelosActivosRef: RefObject<Map<string, EventoVuelo>>;
  seleccionarVuelo: (codigoVuelo: string) => void;
  onEnfocarVuelo: (codigoVuelo: string | number) => void;
  onFiltradoVuelosCambiado?: (codigos: string[] | null) => void;
  // aeropuertos
  aeropuertos: AeropuertoSimulacion[];
  onEnfocarAeropuerto: (codigoIata: string) => void;
  onFiltradoAeropuertosCambiado?: (iatas: string[] | null) => void;
  // envíos
  envios: Envio[];
  tiempoSimulacion: number;
  onMostrarRutaEnvio: (idPedido: string) => void;
  onObtenerRutaEnvio: (idPedido: string) => Promise<EnvioRuta | null>;
  haySeleccionRelacionada?: boolean;
  onLimpiarSeleccionRelacionada?: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chipVacio(estado: EstadoCapacidad, activo: boolean) {
  return estado === 'VACIO'
    ? {
        borderColor: '#4b5563',
        color: '#ffffff',
        '&.MuiChip-colorDefault': { color: '#ffffff' },
        '&.MuiChip-filledDefault': { backgroundColor: '#374151', color: '#ffffff' },
        '&.MuiChip-outlinedDefault': { borderColor: '#4b5563', color: '#ffffff' },
      }
    : {};
}

const seccionIntegradaSx = {
  bgcolor: 'transparent',
  color: 'inherit',
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  '&:before': { display: 'none' },
  '& > .MuiCollapse-root': {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  '& > .MuiCollapse-root > .MuiCollapse-wrapper': {
    flex: 1,
    minHeight: 0,
    display: 'flex',
  },
  '& > .MuiCollapse-root > .MuiCollapse-wrapper > .MuiCollapse-wrapperInner': {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
} as const;

// ─── Componente principal ─────────────────────────────────────────────────────

export function PanelLateral({
  visible,
  idSimulacion,
  vuelosActivos,
    modo,
    vuelosActivosRef,
  tiempoSimulacionRef,
  seleccionarVuelo,
  onEnfocarVuelo,
  onFiltradoVuelosCambiado,
  aeropuertos,
  onEnfocarAeropuerto,
  onFiltradoAeropuertosCambiado,
  envios,
  tiempoSimulacion,
  onMostrarRutaEnvio,
  onObtenerRutaEnvio,
  haySeleccionRelacionada,
  onLimpiarSeleccionRelacionada,
}: PanelLateralProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [seccionActiva, setSeccionActiva] = useState<SeccionPanel>('vuelos');
  const [panelContraido, setPanelContraido] = useState(true);

  if (!visible) return null;

  return (
    <Draggable nodeRef={nodeRef as RefObject<HTMLDivElement>} handle=".drag-handle" cancel=".panel-toggle">
      <Paper
        ref={nodeRef}
        elevation={8}
        onWheelCapture={(event) => event.stopPropagation()}
        sx={{
          position: 'absolute',
          top: 88,
          left: 16,
          zIndex: 21,
          width: panelContraido ? 190 : 430,
          maxWidth: 'calc(100vw - 32px)',
          height: panelContraido ? 'auto' : '82vh',
          maxHeight: 'calc(100vh - 104px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'rgba(15, 23, 42, 0.94)',
          color: '#f8fafc',
          border: '1px solid rgba(148, 163, 184, 0.24)',
          borderRadius: 2,
          transition: 'width 160ms ease',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Barra de arrastre */}
        <Box
          className="drag-handle"
          sx={{
            cursor: 'grab',
            px: 2,
            py: 0.75,
            bgcolor: 'rgba(30, 41, 59, 0.8)',
            borderBottom: '1px solid rgba(148,163,184,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: 13, color: '#94a3b8', letterSpacing: 2 }}>⠿</span>
          <Typography sx={{ fontSize: 12, color: '#64748b' }}>Paneles</Typography>
          <Button
            className="panel-toggle"
            size="small"
            variant="text"
            onClick={() => setPanelContraido((actual) => !actual)}
            aria-expanded={!panelContraido}
            sx={{ ml: 'auto', minWidth: 0, px: 1, color: '#cbd5e1', textTransform: 'none', fontSize: 11 }}
          >
            {panelContraido ? 'Expandir' : 'Contraer'}
          </Button>
        </Box>

        <Box sx={{ display: panelContraido ? 'none' : 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
          <FormControl size="small" fullWidth className={styles.input}>
            <InputLabel id="seccion-panel-label">Contenido</InputLabel>
            <Select
              labelId="seccion-panel-label"
              value={seccionActiva}
              label="Contenido"
              onChange={(event: SelectChangeEvent) => setSeccionActiva(event.target.value as SeccionPanel)}
            >
              <MenuItem value="vuelos">Vuelos en aire ({vuelosActivos.length})</MenuItem>
              <MenuItem value="aeropuertos">Aeropuertos ({aeropuertos.length})</MenuItem>
              <MenuItem value="envios">Envíos ({envios.length})</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* La sección seleccionada usa todo el espacio restante. */}
        <Box sx={{ overflowX: 'hidden', overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {haySeleccionRelacionada && (
            <Box sx={{ px: 2, py: 1, borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
              <Button size="small" variant="outlined" onClick={onLimpiarSeleccionRelacionada} fullWidth>
                Limpiar seleccion
              </Button>
            </Box>
          )}
          {seccionActiva === 'vuelos' && <SeccionVuelos
            idSimulacion={idSimulacion}
            vuelosActivos={vuelosActivos}
            modo={modo}
            tiempoSimulacionRef={tiempoSimulacionRef}
            vuelosActivosRef={vuelosActivosRef}
            seleccionarVuelo={seleccionarVuelo}
            onEnfocarVuelo={onEnfocarVuelo}
            onFiltradoCambiado={onFiltradoVuelosCambiado}
            onMostrarRutaEnvio={onMostrarRutaEnvio}
            integrada
          />}
          {seccionActiva === 'aeropuertos' && <SeccionAeropuertos
            aeropuertos={aeropuertos}
            onEnfocarAeropuerto={onEnfocarAeropuerto}
            onFiltradoCambiado={onFiltradoAeropuertosCambiado}
            onMostrarRutaEnvio={onMostrarRutaEnvio}
            integrada
          />}
          {seccionActiva === 'envios' && <SeccionEnvios
            key={idSimulacion}
            envios={envios}
            tiempoSimulacion={tiempoSimulacion}
            onMostrarRutaEnvio={onMostrarRutaEnvio}
            onObtenerRutaEnvio={onObtenerRutaEnvio}
            integrada
          />}
        </Box>
        </Box>
      </Paper>
    </Draggable>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN VUELOS
// ══════════════════════════════════════════════════════════════════════════════

function SeccionVuelos({
  idSimulacion,
  vuelosActivos,
  vuelosActivosRef,
    modo,
  tiempoSimulacionRef,
  seleccionarVuelo,
  onEnfocarVuelo,
  onFiltradoCambiado,
  onMostrarRutaEnvio,
  integrada,
}: {
  idSimulacion: string;
  vuelosActivos: EventoVuelo[];
  vuelosActivosRef: RefObject<Map<string, EventoVuelo>>;
  modo:string|undefined,
  tiempoSimulacionRef: RefObject<number>;
  seleccionarVuelo: (codigoVuelo: string) => void;
  onEnfocarVuelo: (codigoVuelo: string | number) => void;
  onFiltradoCambiado?: (codigos: string[] | null) => void;
  onMostrarRutaEnvio: (idPedido: string) => void;
  integrada?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<OrdenVuelos>('ocupacion');
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('desc');
  const [filtroEstados, setFiltroEstados] = useState<EstadoCapacidad[]>(ESTADOS_CAPACIDAD);
  const [vueloExpandido, setVueloExpandido] = useState<string | null>(null);
  const [enviosPorVuelo, setEnviosPorVuelo] = useState<Record<string, Envio[]>>({});
  const [loadingPorVuelo, setLoadingPorVuelo] = useState<Record<string, boolean>>({});
  const [errorPorVuelo, setErrorPorVuelo] = useState<Record<string, string>>({});
  const [vuelosCancelables, setVuelosCancelables] = useState<VueloCancelable[]>([]);
  const [cargandoCancelables, setCargandoCancelables] = useState(false);
  const [cancelandoVuelo, setCancelandoVuelo] = useState<number | null>(null);
  const [cancelablesAbiertos, setCancelablesAbiertos] = useState(false);
  const [origenCancelacion, setOrigenCancelacion] = useState('');
  const [destinoCancelacion, setDestinoCancelacion] = useState('');
  const [busquedaCancelablesRealizada, setBusquedaCancelablesRealizada] = useState(false);
  const [page, setPage] = useState(1);
  const rowsPerPage = 20;
  const toast = useToast();
  const abiertoEfectivo = integrada || abierto;

  const cargarCancelables = useCallback(async () => {
    if (!abiertoEfectivo || !cancelablesAbiertos || modo !== '1') return;
    setCargandoCancelables(true);
    try {
      const instante = new Date(tiempoSimulacionRef.current).toISOString();
      const { data } = await SimulacionService.obtenerVuelosCancelables(idSimulacion, instante);
      setVuelosCancelables(data);
    } catch {
      setVuelosCancelables([]);
    } finally {
      setCargandoCancelables(false);
    }
  }, [abiertoEfectivo, cancelablesAbiertos, idSimulacion, modo, tiempoSimulacionRef]);

  const vuelosCancelablesFiltrados = useMemo(() => vuelosCancelables.filter((vuelo) =>
    (!origenCancelacion.trim() || vuelo.origenIata.toUpperCase() === origenCancelacion.trim().toUpperCase())
    && (!destinoCancelacion.trim() || vuelo.destinoIata.toUpperCase() === destinoCancelacion.trim().toUpperCase())
  ).slice(0, 5), [destinoCancelacion, origenCancelacion, vuelosCancelables]);

  const buscarCancelables = async () => {
    if (!origenCancelacion.trim() && !destinoCancelacion.trim()) return;
    setBusquedaCancelablesRealizada(true);
    await cargarCancelables();
  };

  const cancelarProximaOcurrencia = async (vuelo: VueloCancelable) => {
    const confirmar = window.confirm(
      `Se cancelará únicamente el vuelo ${vuelo.codigoVuelo} del ${formatShortDateTime(vuelo.horaSalidaUtc)}. ` +
      'Las demás ocurrencias continuarán disponibles.'
    );
    if (!confirmar) return;
    setCancelandoVuelo(vuelo.codigoVuelo);
    try {
      const instante = new Date(tiempoSimulacionRef.current).toISOString();
      await SimulacionService.cancelarProximaOcurrencia(idSimulacion, vuelo.codigoVuelo, instante);
      toast.showToast('Cancelación registrada; los envíos serán replanificados', 'success');
      await cargarCancelables();
    } catch {
      toast.showToast('No se pudo registrar la cancelación', 'error');
    } finally {
      setCancelandoVuelo(null);
    }
  };

  const vuelosFiltrados = useMemo(() => {
    const filtro = busqueda.trim().toLowerCase();
    return [...vuelosActivos]
      .filter((v) => {
        const texto = !filtro || [String(v.codigoVuelo), v.origenIata, v.destinoIata].some((s) => s.toLowerCase().includes(filtro));
        return texto && filtroEstados.includes(obtenerEstadoVuelo(v));
      })
      .sort((a, b) => {
        let diferencia: number;
        switch (orden) {
          case 'salida': diferencia = new Date(a.horaSalidaUtc).getTime() - new Date(b.horaSalidaUtc).getTime(); break;
          case 'llegada': diferencia = new Date(a.horaLlegadaUtc).getTime() - new Date(b.horaLlegadaUtc).getTime(); break;
          case 'origen': diferencia = a.origenIata.localeCompare(b.origenIata, 'es'); break;
          case 'destino': diferencia = a.destinoIata.localeCompare(b.destinoIata, 'es'); break;
          default: diferencia = calcularOcupacionVuelo(a.cantidadMaletas, a.capacidadMax) - calcularOcupacionVuelo(b.cantidadMaletas, b.capacidadMax);
        }
        return direccionOrden === 'asc' ? diferencia : -diferencia;
      });
  }, [busqueda, orden, direccionOrden, filtroEstados, vuelosActivos]);



  const hayFiltro = busqueda.trim() !== '' || filtroEstados.length < ESTADOS_CAPACIDAD.length;
  useEffect(() => {
    if (!onFiltradoCambiado) return;
    onFiltradoCambiado(hayFiltro ? vuelosFiltrados.map((v) => String(v.codigoVuelo)) : null);
  }, [vuelosFiltrados, hayFiltro, onFiltradoCambiado]);

  const cargarEnvios = async (vuelo: EventoVuelo) => {
    const codigo = String(vuelo.codigoVuelo);
    onEnfocarVuelo(vuelo.codigoVuelo);
    if (vueloExpandido === codigo) { setVueloExpandido(null); return; }
    setVueloExpandido(codigo);
    if (enviosPorVuelo[codigo] || loadingPorVuelo[codigo]) return;
    setLoadingPorVuelo((p) => ({ ...p, [codigo]: true }));
    try {
      const ts = new Date(tiempoSimulacionRef.current).toISOString();
      const { data } = await SimulacionService.obtenerEnviosPorVuelo(idSimulacion, vuelo, ts);
      setEnviosPorVuelo((p) => ({ ...p, [codigo]: data }));
    } catch {
      setErrorPorVuelo((p) => ({ ...p, [codigo]: 'No se pudieron cargar los envíos.' }));
    } finally {
      setLoadingPorVuelo((p) => ({ ...p, [codigo]: false }));
    }
  };

  return (
    <Accordion
      expanded={abiertoEfectivo}
      onChange={(_, v) => { if (!integrada) setAbierto(v); }}
      disableGutters
      sx={seccionIntegradaSx}
    >
      <AccordionSummary className={styles.accordionSummary} sx={{ display: integrada ? 'none' : undefined }}>
        <Typography sx={{ fontWeight: 700 }}>Vuelos en aire</Typography>
        <Chip size="small" label={vuelosActivos.length} color={vuelosActivos.length ? 'primary' : 'default'} />
      </AccordionSummary>
      <AccordionDetails className={styles.accordionDetails} sx={{ flex: 1, minHeight: 0, maxHeight: 'none' }}>
        {abiertoEfectivo && (
          <>
            {modo === '1' && (
              <Accordion
                expanded={cancelablesAbiertos}
                onChange={(_, expandido) => setCancelablesAbiertos(expandido)}
                disableGutters
                sx={{ mb: 1.5, flexShrink: 0, bgcolor: 'rgba(120,53,15,0.16)', color: 'inherit', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px !important', '&:before': { display: 'none' } }}
              >
                <AccordionSummary sx={{ minHeight: '40px !important', px: 1, '& .MuiAccordionSummary-content': { my: 0.75, alignItems: 'center', justifyContent: 'space-between' } }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#fbbf24' }}>
                    Vuelos cancelables
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 1, pt: 0, pb: 1, maxHeight: '38vh', overflowY: 'auto' }}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        size="small"
                        value={origenCancelacion}
                        onChange={(event) => { setOrigenCancelacion(event.target.value); setBusquedaCancelablesRealizada(false); }}
                        placeholder="Origen"
                        slotProps={{ htmlInput: { maxLength: 4 } }}
                        fullWidth
                        className={styles.input}
                      />
                      <TextField
                        size="small"
                        value={destinoCancelacion}
                        onChange={(event) => { setDestinoCancelacion(event.target.value); setBusquedaCancelablesRealizada(false); }}
                        placeholder="Destino"
                        slotProps={{ htmlInput: { maxLength: 4 } }}
                        fullWidth
                        className={styles.input}
                      />
                    </Stack>
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      fullWidth
                      disabled={cargandoCancelables || (!origenCancelacion.trim() && !destinoCancelacion.trim())}
                      onClick={() => void buscarCancelables()}
                    >
                      Buscar
                    </Button>
                    {cargandoCancelables && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}><CircularProgress size={20} /></Box>
                    )}
                    {!cargandoCancelables && busquedaCancelablesRealizada && vuelosCancelablesFiltrados.length === 0 && (
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        No hay vuelos futuros con envíos para esa ruta.
                      </Typography>
                    )}
                    {!cargandoCancelables && busquedaCancelablesRealizada && vuelosCancelablesFiltrados.map((vuelo) => (
                      <Box key={`${vuelo.codigoVuelo}|${vuelo.horaSalidaUtc}`} sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>
                            {vuelo.codigoVuelo} · {vuelo.origenIata} → {vuelo.destinoIata}
                          </Typography>
                          <Typography sx={{ fontSize: 10.5, color: '#cbd5e1' }}>
                            {formatShortDateTime(vuelo.horaSalidaUtc)} · {vuelo.enviosAfectados.length} envíos · {vuelo.cantidadMaletas} maletas
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          color="warning"
                          variant="contained"
                          disabled={cancelandoVuelo === vuelo.codigoVuelo}
                          onClick={() => void cancelarProximaOcurrencia(vuelo)}
                          sx={{ flexShrink: 0, fontSize: 10 }}
                        >
                          Cancelar
                        </Button>
                      </Box>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}
            <Stack spacing={1.5} className={styles.filtersContainer}>
              <TextField size="small" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar vuelo, origen o destino" fullWidth className={styles.input} />
              <Stack direction="row" spacing={1.5} className={styles.orderContainer}>
              <FormControl size="small" className={styles.input}>
                <InputLabel>Ordenar por</InputLabel>
                <Select value={orden} label="Ordenar por" onChange={(e: SelectChangeEvent) => setOrden(e.target.value as OrdenVuelos)}>
                  <MenuItem value="ocupacion">Nivel de ocupación</MenuItem>
                  <MenuItem value="salida">Hora salida</MenuItem>
                  <MenuItem value="llegada">Hora llegada</MenuItem>
                  <MenuItem value="origen">Origen</MenuItem>
                  <MenuItem value="destino">Destino</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setDireccionOrden((actual) => actual === 'asc' ? 'desc' : 'asc')}
                className={styles.orderButton}
              >
                Orden {direccionOrden === 'asc' ? 'ascendente' : 'descendente'}
              </Button>
              </Stack>
              <Stack direction="row" spacing={1}>
                {ESTADOS_CAPACIDAD.map((estado) => {
                  const activo = filtroEstados.includes(estado);
                  return (
                    <Chip
                      key={estado}
                      size="small"
                      label={etiquetaPorEstado[estado]}
                      color={colorPorEstado[estado]}
                      variant={activo ? 'filled' : 'outlined'}
                      onClick={() => setFiltroEstados((cur) => activo ? cur.filter((e) => e !== estado) : [...cur, estado])}
                      sx={{ cursor: 'pointer', fontWeight: activo ? 700 : 400, ...chipVacio(estado, activo) }}
                    />
                  );
                })}
              </Stack>
            </Stack>

            {vuelosFiltrados.length === 0 ? (
              <Box className={styles.empty}>No hay vuelos activos</Box>
            ) : (
              <Stack spacing={1} className={styles.scrollList}>
                {vuelosFiltrados.slice((page - 1) * rowsPerPage, page * rowsPerPage).map((vuelo) => {
                  const codigo = String(vuelo.codigoVuelo);
                  const expandido = vueloExpandido === codigo;
                  const envios = enviosPorVuelo[codigo] || [];
                  const enviosCargados = expandido && enviosPorVuelo[codigo] !== undefined;
                  const maletas = enviosCargados ? envios.reduce((s, e) => s + e.cantidadMaletas, 0) : vuelo.cantidadMaletas;
                  const ocup = calcularOcupacionVuelo(maletas, vuelo.capacidadMax);
                  const estado = enviosCargados ? obtenerEstadoPorOcupacion(ocup) : obtenerEstadoVuelo(vuelo);
                  const colorCapacidad = estado === 'ROJO'
                    ? '#dc2626'
                    : estado === 'AMARILLO'
                      ? '#d97706'
                      : estado === 'VERDE'
                        ? '#16a34a'
                        : '#475569';

                  return (
                    <Box key={codigo} className={styles.airportBoxList}>
                      <Button fullWidth onClick={() => seleccionarVuelo(codigo)} className={styles.airportButton}>
                        <Box className={styles.airportContent}>
                          <Stack className={styles.airportHeader}>
                            <Typography className={styles.airportCode}>Vuelo {codigo}</Typography>
                            <Stack className={styles.airportChips}>
                              <Chip
                                size="small"
                                label={`${maletas}/${vuelo.capacidadMax}`}
                                title={`Capacidad: ${estado}`}
                                sx={{ bgcolor: colorCapacidad, color: '#fff', fontWeight: 700 }}
                              />
                            </Stack>
                          </Stack>
                          <Stack className={styles.airportFooter}>
                            <Typography variant="body2" className={styles.airportLocation}>
                              {vuelo.origenIata} → {vuelo.destinoIata}
                            </Typography>
                            <Stack className={styles.airportProximidad}>
                              <Typography variant="caption" className={styles.airportProximidadLinea}>
                                S: {formatShortDateTime(vuelo.horaSalidaUtc)}
                              </Typography>
                              <Typography variant="caption" className={styles.airportProximidadLinea}>
                                L: {formatShortDateTime(vuelo.horaLlegadaUtc)}
                              </Typography>
                            </Stack>
                          </Stack>

                        </Box>
                      </Button>
                      {expandido && (
                        <Box className={styles.expandedContent}>
                          {loadingPorVuelo[codigo] ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={22} /></Box>
                          ) : errorPorVuelo[codigo] ? (
                            <Typography variant="body2" color="error">{errorPorVuelo[codigo]}</Typography>
                          ) : envios.length === 0 ? (
                            <Box className={styles.empty}>Sin envíos asignados</Box>
                          ) : (() => {
                            const maletasVuelo = envios.flatMap(e =>
                              Array.from({ length: e.cantidadMaletas }, (_, i) => ({
                                codigoMaleta: `${e.idPedido}-M${i + 1}`,
                                idPedido: e.idPedido,
                                origenIata: e.origenIata,
                                destinoIata: e.destinoIata,
                              }))
                            );
                            return (
                              <>
                                <Typography variant="caption" sx={{ color: '#94a3b8', px: 1, pb: 0.5, display: 'block' }}>
                                  {maletasVuelo.length} maletas · {envios.length} envíos
                                </Typography>
                                <Table size="small" className={styles.table}>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Código</TableCell>
                                      <TableCell>Origen</TableCell>
                                      <TableCell>Destino</TableCell>
                                      <TableCell></TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {maletasVuelo.map((m) => (
                                      <TableRow key={m.codigoMaleta}>
                                        <TableCell sx={{ fontSize: 11 }}>{m.codigoMaleta}</TableCell>
                                        <TableCell>{m.origenIata}</TableCell>
                                        <TableCell>{m.destinoIata}</TableCell>
                                        <TableCell>
                                          <button
                                            onClick={() => onMostrarRutaEnvio(m.idPedido)}
                                            style={{ border: 'none', borderRadius: 4, padding: '3px 8px', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                          >
                                            Ruta
                                          </button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </>
                            );
                          })()}
                        </Box>
                      )}
                    </Box>
                  );
                })}
                <Pagination className={styles.pagination} page={page} onChange={(_, v) => setPage(v)} count={Math.ceil(vuelosFiltrados.length / rowsPerPage)} />
              </Stack>
            )}
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN AEROPUERTOS
// ══════════════════════════════════════════════════════════════════════════════

const ordenAeropuertoFns: Record<OrdenAeropuertos, (a: AeropuertoSimulacion) => number> = {
  calcularOcupacion: (a) => calcularOcupacionAeropuerto(a),
  calcularProximidadSalida: (a) => {
    if (!a.enviosProximosAVencer?.length) return Number.MAX_VALUE;
    return Date.now() - new Date(a.enviosProximosAVencer[0].fechaHoraSalidaUtc).getTime();
  },
  calcularProximidadLlegada: (a) => {
    if (!a.enviosProximosAVencer?.length) return Number.MAX_VALUE;
    return Date.now() - new Date(a.enviosProximosAVencer[0].fechaHoraLlegadaUtc).getTime();
  },
};

function SeccionAeropuertos({
  aeropuertos,
  onEnfocarAeropuerto,
  onFiltradoCambiado,
  onMostrarRutaEnvio,
  integrada,
}: {
  aeropuertos: AeropuertoSimulacion[];
  onEnfocarAeropuerto: (iata: string) => void;
  onFiltradoCambiado?: (iatas: string[] | null) => void;
  onMostrarRutaEnvio: (idPedido: string) => void;
  integrada?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroContinente, setFiltroContinente] = useState('');
  const [filtroEstados, setFiltroEstados] = useState<EstadoCapacidad[]>(ESTADOS_CAPACIDAD);
  const [tipoOrden, setTipoOrden] = useState<OrdenAeropuertos>('calcularOcupacion');
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('desc');
  const abiertoEfectivo = integrada || abierto;
  const expandido: string | null = null;
  const maletasPorAeropuerto: Record<string, MaletaSimulacion[]> = {};
  const loadingMaletas: Record<string, boolean> = {};
  const errorMaletas: Record<string, string> = {};
  const paginaMaletas: Record<string, number> = {};
  const MALETAS_POR_PAGINA = 10;
  const setPaginaMaletas = (_: (p: Record<string, number>) => Record<string, number>) => {};
  const seleccionar = (iata: string) => {
    onEnfocarAeropuerto(iata);
  };

  const toggleExpandido = seleccionar;

  const aeropuertosOrdenados = useMemo(() => {
    return [...aeropuertos]
      .filter((a) => {
        const txt = busqueda.trim().toLowerCase();
        return (!txt || a.codigoIata.toLowerCase().includes(txt))
          && (!filtroContinente || a.continente.toLowerCase().includes(filtroContinente))
          && filtroEstados.includes(obtenerEstadoAeropuerto(a));
      })
      .sort((a, b) => {
        const d = ordenAeropuertoFns[tipoOrden](a) - ordenAeropuertoFns[tipoOrden](b);
        return direccionOrden === 'asc' ? d : -d;
      });
  }, [aeropuertos, busqueda, filtroContinente, filtroEstados, tipoOrden, direccionOrden]);

  const hayFiltro = busqueda.trim() !== '' || filtroContinente !== '' || filtroEstados.length < ESTADOS_CAPACIDAD.length;
  useEffect(() => {
    if (!onFiltradoCambiado) return;
    onFiltradoCambiado(hayFiltro ? aeropuertosOrdenados.map((a) => a.codigoIata) : null);
  }, [aeropuertosOrdenados, hayFiltro, onFiltradoCambiado]);

  return (
    <Accordion
      expanded={abiertoEfectivo}
      onChange={(_, v) => { if (!integrada) setAbierto(v); }}
      disableGutters
      sx={seccionIntegradaSx}
    >
      <AccordionSummary className={styles.accordionSummary} sx={{ display: integrada ? 'none' : undefined }}>
        <Typography sx={{ fontWeight: 700 }}>Aeropuertos</Typography>
        <Chip size="small" label={aeropuertos.length} color={aeropuertos.length ? 'primary' : 'default'} />
      </AccordionSummary>
      <AccordionDetails className={styles.accordionDetails} sx={{ flex: 1, minHeight: 0, maxHeight: 'none' }}>
        {abiertoEfectivo && (
          <>
            <Stack spacing={1.5} className={styles.filtersContainer}>
              <TextField size="small" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por código IATA" fullWidth className={styles.input} />
              <FormControl size="small" fullWidth className={styles.input}>
                <InputLabel>Filtrar por continente</InputLabel>
                <Select value={filtroContinente} label="Filtrar por continente" onChange={(e: SelectChangeEvent) => setFiltroContinente(e.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="america">América</MenuItem>
                  <MenuItem value="asia">Asia</MenuItem>
                  <MenuItem value="oceania">Oceanía</MenuItem>
                  <MenuItem value="europa">Europa</MenuItem>
                  <MenuItem value="africa">África</MenuItem>
                </Select>
              </FormControl>
              <Stack direction="row" spacing={1}>
                {ESTADOS_CAPACIDAD.map((estado) => {
                  const activo = filtroEstados.includes(estado);
                  return (
                    <Chip
                      key={estado}
                      size="small"
                      label={etiquetaPorEstado[estado]}
                      color={colorPorEstado[estado]}
                      variant={activo ? 'filled' : 'outlined'}
                      onClick={() => setFiltroEstados((cur) => activo ? cur.filter((e) => e !== estado) : [...cur, estado])}
                      sx={{ cursor: 'pointer', fontWeight: activo ? 700 : 400, ...chipVacio(estado, activo) }}
                    />
                  );
                })}
              </Stack>
              <Stack direction="row" spacing={1.5} className={styles.orderContainer}>
                <FormControl size="small" className={styles.input}>
                  <InputLabel>Ordenar por</InputLabel>
                  <Select value={tipoOrden} label="Ordenar por" onChange={(e: SelectChangeEvent) => setTipoOrden(e.target.value as OrdenAeropuertos)}>
                    <MenuItem value="calcularOcupacion">Ocupación</MenuItem>
                    <MenuItem value="calcularProximidadSalida">Prox. salida</MenuItem>
                    <MenuItem value="calcularProximidadLlegada">Prox. llegada</MenuItem>
                  </Select>
                </FormControl>
                <Button variant="outlined" size="small" onClick={() => setDireccionOrden((d) => d === 'asc' ? 'desc' : 'asc')} className={styles.orderButton}>
                  {direccionOrden === 'asc' ? 'Ascendente' : 'Descendente'}
                </Button>
              </Stack>
            </Stack>

            {aeropuertosOrdenados.length === 0 ? (
              <Box className={styles.empty}>No hay aeropuertos disponibles</Box>
            ) : (
              <Stack spacing={1} className={styles.scrollList}>
                {aeropuertosOrdenados.map((aeropuerto) => {
                  const estado = obtenerEstadoAeropuerto(aeropuerto);
                  const proximosSLA = aeropuerto.enviosProximosAVencer || [];
                  const estaExpandido = expandido === aeropuerto.codigoIata;
                  const colorCapacidad = estado === 'ROJO'
                    ? '#dc2626'
                    : estado === 'AMARILLO'
                      ? '#d97706'
                      : estado === 'VERDE'
                        ? '#16a34a'
                        : '#475569';
                  return (
                    <Box key={aeropuerto.codigoIata} className={styles.airportBoxList}>
                      <Button fullWidth onClick={() => toggleExpandido(aeropuerto.codigoIata)} className={styles.airportButton}>
                        <Box className={styles.airportContent}>
                          <Stack className={styles.airportHeader}>
                            <Typography className={styles.airportCode}>{aeropuerto.codigoIata}</Typography>
                            <Stack className={styles.airportChips}>
                              <Chip
                                size="small"
                                label={`${aeropuerto.maletasActuales}/${aeropuerto.capacidadAlmacen}`}
                                title={`Capacidad: ${estado}`}
                                sx={{ bgcolor: colorCapacidad, color: '#fff', fontWeight: 700 }}
                              />
                            </Stack>
                          </Stack>
                          <Stack className={styles.airportFooter}>
                            <Typography variant="body2" className={styles.airportLocation}>
                              {aeropuerto.ciudad} - {aeropuerto.pais}
                            </Typography>
                            {proximosSLA.length > 0 && (
                              <Stack className={styles.airportProximidad}>
                                <Typography variant="caption" className={styles.airportProximidadLinea}>
                                  S: {formatShortDateTime(proximosSLA[0].fechaHoraSalidaUtc)}
                                </Typography>
                                <Typography variant="caption" className={styles.airportProximidadLinea}>
                                  L: {formatShortDateTime(proximosSLA[0].fechaHoraLlegadaUtc)}
                                </Typography>
                              </Stack>
                            )}
                          </Stack>
                        </Box>
                      </Button>
                      {estaExpandido && (
                        <Box className={styles.expandedContent}>
                          {loadingMaletas[aeropuerto.codigoIata] ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={22} /></Box>
                          ) : errorMaletas[aeropuerto.codigoIata] ? (
                            <Typography variant="body2" color="error">{errorMaletas[aeropuerto.codigoIata]}</Typography>
                          ) : !maletasPorAeropuerto[aeropuerto.codigoIata]?.length ? (
                            <Box className={styles.empty}>Sin maletas en este aeropuerto</Box>
                          ) : (() => {
                            const maletas = maletasPorAeropuerto[aeropuerto.codigoIata];
                            const pagina = paginaMaletas[aeropuerto.codigoIata] ?? 0;
                            const totalPags = Math.ceil(maletas.length / MALETAS_POR_PAGINA);
                            const paginadas = maletas.slice(pagina * MALETAS_POR_PAGINA, (pagina + 1) * MALETAS_POR_PAGINA);
                            return (
                              <>
                                <Typography variant="caption" sx={{ color: '#94a3b8', px: 1, pb: 0.5, display: 'block' }}>
                                  {maletas.length} maletas en almacén
                                </Typography>
                                <Table size="small" className={styles.table}>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Código</TableCell>
                                      <TableCell>Origen</TableCell>
                                      <TableCell>Destino</TableCell>
                                      <TableCell>Tipo</TableCell>
                                      <TableCell></TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {paginadas.map((m) => (
                                      <TableRow key={m.codigoMaleta}>
                                        <TableCell sx={{ fontSize: 11 }}>{m.codigoMaleta}</TableCell>
                                        <TableCell>{m.origenIata}</TableCell>
                                        <TableCell>{m.destinoIata}</TableCell>
                                        <TableCell sx={{ fontSize: 11 }}>{m.tipoAlmacen === 'DESTINO_FINAL' ? 'Destino' : 'Tránsito'}</TableCell>
                                        <TableCell>
                                          <button
                                            onClick={() => onMostrarRutaEnvio(m.idPedido)}
                                            style={{ border: 'none', borderRadius: 4, padding: '3px 8px', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                          >
                                            Ruta
                                          </button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                                {totalPags > 1 && (
                                  <Stack direction="row" sx={{justifyContent:"center",pt:0.5}}>
                                    <Pagination
                                      size="small"
                                      page={pagina + 1}
                                      count={totalPags}
                                      onChange={(_, v) => setPaginaMaletas(p => ({ ...p, [aeropuerto.codigoIata]: v - 1 }))}
                                    />
                                  </Stack>
                                )}
                              </>
                            );
                          })()}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN ENVÍOS
// ══════════════════════════════════════════════════════════════════════════════

function SeccionEnvios({
  envios,
  tiempoSimulacion,
  onMostrarRutaEnvio,
  onObtenerRutaEnvio,
  integrada,
}: {
  envios: Envio[];
  tiempoSimulacion: number;
  onMostrarRutaEnvio: (idPedido: string) => void;
  onObtenerRutaEnvio: (idPedido: string) => Promise<EnvioRuta | null>;
  integrada?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busquedaOrigen, setBusquedaOrigen] = useState('');
  const [busquedaDestino, setBusquedaDestino] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEnvio>('');
  const [horasTexto, setHorasTexto] = useState('4');
  const [ultimasHoras, setUltimasHoras] = useState(4);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [expandidoEnvio, setExpandidoEnvio] = useState<string | null>(null);
  const [rutaSeleccionada, setRutaSeleccionada] = useState<EnvioRuta | null>(null);
  const abiertoEfectivo = integrada || abierto;

  const verRuta = async (idPedido: string) => {
    const ruta = await onObtenerRutaEnvio(idPedido);
    if (ruta) setRutaSeleccionada(ruta);
  };

  const enviosFiltrados = useMemo(() => {
    const inicioIntervalo = tiempoSimulacion - ultimasHoras * 60 * 60 * 1000;
    const enviosUnicos = new Map(envios.map((envio) => [envio.idPedido, envio]));

    return Array.from(enviosUnicos.values()).filter((e) => {
      const origen = !busquedaOrigen || e.origenIata.toLowerCase().includes(busquedaOrigen.trim().toLowerCase());
      const destino = !busquedaDestino || e.destinoIata.toLowerCase().includes(busquedaDestino.trim().toLowerCase());
      if (!origen || !destino) return false;
      if (filtroEstado === 'ULTIMAS_HORAS') {
        return e._estado === 'ENTREGADO'
          && e._llegadaEpoch !== undefined
          && e._llegadaEpoch >= inicioIntervalo
          && e._llegadaEpoch <= tiempoSimulacion;
      }
      return !filtroEstado || e._estado === filtroEstado;
    });
  }, [envios, busquedaOrigen, busquedaDestino, filtroEstado, tiempoSimulacion, ultimasHoras]);

  const cambiarUltimasHoras = (valor: string) => {
    if (valor === '') {
      setHorasTexto(valor);
      return;
    }
    if (!/^\d+$/.test(valor)) return;
    const horas = Number(valor);
    if (Number.isInteger(horas) && horas >= 1 && horas <= 168) {
      setHorasTexto(valor);
      setUltimasHoras(horas);
      setPage(0);
    }
  };

  const mensajeVacio = filtroEstado === 'ULTIMAS_HORAS'
    ? `No hay envíos entregados en las últimas ${ultimasHoras} horas`
    : filtroEstado === 'PLANIFICADO'
      ? 'No hay envíos planificados'
      : filtroEstado === 'POR_PLANIFICAR'
        ? 'No hay envíos por planificar'
      : filtroEstado === 'EN_CURSO'
        ? 'No hay envíos en tránsito'
        : filtroEstado === 'ENTREGADO'
          ? 'No hay envíos entregados'
          : 'No hay envíos registrados';

  return (
    <Accordion
      expanded={abiertoEfectivo}
      onChange={(_, v) => { if (!integrada) setAbierto(v); }}
      disableGutters
      sx={seccionIntegradaSx}
    >
      <AccordionSummary className={styles.accordionSummary} sx={{ display: integrada ? 'none' : undefined }}>
        <Typography sx={{ fontWeight: 700 }}>Envíos</Typography>
        <Chip size="small" label={enviosFiltrados.length} color={enviosFiltrados.length ? 'primary' : 'default'} />
      </AccordionSummary>
      <AccordionDetails className={styles.accordionDetails} sx={{ flex: 1, minHeight: 0, maxHeight: 'none' }}>
        {abiertoEfectivo && (
          <>
            <Stack spacing={1.5} className={styles.filtersContainer}>
              <Stack direction="row" spacing={1.5}>
                <TextField size="small" value={busquedaOrigen} onChange={(e) => { setBusquedaOrigen(e.target.value); setPage(0); }} placeholder="IATA origen" fullWidth className={styles.input} />
                <TextField size="small" value={busquedaDestino} onChange={(e) => { setBusquedaDestino(e.target.value); setPage(0); }} placeholder="IATA destino" fullWidth className={styles.input} />
              </Stack>
              <FormControl size="small" fullWidth className={styles.input}>
                <InputLabel>Filtrar envíos</InputLabel>
                <Select value={filtroEstado} label="Filtrar envíos" onChange={(e: SelectChangeEvent) => { setFiltroEstado(e.target.value as FiltroEnvio); setPage(0); }}>
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="PLANIFICADO">Planificados</MenuItem>
                  <MenuItem value="POR_PLANIFICAR">Por planificar</MenuItem>
                  <MenuItem value="EN_CURSO">En tránsito</MenuItem>
                  <MenuItem value="ENTREGADO">Entregados</MenuItem>
                  <MenuItem value="ULTIMAS_HORAS">Entregados en las últimas X horas</MenuItem>
                </Select>
              </FormControl>
              {filtroEstado === 'ULTIMAS_HORAS' && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                    Entregados en las últimas
                  </Typography>
                  <TextField
                    type="number"
                    size="small"
                    value={horasTexto}
                    onChange={(e) => cambiarUltimasHoras(e.target.value)}
                    slotProps={{ htmlInput: { min: 1, max: 168, step: 1, 'aria-label': 'Últimas horas de entregas' } }}
                    className={styles.input}
                    sx={{ width: 72 }}
                  />
                  <Typography variant="caption" sx={{ color: '#cbd5e1' }}>horas</Typography>
                </Stack>
              )}
            </Stack>

            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, border: '1px solid rgba(148,163,184,0.2)', borderRadius: 1, overflow: 'hidden', bgcolor: 'rgba(30,41,59,0.82)' }}>
              <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#64748b rgba(15,23,42,0.45)' }}>
                  <Table stickyHeader size="small" className={styles.table}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ bgcolor: '#1e293b', zIndex: 2, maxWidth: 110 }}>ID</TableCell>
                        <TableCell sx={{ bgcolor: '#1e293b', zIndex: 2 }}>Ruta</TableCell>
                        <TableCell sx={{ bgcolor: '#1e293b', zIndex: 2 }}>Registro</TableCell>
                        <TableCell sx={{ bgcolor: '#1e293b', zIndex: 2 }}>Estado</TableCell>
                        <TableCell sx={{ width: 28, bgcolor: '#1e293b', zIndex: 2 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {enviosFiltrados.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className={styles.empty}>{mensajeVacio}</TableCell>
                        </TableRow>
                      )}
                      {enviosFiltrados.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map((e, index) => {
                        const posicionAbsoluta = page * rowsPerPage + index;
                        const rowKey = e.idPedido
                          ? `${e.idPedido}-${posicionAbsoluta}`
                          : `${e.origenIata}-${e.destinoIata}-${e.fechaHora}-${posicionAbsoluta}`;

                        return (
                          <React.Fragment key={rowKey}>
                            <TableRow
                              key={`${rowKey}-main`}
                              onClick={() => setExpandidoEnvio(cur => cur === e.idPedido ? null : e.idPedido)}
                              sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(56,189,248,0.08)' }, bgcolor: expandidoEnvio === e.idPedido ? 'rgba(56,189,248,0.1)' : 'transparent' }}
                            >
                              {/* ID truncado; hover muestra el completo */}
                              <TableCell
                                title={e.idPedido}
                                sx={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}
                              >
                                {e.idPedido}
                              </TableCell>
                              {/* Origen → Destino en una sola celda */}
                              <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                                {e.origenIata} → {e.destinoIata}
                              </TableCell>
                              <TableCell
                                title={e.fechaHora}
                                sx={{ whiteSpace: 'nowrap', fontSize: 10.5, color: '#cbd5e1' }}
                              >
                                {formatShortDateTime(e.fechaHora)}
                              </TableCell>
                              {/* Estado como chip */}
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={
                                    e._estado === 'EN_CURSO' ? 'En curso'
                                    : e._estado === 'ENTREGADO' ? 'Entregado'
                                    : e._estado === 'PLANIFICADO' ? 'Planificado'
                                    : e._estado === 'POR_PLANIFICAR' ? 'Por planificar'
                                    : (e._estado ?? '—')
                                  }
                                  color={
                                    e._estado === 'EN_CURSO' ? 'warning'
                                    : e._estado === 'ENTREGADO' ? 'success'
                                    : 'default'
                                  }
                                  sx={{ fontSize: 10, height: 20 }}
                                />
                              </TableCell>
                              <TableCell align="right" sx={{ color: '#64748b', fontSize: 10, pr: 1 }}>
                                {expandidoEnvio === e.idPedido ? '▲' : '▼'}
                              </TableCell>
                            </TableRow>

                            {/* Fila expandida: maletas con salida, llegada y boton Ruta */}
                            <TableRow key={`${rowKey}-detail`}>
                              <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
                                <Collapse in={expandidoEnvio === e.idPedido} unmountOnExit>
                                  <Box sx={{ bgcolor: 'rgba(15,23,42,0.6)', px: 1.5, py: 1 }}>
                                    <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 0.5 }}>
                                      {e.cantidadMaletas} maleta{e.cantidadMaletas !== 1 ? 's' : ''}
                                    </Typography>
                                    <Stack spacing={0.5}>
                                      {Array.from({ length: e.cantidadMaletas }, (_, i) => (
                                        <Box
                                          key={`${rowKey}-M${i + 1}`}
                                          sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            bgcolor: 'rgba(30,41,59,0.7)',
                                            borderRadius: 1,
                                            px: 1,
                                            py: 0.4,
                                          }}
                                        >
                                          {/* Codigo completo */}
                                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mr: 0.5 }}>
                                            {e.idPedido}-M{i + 1}
                                          </Typography>
                                          {/* Salida (fecha registro del pedido) */}
                                          <Typography variant="caption" sx={{ color: '#94a3b8', whiteSpace: 'nowrap', mr: 0.5, fontSize: 10 }}>
                                            ↑{e.fechaHora ? new Date(e.fechaHora).toLocaleString('es-PE', { timeZone: 'UTC', hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                          </Typography>
                                          {/* Llegada estimada */}
                                          <Typography variant="caption" sx={{ color: '#94a3b8', whiteSpace: 'nowrap', mr: 0.5, fontSize: 10 }}>
                                            ↓{e._llegadaEpoch ? new Date(e._llegadaEpoch).toLocaleString('es-PE', { timeZone: 'UTC', hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                          </Typography>
                                          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                                            <button
                                              onClick={(ev) => { ev.stopPropagation(); onMostrarRutaEnvio(e.idPedido); }}
                                              style={{ border: 'none', borderRadius: 4, padding: '2px 7px', background: '#2563eb', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                                            >
                                              Mapa
                                            </button>
                                            <button
                                              onClick={(ev) => { ev.stopPropagation(); void verRuta(e.idPedido); }}
                                              style={{ border: '1px solid #60a5fa', borderRadius: 4, padding: '2px 7px', background: 'transparent', color: '#bfdbfe', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                                            >
                                              Detalle
                                            </button>
                                          </Stack>
                                        </Box>
                                      ))}
                                    </Stack>
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
              </Box>
              <TablePagination
                component="div"
                page={page}
                onPageChange={(_, v) => setPage(v)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[10, 25, 50]}
                onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                count={enviosFiltrados.length}
                labelRowsPerPage="Filas por página:"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                sx={{ flexShrink: 0, color: '#e2e8f0', borderTop: '1px solid rgba(148,163,184,0.18)', overflow: 'hidden', '& .MuiTablePagination-toolbar': { minHeight: 52, px: 1 }, '& .MuiTablePagination-selectLabel': { fontSize: 11 }, '& .MuiTablePagination-displayedRows': { fontSize: 11 }, '& .MuiSvgIcon-root': { color: '#cbd5e1' } }}
              />
              <Dialog open={Boolean(rutaSeleccionada)} onClose={() => setRutaSeleccionada(null)} fullWidth maxWidth="sm">
                <DialogTitle>Ruta del envío {rutaSeleccionada?.envio.idPedido}</DialogTitle>
                <DialogContent dividers>
                  {rutaSeleccionada && (
                    <Stack spacing={1.25}>
                      <Typography variant="body2">
                        {rutaSeleccionada.envio.origenIata} → {rutaSeleccionada.envio.destinoIata} · {rutaSeleccionada.envio.cantidadMaletas} maletas
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Estado: {rutaSeleccionada.estado} · Ubicación actual: {rutaSeleccionada.aeropuertoActual ?? 'No disponible'}
                      </Typography>
                      {rutaSeleccionada.escalas.length === 0 ? (
                        <Typography variant="body2">El envío no tiene un itinerario asignado.</Typography>
                      ) : rutaSeleccionada.escalas.map((escala, index) => (
                        <Box key={`${escala.codigoVuelo}-${index}`} sx={{ borderLeft: '3px solid #2563eb', pl: 1.5, py: 0.25 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {index + 1}. Vuelo {escala.codigoVuelo}: {escala.origenIata} → {escala.destinoIata}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatShortDateTime(escala.horaSalidaUtc ?? '')} - {formatShortDateTime(escala.horaLlegadaUtc ?? '')}
                            {escala.cancelado ? ' · Cancelado' : ''}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setRutaSeleccionada(null)}>Cerrar</Button>
                </DialogActions>
              </Dialog>
            </Box>
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
