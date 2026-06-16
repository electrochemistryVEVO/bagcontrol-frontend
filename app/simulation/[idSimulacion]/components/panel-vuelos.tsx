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
import { useMemo, useState, RefObject } from 'react';
import { SimulacionService } from '@/app/services/simulation.service';
import type { Envio } from '@/app/shared/types/Envio';
import type { EstadoCapacidad, EventoVuelo } from '@/app/shared/types/Evento';
import styles from '../../../stylesheets/simpanel.module.css'

type OrdenVuelos = 'ocupacion' | 'salida' | 'llegada' | 'origen' | 'destino';

type PanelVuelosProps = {
  idSimulacion: string;
  vuelosActivos: EventoVuelo[];
  tiempoSimulacionRef: RefObject<number>;
  visible: boolean;
};

type EnviosPorVuelo = Record<string, Envio[]>;
type LoadingPorVuelo = Record<string, boolean>;

const colorPorEstado: Record<EstadoCapacidad, 'success' | 'warning' | 'error'> = {
  VERDE: 'success',
  AMARILLO: 'warning',
  ROJO: 'error',
};

function calcularOcupacionPorMaletas(cantidadMaletas: number, capacidadMax: number) {
  if (!capacidadMax) return 0;
  return Math.round((cantidadMaletas / capacidadMax) * 100);
}

function calcularOcupacion(vuelo: EventoVuelo) {
  return calcularOcupacionPorMaletas(vuelo.cantidadMaletas, vuelo.capacidadMax);
}

function obtenerEstadoPorOcupacion(ocupacion: number): EstadoCapacidad {
  if (ocupacion < 33) return 'VERDE';
  if (ocupacion <= 66) return 'AMARILLO';
  return 'ROJO';
}

function obtenerEstadoVuelo(vuelo: EventoVuelo): EstadoCapacidad {
  if (vuelo.estado) return vuelo.estado;
  return obtenerEstadoPorOcupacion(calcularOcupacion(vuelo));
}

function compararTexto(a: string, b: string) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' });
}

export function PanelVuelos({ idSimulacion, vuelosActivos, tiempoSimulacionRef, visible }: PanelVuelosProps) {
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<OrdenVuelos>('ocupacion');
  const [vueloExpandido, setVueloExpandido] = useState<string | null>(null);
  const [enviosPorVuelo, setEnviosPorVuelo] = useState<EnviosPorVuelo>({});
  const [loadingPorVuelo, setLoadingPorVuelo] = useState<LoadingPorVuelo>({});
  const [errorPorVuelo, setErrorPorVuelo] = useState<Record<string, string>>({});

  const [page,setPage] = useState<number>(1);
  //const [rowsPerPage,setRowsPerPage] = useState<number>(10);
  const rowsPerPage = 20;

  const vuelosFiltrados = useMemo(() => {
    const filtro = busqueda.trim().toLowerCase();

    return [...vuelosActivos]
      .filter((vuelo) => {
        if (!filtro) return true;
        return [
          String(vuelo.codigoVuelo),
          vuelo.origenIata,
          vuelo.destinoIata,
        ].some((valor) => valor.toLowerCase().includes(filtro));
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
  }, [busqueda, orden, vuelosActivos]);

  if (!visible) return null;

  const cargarEnvios = async (vuelo: EventoVuelo) => {
    const codigoVuelo = String(vuelo.codigoVuelo);
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
      const { data } = await SimulacionService.obtenerEnviosPorVuelo(idSimulacion, vuelo.codigoVuelo, timestamp);
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
      <Paper elevation={8} className={styles.paperVuelos}>
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
                                            cargarEnvios(vuelo)
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

                                          <Chip
                                              size="small"
                                              label={estado}
                                              color={
                                                colorPorEstado[
                                                    estado
                                                    ]
                                              }
                                          />
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
