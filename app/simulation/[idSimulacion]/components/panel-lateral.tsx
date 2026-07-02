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
import React, { RefObject, useEffect, useMemo, useRef, useState } from 'react';
import Draggable from 'react-draggable';

import type { AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import type { EstadoCapacidad, EventoVuelo } from '@/app/shared/types/Evento';
import type { Envio, MaletaSimulacion } from '@/app/shared/types/Envio';
import { SimulacionService } from '@/app/services/simulation.service';
import {
  calcularOcupacionAeropuerto,
  calcularOcupacionVuelo,
  obtenerEstadoAeropuerto,
  obtenerEstadoPorOcupacion,
  obtenerEstadoVuelo,
} from '@/app/shared/simulation/semaforo';
import styles from '../../../stylesheets/simpanel.module.css';

// ─── Tipos compartidos ────────────────────────────────────────────────────────

type OrdenVuelos = 'ocupacion' | 'salida' | 'llegada' | 'origen' | 'destino';
type OrdenAeropuertos = 'calcularOcupacion' | 'calcularProximidadSalida' | 'calcularProximidadLlegada';
type DireccionOrden = 'asc' | 'desc';
type EstadoEnvio = 'EN_CURSO' | 'ENTREGADO' | 'PLANIFICADO';

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
  // vuelos
  vuelosActivos: EventoVuelo[];
  seleccionarVuelo: (codigoVuelo: string) => void;
  onEnfocarVuelo: (codigoVuelo: string | number) => void;
  onFiltradoVuelosCambiado?: (codigos: string[] | null) => void;
  // aeropuertos
  aeropuertos: AeropuertoSimulacion[];
  onEnfocarAeropuerto: (codigoIata: string) => void;
  onFiltradoAeropuertosCambiado?: (iatas: string[] | null) => void;
  // envíos
  envios: Envio[];
  onMostrarRutaEnvio: (idPedido: string) => void;
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

// ─── Componente principal ─────────────────────────────────────────────────────

export function PanelLateral({
  visible,
  idSimulacion,
  vuelosActivos,
  tiempoSimulacionRef,
  seleccionarVuelo,
  onEnfocarVuelo,
  onFiltradoVuelosCambiado,
  aeropuertos,
  onEnfocarAeropuerto,
  onFiltradoAeropuertosCambiado,
  envios,
  onMostrarRutaEnvio,
}: PanelLateralProps) {
  const nodeRef = useRef<HTMLDivElement>(null);

  if (!visible) return null;

  return (
    <Draggable nodeRef={nodeRef as RefObject<HTMLDivElement>} handle=".drag-handle">
      <Paper
        ref={nodeRef}
        elevation={8}
        sx={{
          position: 'absolute',
          top: 88,
          left: 16,
          zIndex: 21,
          width: 390,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'rgba(15, 23, 42, 0.94)',
          color: '#f8fafc',
          border: '1px solid rgba(148, 163, 184, 0.24)',
          borderRadius: 2,
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
        </Box>

        {/* Contenido scrollable */}
        <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <SeccionVuelos
            idSimulacion={idSimulacion}
            vuelosActivos={vuelosActivos}
            tiempoSimulacionRef={tiempoSimulacionRef}
            seleccionarVuelo={seleccionarVuelo}
            onEnfocarVuelo={onEnfocarVuelo}
            onFiltradoCambiado={onFiltradoVuelosCambiado}
            onMostrarRutaEnvio={onMostrarRutaEnvio}
          />
          <SeccionAeropuertos
            idSimulacion={idSimulacion}
            tiempoSimulacionRef={tiempoSimulacionRef}
            aeropuertos={aeropuertos}
            onEnfocarAeropuerto={onEnfocarAeropuerto}
            onFiltradoCambiado={onFiltradoAeropuertosCambiado}
            onMostrarRutaEnvio={onMostrarRutaEnvio}
          />
          <SeccionEnvios
            envios={envios}
            onMostrarRutaEnvio={onMostrarRutaEnvio}
          />
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
  tiempoSimulacionRef,
  seleccionarVuelo,
  onEnfocarVuelo,
  onFiltradoCambiado,
  onMostrarRutaEnvio,
}: {
  idSimulacion: string;
  vuelosActivos: EventoVuelo[];
  tiempoSimulacionRef: RefObject<number>;
  seleccionarVuelo: (codigoVuelo: string) => void;
  onEnfocarVuelo: (codigoVuelo: string | number) => void;
  onFiltradoCambiado?: (codigos: string[] | null) => void;
  onMostrarRutaEnvio: (idPedido: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<OrdenVuelos>('ocupacion');
  const [filtroEstados, setFiltroEstados] = useState<EstadoCapacidad[]>(ESTADOS_CAPACIDAD);
  const [vueloExpandido, setVueloExpandido] = useState<string | null>(null);
  const [enviosPorVuelo, setEnviosPorVuelo] = useState<Record<string, Envio[]>>({});
  const [loadingPorVuelo, setLoadingPorVuelo] = useState<Record<string, boolean>>({});
  const [errorPorVuelo, setErrorPorVuelo] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const rowsPerPage = 20;

  const vuelosFiltrados = useMemo(() => {
    const filtro = busqueda.trim().toLowerCase();
    return [...vuelosActivos]
      .filter((v) => {
        const texto = !filtro || [String(v.codigoVuelo), v.origenIata, v.destinoIata].some((s) => s.toLowerCase().includes(filtro));
        return texto && filtroEstados.includes(obtenerEstadoVuelo(v));
      })
      .sort((a, b) => {
        switch (orden) {
          case 'salida': return new Date(a.horaSalidaUtc).getTime() - new Date(b.horaSalidaUtc).getTime();
          case 'llegada': return new Date(a.horaLlegadaUtc).getTime() - new Date(b.horaLlegadaUtc).getTime();
          case 'origen': return a.origenIata.localeCompare(b.origenIata, 'es');
          case 'destino': return a.destinoIata.localeCompare(b.destinoIata, 'es');
          default: return calcularOcupacionVuelo(b.cantidadMaletas, b.capacidadMax) - calcularOcupacionVuelo(a.cantidadMaletas, a.capacidadMax);
        }
      });
  }, [busqueda, orden, filtroEstados, vuelosActivos]);

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
      expanded={abierto}
      onChange={(_, v) => setAbierto(v)}
      disableGutters
      sx={{ bgcolor: 'transparent', color: 'inherit', '&:before': { display: 'none' }, borderBottom: '1px solid rgba(148,163,184,0.15)' }}
    >
      <AccordionSummary className={styles.accordionSummary}>
        <Typography sx={{ fontWeight: 700 }}>Vuelos en aire</Typography>
        <Chip size="small" label={vuelosActivos.length} color={vuelosActivos.length ? 'primary' : 'default'} />
      </AccordionSummary>
      <AccordionDetails className={styles.accordionDetails}>
        {abierto && (
          <>
            <Stack spacing={1.5} className={styles.filtersContainer}>
              <TextField size="small" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar vuelo, origen o destino" fullWidth className={styles.input} />
              <FormControl size="small" fullWidth className={styles.input}>
                <InputLabel>Ordenar por</InputLabel>
                <Select value={orden} label="Ordenar por" onChange={(e: SelectChangeEvent) => setOrden(e.target.value as OrdenVuelos)}>
                  <MenuItem value="ocupacion">Nivel de ocupación</MenuItem>
                  <MenuItem value="salida">Hora salida</MenuItem>
                  <MenuItem value="llegada">Hora llegada</MenuItem>
                  <MenuItem value="origen">Origen</MenuItem>
                  <MenuItem value="destino">Destino</MenuItem>
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
                  return (
                    <Box key={codigo} className={styles.airportBoxList}>
                      <Button fullWidth onClick={() => seleccionarVuelo(codigo)} className={styles.airportButton}>
                        <Box className={styles.airportContent}>
                          <Stack className={styles.airportHeader}>
                            <Typography className={styles.airportCode}>Vuelo {codigo}</Typography>
                            <Chip size="small" label={estado} color={colorPorEstado[estado]} />
                          </Stack>
                          <Typography variant="body2" className={styles.airportLocation}>{vuelo.origenIata} - {vuelo.destinoIata}</Typography>
                          <Stack className={styles.airportFooter}>
                            <Typography variant="caption" className={styles.airportCapacity}>{maletas}/{vuelo.capacidadMax} maletas</Typography>
                            <Typography variant="caption" className={styles.airportOccupation}>{ocup}%</Typography>
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
  idSimulacion,
  tiempoSimulacionRef,
  aeropuertos,
  onEnfocarAeropuerto,
  onFiltradoCambiado,
  onMostrarRutaEnvio,
}: {
  idSimulacion: string;
  tiempoSimulacionRef: RefObject<number>;
  aeropuertos: AeropuertoSimulacion[];
  onEnfocarAeropuerto: (iata: string) => void;
  onFiltradoCambiado?: (iatas: string[] | null) => void;
  onMostrarRutaEnvio: (idPedido: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroContinente, setFiltroContinente] = useState('');
  const [filtroEstados, setFiltroEstados] = useState<EstadoCapacidad[]>(ESTADOS_CAPACIDAD);
  const [tipoOrden, setTipoOrden] = useState<OrdenAeropuertos>('calcularOcupacion');
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('desc');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [maletasPorAeropuerto, setMaletasPorAeropuerto] = useState<Record<string, MaletaSimulacion[]>>({});
  const [loadingMaletas, setLoadingMaletas] = useState<Record<string, boolean>>({});
  const [errorMaletas, setErrorMaletas] = useState<Record<string, string>>({});
  const [paginaMaletas, setPaginaMaletas] = useState<Record<string, number>>({});
  const MALETAS_POR_PAGINA = 10;

  const cargarMaletas = async (iata: string) => {
    if (maletasPorAeropuerto[iata] || loadingMaletas[iata]) return;
    setLoadingMaletas(p => ({ ...p, [iata]: true }));
    try {
      const ts = new Date(tiempoSimulacionRef.current).toISOString();
      const { data } = await SimulacionService.obtenerMaletasPorAeropuerto(idSimulacion, iata, ts);
      setMaletasPorAeropuerto(p => ({ ...p, [iata]: data }));
    } catch {
      setErrorMaletas(p => ({ ...p, [iata]: 'No se pudieron cargar las maletas.' }));
    } finally {
      setLoadingMaletas(p => ({ ...p, [iata]: false }));
    }
  };

  const toggleExpandido = (iata: string) => {
    onEnfocarAeropuerto(iata);
    if (expandido === iata) {
      setExpandido(null);
    } else {
      setExpandido(iata);
      cargarMaletas(iata);
    }
  };

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
      expanded={abierto}
      onChange={(_, v) => setAbierto(v)}
      disableGutters
      sx={{ bgcolor: 'transparent', color: 'inherit', '&:before': { display: 'none' }, borderBottom: '1px solid rgba(148,163,184,0.15)' }}
    >
      <AccordionSummary className={styles.accordionSummary}>
        <Typography sx={{ fontWeight: 700 }}>Aeropuertos</Typography>
        <Chip size="small" label={aeropuertos.length} color={aeropuertos.length ? 'primary' : 'default'} />
      </AccordionSummary>
      <AccordionDetails className={styles.accordionDetails}>
        {abierto && (
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
                  const ocup = calcularOcupacionAeropuerto(aeropuerto);
                  const estado = obtenerEstadoAeropuerto(aeropuerto);
                  const proximosSLA = aeropuerto.enviosProximosAVencer || [];
                  const estaExpandido = expandido === aeropuerto.codigoIata;
                  return (
                    <Box key={aeropuerto.codigoIata} className={styles.airportBoxList}>
                      <Button fullWidth onClick={() => toggleExpandido(aeropuerto.codigoIata)} className={styles.airportButton}>
                        <Box className={styles.airportContent}>
                          <Stack className={styles.airportHeader}>
                            <Typography className={styles.airportCode}>{aeropuerto.codigoIata}</Typography>
                            <Stack className={styles.airportChips}>
                              {proximosSLA.length > 0 && <Chip size="small" label={`${proximosSLA.length} SLA`} color="warning" variant="outlined" />}
                              <Chip size="small" label={estado} color={colorPorEstado[estado]} />
                            </Stack>
                          </Stack>
                          <Typography variant="body2" className={styles.airportLocation}>{aeropuerto.ciudad} - {aeropuerto.pais}</Typography>
                          <Stack className={styles.airportFooter}>
                            <Typography variant="caption" className={styles.airportCapacity}>{aeropuerto.maletasActuales}/{aeropuerto.capacidadAlmacen} maletas</Typography>
                            <Typography variant="caption" className={styles.airportCode}>{ocup}%</Typography>
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
  onMostrarRutaEnvio,
}: {
  envios: Envio[];
  onMostrarRutaEnvio: (idPedido: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busquedaOrigen, setBusquedaOrigen] = useState('');
  const [busquedaDestino, setBusquedaDestino] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [expandidoEnvio, setExpandidoEnvio] = useState<string | null>(null);

  const enviosFiltrados = useMemo(() => {
    return envios.filter((e) => {
      const origen = !busquedaOrigen || e.origenIata.toLowerCase().includes(busquedaOrigen.trim().toLowerCase());
      const destino = !busquedaDestino || e.destinoIata.toLowerCase().includes(busquedaDestino.trim().toLowerCase());
      const estado = !filtroEstado || (e as any)._estado === filtroEstado;
      return origen && destino && estado;
    });
  }, [envios, busquedaOrigen, busquedaDestino, filtroEstado]);

  return (
    <Accordion
      expanded={abierto}
      onChange={(_, v) => setAbierto(v)}
      disableGutters
      sx={{ bgcolor: 'transparent', color: 'inherit', '&:before': { display: 'none' } }}
    >
      <AccordionSummary className={styles.accordionSummary}>
        <Typography sx={{ fontWeight: 700 }}>Envíos</Typography>
        <Chip size="small" label={envios.length} color={envios.length ? 'primary' : 'default'} />
      </AccordionSummary>
      <AccordionDetails className={styles.accordionDetails}>
        {abierto && (
          <>
            <Stack spacing={1.5} className={styles.filtersContainer}>
              <Stack direction="row" spacing={1.5}>
                <TextField size="small" value={busquedaOrigen} onChange={(e) => setBusquedaOrigen(e.target.value)} placeholder="IATA origen" fullWidth className={styles.input} />
                <TextField size="small" value={busquedaDestino} onChange={(e) => setBusquedaDestino(e.target.value)} placeholder="IATA destino" fullWidth className={styles.input} />
              </Stack>
              <FormControl size="small" fullWidth className={styles.input}>
                <InputLabel>Filtrar por estado</InputLabel>
                <Select value={filtroEstado} label="Filtrar por estado" onChange={(e: SelectChangeEvent) => setFiltroEstado(e.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="PLANIFICADO">Planificados</MenuItem>
                  <MenuItem value="EN_CURSO">En vuelo</MenuItem>
                  <MenuItem value="ENTREGADO">Entregados</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            {enviosFiltrados.length === 0 ? (
              <Box className={styles.empty}>No hay envíos disponibles</Box>
            ) : (
              <Stack className={styles.scrollList}>
                <Box sx={{ border: '1px solid rgba(148,163,184,0.2)', borderRadius: 1, overflow: 'hidden', bgcolor: 'rgba(30,41,59,0.82)' }}>
                  <Table size="small" className={styles.table}>
                    <TableHead><TableRow><TableCell>ID</TableCell><TableCell>Origen</TableCell><TableCell>Destino</TableCell><TableCell align="right">Maletas</TableCell><TableCell /></TableRow></TableHead>
                    <TableBody>
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
                              <TableCell sx={{ fontSize: 11 }}>{e.idPedido}</TableCell>
                              <TableCell>{e.origenIata}</TableCell>
                              <TableCell>{e.destinoIata}</TableCell>
                              <TableCell align="right">{e.cantidadMaletas}</TableCell>
                              <TableCell align="right" sx={{ color: '#64748b', fontSize: 10 }}>
                                {expandidoEnvio === e.idPedido ? '▲' : '▼'}
                              </TableCell>
                            </TableRow>
                            <TableRow key={`${rowKey}-detail`}>
                              <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
                                <Collapse in={expandidoEnvio === e.idPedido} unmountOnExit>
                                  <Box sx={{ bgcolor: 'rgba(15,23,42,0.6)', px: 1.5, py: 1 }}>
                                    <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 0.5 }}>
                                      {e.cantidadMaletas} maleta{e.cantidadMaletas !== 1 ? 's' : ''}
                                    </Typography>
                                    <Table size="small">
                                      <TableBody>
                                        {Array.from({ length: e.cantidadMaletas }, (_, i) => (
                                          <TableRow key={`${rowKey}-M${i + 1}`}>
                                            <TableCell sx={{ fontSize: 10, color: '#cbd5e1', border: 0 }}>{e.idPedido}-M{i + 1}</TableCell>
                                            <TableCell sx={{ fontSize: 10, border: 0 }}>{e.origenIata}</TableCell>
                                            <TableCell sx={{ fontSize: 10, border: 0 }}>{e.destinoIata}</TableCell>
                                            <TableCell sx={{ border: 0 }}>
                                              <button
                                                onClick={(ev) => { ev.stopPropagation(); onMostrarRutaEnvio(e.idPedido); }}
                                                style={{ border: 'none', borderRadius: 4, padding: '2px 7px', background: '#2563eb', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                                              >
                                                Ruta
                                              </button>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        );
                      })}
                      <TableRow>
                        <TablePagination
                          page={page}
                          onPageChange={(_, v) => setPage(v)}
                          rowsPerPage={rowsPerPage}
                          onRowsPerPageChange={(e) => setRowsPerPage(Number(e.target.value))}
                          count={enviosFiltrados.length}
                          sx={{ color: '#e2e8f0', '& .MuiSvgIcon-root': { color: '#cbd5e1' } }}
                        />
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              </Stack>
            )}
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
