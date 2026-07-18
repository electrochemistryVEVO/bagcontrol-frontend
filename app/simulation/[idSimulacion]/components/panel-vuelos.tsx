'use client';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  Pagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import {useMemo, useState, RefObject, useRef, useEffect} from 'react';
import { SimulacionService } from '@/app/services/simulation.service';
import type { Envio } from '@/app/shared/types/Envio';
import type { EstadoCapacidad, EventoVuelo } from '@/app/shared/types/Evento';
import styles from '../../../stylesheets/simpanel.module.css'
import Draggable from "react-draggable";
import {
  calcularOcupacionVuelo,
  obtenerEstadoPorOcupacion,
  obtenerEstadoVuelo,
} from '@/app/shared/simulation/semaforo';

type OrdenVuelos = 'ocupacion' | 'salida' | 'llegada' | 'origen' | 'destino';

type PanelVuelosProps = {
  idSimulacion: string;
  vuelosActivos: EventoVuelo[];
  tiempoSimulacionRef: RefObject<number>;
  seleccionarVuelo:(codigoVuelo: string) => void;
  visible: boolean;
  onEnfocarVuelo: (codigoVuelo: string | number) => void;
  onFiltradoCambiado?: (codigos: string[] | null) => void;
};

type EnviosPorVuelo = Record<string, Envio[]>;
type LoadingPorVuelo = Record<string, boolean>;

const colorPorEstado: Record<EstadoCapacidad, 'success' | 'warning' | 'error' | 'default'> = {
  VACIO: 'default',
  VERDE: 'success',
  AMARILLO: 'warning',
  ROJO: 'error',
};

const ESTADOS_CAPACIDAD: EstadoCapacidad[] = ['VACIO', 'VERDE', 'AMARILLO', 'ROJO'];

const etiquetaPorEstado: Record<EstadoCapacidad, string> = {
  VACIO: 'Vacío',
  VERDE: 'Verde',
  AMARILLO: 'Amarillo',
  ROJO: 'Rojo',
};

function calcularOcupacionPorMaletas(cantidadMaletas: number, capacidadMax: number) {
  return calcularOcupacionVuelo(cantidadMaletas, capacidadMax);
}

function calcularOcupacion(vuelo: EventoVuelo) {
  return calcularOcupacionPorMaletas(vuelo.cantidadMaletas, vuelo.capacidadMax);
}

function compararTexto(a: string, b: string) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' });
}

export function PanelVuelos({ idSimulacion, vuelosActivos, tiempoSimulacionRef, visible, seleccionarVuelo, onEnfocarVuelo, onFiltradoCambiado }: PanelVuelosProps) {

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<OrdenVuelos>('ocupacion');
  const [filtroEstados, setFiltroEstados] = useState<EstadoCapacidad[]>(ESTADOS_CAPACIDAD);
  const [vueloExpandido, setVueloExpandido] = useState<string | null>(null);
  const [enviosPorVuelo, setEnviosPorVuelo] = useState<EnviosPorVuelo>({});
  const [loadingPorVuelo, setLoadingPorVuelo] = useState<LoadingPorVuelo>({});
  const [errorPorVuelo, setErrorPorVuelo] = useState<Record<string, string>>({});

  const nodeRef = useRef<HTMLDivElement>(null);

  const [page,setPage] = useState<number>(1);
  //const [rowsPerPage,setRowsPerPage] = useState<number>(10);
  const rowsPerPage = 20;

  const vuelosFiltrados = useMemo(() => {
    const filtro = busqueda.trim().toLowerCase();

    return [...vuelosActivos]
      .filter((vuelo) => {
        const coincideTexto = !filtro || [
          String(vuelo.codigoVuelo),
          vuelo.origenIata,
          vuelo.destinoIata,
        ].some((valor) => valor.toLowerCase().includes(filtro));
        const coincideEstado = filtroEstados.includes(obtenerEstadoVuelo(vuelo));
        return coincideTexto && coincideEstado;
      })
      .sort((a, b) => {
        switch (orden) {
          case 'salida':
            return new Date(a.horaSalidaUtc || a.horaSalidaLocal).getTime() - new Date(b.horaSalidaUtc || b.horaSalidaLocal).getTime();
          case 'llegada':
            return new Date(a.horaLlegadaUtc || a.horaLlegadaLocal).getTime() - new Date(b.horaLlegadaUtc || b.horaLlegadaLocal).getTime();
          case 'origen':
            return compararTexto(a.origenIata, b.origenIata);
          case 'destino':
            return compararTexto(a.destinoIata, b.destinoIata);
          case 'ocupacion':
          default:
            return calcularOcupacion(b) - calcularOcupacion(a);
        }
      });
  }, [busqueda, orden, filtroEstados, vuelosActivos]);

  // Notificar al mapa la lista filtrada
  const hayFiltroActivo = busqueda.trim() !== '' || filtroEstados.length < ESTADOS_CAPACIDAD.length;
  useEffect(() => {
    if (!onFiltradoCambiado) return;
    if (hayFiltroActivo) {
      onFiltradoCambiado(vuelosFiltrados.map(v => String(v.codigoVuelo)));
    } else {
      onFiltradoCambiado(null);
    }
  }, [vuelosFiltrados, hayFiltroActivo, onFiltradoCambiado]);

  const toggleFiltroEstado = (estado: EstadoCapacidad) => {
    setFiltroEstados((actual) =>
      actual.includes(estado) ? actual.filter((e) => e !== estado) : [...actual, estado]
    );
  };

  if (!visible) return null;

  const cargarEnvios = async (vuelo: EventoVuelo) => {
    const codigoVuelo = String(vuelo.codigoVuelo);

    // Enfocamos el mapa en el vuelo cada vez que se hace clic en la fila,
    // independientemente de si se expande o colapsa el detalle de envios.
    onEnfocarVuelo(vuelo.codigoVuelo);

    const estaExpandido = vueloExpandido === codigoVuelo;

    if (estaExpandido) {
      setVueloExpandido(null);
      setEnviosPorVuelo((actual) => {
        const siguiente = { ...actual };
        delete siguiente[codigoVuelo];
        return siguiente;
      });
      setErrorPorVuelo((actual) => {
        const siguiente = { ...actual };
        delete siguiente[codigoVuelo];
        return siguiente;
      });
      setLoadingPorVuelo((actual) => {
        const siguiente = { ...actual };
        delete siguiente[codigoVuelo];
        return siguiente;
      });
      return;
    }

    setVueloExpandido(codigoVuelo);

    if (enviosPorVuelo[codigoVuelo] || loadingPorVuelo[codigoVuelo]) return;

    setLoadingPorVuelo((actual) => ({ ...actual, [codigoVuelo]: true }));
    setErrorPorVuelo((actual) => ({ ...actual, [codigoVuelo]: '' }));

    try {
      const timestamp = new Date(tiempoSimulacionRef.current).toISOString();
      const { data } = await SimulacionService.obtenerEnviosPorVuelo(idSimulacion, vuelo, timestamp);
      setEnviosPorVuelo((actual) => ({ ...actual, [codigoVuelo]: data }));
    } catch {
      setErrorPorVuelo((actual) => ({
        ...actual,
        [codigoVuelo]: 'No se pudieron cargar los envios de este vuelo.',
      }));
    } finally {
      setLoadingPorVuelo((actual) => ({ ...actual, [codigoVuelo]: false }));
    }
  };

  return (
      <Draggable
          nodeRef={nodeRef as RefObject<HTMLDivElement>}
      >
        <Paper elevation={8} ref={nodeRef} className={styles.paperVuelos}>
          <Accordion
              expanded={panelAbierto}
              onChange={(_, expanded) => setPanelAbierto(expanded)}
              disableGutters
              className={styles.accordion}
          >
            <AccordionSummary className={styles.accordionSummary}>
              <Typography sx={{ fontWeight: 700 }}>Vuelos en aire</Typography>
              <Chip
                  size="small"
                  label={vuelosActivos.length}
                  color={vuelosActivos.length ? "primary" : "default"}
              />
            </AccordionSummary>

            <AccordionDetails className={styles.accordionDetails}>
              {panelAbierto && (
                  <>
                    <Stack spacing={1.5} className={styles.filtersContainer}>
                      <TextField
                          size="small"
                          value={busqueda}
                          onChange={(event) => setBusqueda(event.target.value)}
                          placeholder="Buscar vuelo, origen o destino"
                          fullWidth
                          className={styles.input}
                      />

                      <FormControl
                          size="small"
                          fullWidth
                          className={styles.input}
                      >
                        <InputLabel id="orden-vuelos-label">
                          Ordenar por
                        </InputLabel>

                        <Select
                            labelId="orden-vuelos-label"
                            value={orden}
                            label="Ordenar por"
                            onChange={(event: SelectChangeEvent) =>
                                setOrden(event.target.value as OrdenVuelos)
                            }
                        >
                          <MenuItem value="ocupacion">
                            Nivel de ocupacion
                          </MenuItem>
                          <MenuItem value="salida">
                            Hora salida
                          </MenuItem>
                          <MenuItem value="llegada">
                            Hora llegada
                          </MenuItem>
                          <MenuItem value="origen">
                            Origen
                          </MenuItem>
                          <MenuItem value="destino">
                            Destino
                          </MenuItem>
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
                              onClick={() => toggleFiltroEstado(estado)}
                              sx={{
                                  cursor: 'pointer',
                                fontWeight: activo ? 700 : 400,
                                ...(estado === 'VACIO' && {
                                  borderColor: '#4b5563',
                                  color: '#ffffff',
                                  '&.MuiChip-colorDefault': { color: '#ffffff' },
                                  '&.MuiChip-filledDefault': { backgroundColor: '#374151', color: '#ffffff' },
                                  '&.MuiChip-outlinedDefault': { borderColor: '#4b5563', color: '#ffffff' },
                                }),
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </Stack>

                    {vuelosFiltrados.length === 0 ? (
                        <Box className={styles.empty}>
                          No hay vuelos activos
                        </Box>
                    ) : (
                        <Stack spacing={1} className={styles.scrollList}>
                          {vuelosFiltrados
                              .slice(
                                  (page - 1) * rowsPerPage,
                                  page * rowsPerPage
                              )
                              .map((vuelo) => {
                                const codigoVuelo = String(
                                    vuelo.codigoVuelo
                                );

                                const expandido =
                                    vueloExpandido === codigoVuelo;


                                const envios =
                                    enviosPorVuelo[codigoVuelo] || [];

                                const enviosCargados =
                                    expandido &&
                                    enviosPorVuelo[codigoVuelo] !==
                                    undefined;

                                const cantidadMaletasHeader =
                                    enviosCargados
                                        ? envios.reduce(
                                            (sum, envio) =>
                                                sum +
                                                envio.cantidadMaletas,
                                            0
                                        )
                                        : vuelo.cantidadMaletas;

                                const ocupacion =
                                    calcularOcupacionPorMaletas(
                                        cantidadMaletasHeader,
                                        vuelo.capacidadMax
                                    );

                                const estado = enviosCargados
                                    ? obtenerEstadoPorOcupacion(
                                        ocupacion
                                    )
                                    : obtenerEstadoVuelo(vuelo);

                                return (
                                    <Box
                                        key={codigoVuelo}
                                        className={styles.airportBoxList}
                                    >
                                      <Button
                                          fullWidth
                                          onClick={() =>
                                              seleccionarVuelo(String(vuelo.codigoVuelo))
                                          }
                                          className={styles.airportButton}
                                      >
                                        <Box
                                            className={
                                              styles.airportContent
                                            }
                                        >
                                          <Stack
                                              className={
                                                styles.airportHeader
                                              }
                                          >
                                            <Typography
                                                className={
                                                  styles.airportCode
                                                }
                                            >
                                              Vuelo {codigoVuelo}
                                            </Typography>

                                            {/*<Chip
                                                size="small"
                                                label={estado}
                                                color={
                                                  colorPorEstado[
                                                      estado
                                                      ]
                                                }
                                            />*/}
                                          </Stack>

                                          <Typography
                                              variant="body2"
                                              className={
                                                styles.airportLocation
                                              }
                                          >
                                            {vuelo.origenIata} -{" "}
                                            {vuelo.destinoIata}
                                          </Typography>

                                          <Stack
                                              className={
                                                styles.airportFooter
                                              }
                                          >
                                            <Typography
                                                variant="caption"
                                                className={
                                                  styles.airportCapacity
                                                }
                                            >
                                              {
                                                cantidadMaletasHeader
                                              }
                                              /
                                              {
                                                vuelo.capacidadMax
                                              }{" "}
                                              maletas
                                            </Typography>

                                            <Typography
                                                variant="caption"
                                                className={
                                                  styles.airportOccupation
                                                }
                                            >
                                              {ocupacion}%
                                            </Typography>
                                          </Stack>
                                        </Box>
                                      </Button>

                                      {expandido && (
                                          <Box
                                              className={
                                                styles.expandedContent
                                              }
                                          >
                                            {loadingPorVuelo[
                                                codigoVuelo
                                                ] ? (
                                                <Box
                                                    sx={{
                                                      display: "flex",
                                                      justifyContent:
                                                          "center",
                                                      py: 2,
                                                    }}
                                                >
                                                  <CircularProgress
                                                      size={22}
                                                      className={styles.loadingContainer}
                                                  />
                                                </Box>
                                            ) : errorPorVuelo[
                                                codigoVuelo
                                                ] ? (
                                                <Typography
                                                    variant="body2"
                                                    color="error"
                                                >
                                                  {
                                                    errorPorVuelo[
                                                        codigoVuelo
                                                        ]
                                                  }
                                                </Typography>
                                            ) : envios.length ===
                                            0 ? (
                                                <Box
                                                    className={
                                                      styles.empty
                                                    }
                                                >
                                                  Sin envios asignados
                                                </Box>
                                            ) : (
                                                <Table
                                                    size="small"
                                                    className={
                                                      styles.table
                                                    }
                                                >
                                                  <TableHead>
                                                    <TableRow>
                                                      <TableCell>
                                                        ID
                                                      </TableCell>
                                                      <TableCell>
                                                        Origen
                                                      </TableCell>
                                                      <TableCell>
                                                        Destino
                                                      </TableCell>
                                                      <TableCell align="right">
                                                        Maletas
                                                      </TableCell>
                                                    </TableRow>
                                                  </TableHead>

                                                  <TableBody>
                                                    {envios.map(
                                                        (envio) => (
                                                            <TableRow
                                                                key={
                                                                  envio.idPedido
                                                                }
                                                            >
                                                              <TableCell>
                                                                {
                                                                  envio.idPedido
                                                                }
                                                              </TableCell>
                                                              <TableCell>
                                                                {
                                                                  envio.origenIata
                                                                }
                                                              </TableCell>
                                                              <TableCell>
                                                                {
                                                                  envio.destinoIata
                                                                }
                                                              </TableCell>
                                                              <TableCell align="right">
                                                                {
                                                                  envio.cantidadMaletas
                                                                }
                                                              </TableCell>
                                                            </TableRow>
                                                        )
                                                    )}
                                                  </TableBody>
                                                </Table>
                                            )}
                                          </Box>
                                      )}
                                    </Box>
                                );
                              })}

                          <Pagination
                              className={styles.pagination}
                              page={page}
                              onChange={(_, value) =>
                                  setPage(value)
                              }
                              count={Math.ceil(
                                  vuelosFiltrados.length /
                                  rowsPerPage
                              )}
                          />
                        </Stack>
                    )}
                  </>
              )}
            </AccordionDetails>
          </Accordion>
        </Paper>
      </Draggable>

  );
}

const inputSx = {
  '& .MuiInputBase-root': {
    color: '#f8fafc',
    bgcolor: 'rgba(15, 23, 42, 0.72)',
  },
  '& .MuiInputLabel-root': { color: '#cbd5e1' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148, 163, 184, 0.35)' },
  '& .MuiSvgIcon-root': { color: '#cbd5e1' },
};

const emptySx = {
  py: 2,
  textAlign: 'center',
  color: '#94a3b8',
  fontSize: 13,
};

const tableSx = {
  '& .MuiTableCell-root': {
    color: '#e2e8f0',
    borderColor: 'rgba(148, 163, 184, 0.18)',
    px: 0.75,
    py: 0.75,
    fontSize: 12,
  },
  '& .MuiTableCell-head': {
    color: '#93c5fd',
    fontWeight: 700,
  },
};

const paginationSx = {
  '& .MuiPaginationItem-root': {
    color: '#e2e8f0',
    borderColor: 'rgba(148, 163, 184, 0.18)',
    fontSize: 12,
  }
}

const miniButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 6,
  padding: '5px 9px',
  background: '#2563eb',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

const scrollListSx = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  pr: 0.5,
  scrollbarWidth: 'thin',
  scrollbarColor: '#64748b rgba(15, 23, 42, 0.45)',
  '&::-webkit-scrollbar': {
    width: 10,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderRadius: 8,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#64748b',
    borderRadius: 8,
    border: '2px solid rgba(15, 23, 42, 0.45)',
  },
};
