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
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { useMemo, useState, RefObject } from 'react';
import { SimulacionService } from '@/app/services/simulation.service';
import type { Envio } from '@/app/shared/types/Envio';
import type { EstadoCapacidad, EventoVuelo } from '@/app/shared/types/Evento';

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
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        top: 88,
        left: 16,
        zIndex: 20,
        width: 430,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: 'rgba(15, 23, 42, 0.94)',
        color: '#f8fafc',
        border: '1px solid rgba(148, 163, 184, 0.24)',
      }}
    >
      <Accordion
        expanded={panelAbierto}
        onChange={(_, expanded) => setPanelAbierto(expanded)}
        disableGutters
        sx={{
          bgcolor: 'transparent',
          color: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70vh',
          overflow: 'hidden',
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary
          sx={{
            minHeight: 48,
            '& .MuiAccordionSummary-content': {
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            },
          }}
        >
          <Typography sx={{ fontWeight: 700 }}>Vuelos en aire</Typography>
          <Chip size="small" label={vuelosActivos.length} color={vuelosActivos.length ? 'primary' : 'default'} />
        </AccordionSummary>

        <AccordionDetails
          sx={{
            pt: 0,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(70vh - 48px)',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Stack spacing={1.5} sx={{ flexShrink: 0, pb: 1.5 }}>
            <TextField
              size="small"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar vuelo, origen o destino"
              fullWidth
              sx={inputSx}
            />

            <FormControl size="small" fullWidth sx={inputSx}>
              <InputLabel id="orden-vuelos-label">Ordenar por</InputLabel>
              <Select
                labelId="orden-vuelos-label"
                value={orden}
                label="Ordenar por"
                onChange={(event: SelectChangeEvent) => setOrden(event.target.value as OrdenVuelos)}
              >
                <MenuItem value="ocupacion">Nivel de ocupacion</MenuItem>
                <MenuItem value="salida">Hora salida</MenuItem>
                <MenuItem value="llegada">Hora llegada</MenuItem>
                <MenuItem value="origen">Origen</MenuItem>
                <MenuItem value="destino">Destino</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {vuelosFiltrados.length === 0 ? (
            <Box sx={emptySx}>No hay vuelos activos</Box>
          ) : (
            <Stack spacing={1} sx={scrollListSx}>
              {vuelosFiltrados.map((vuelo) => {
                const codigoVuelo = String(vuelo.codigoVuelo);
                const expandido = vueloExpandido === codigoVuelo;
                const envios = enviosPorVuelo[codigoVuelo] || [];
                const enviosCargados = expandido && enviosPorVuelo[codigoVuelo] !== undefined;
                const cantidadMaletasHeader = enviosCargados
                  ? envios.reduce((sum, envio) => sum + envio.cantidadMaletas, 0)
                  : vuelo.cantidadMaletas;
                const ocupacion = calcularOcupacionPorMaletas(cantidadMaletasHeader, vuelo.capacidadMax);
                const estado = enviosCargados ? obtenerEstadoPorOcupacion(ocupacion) : obtenerEstadoVuelo(vuelo);

                return (
                  <Box
                    key={codigoVuelo}
                    sx={{
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: 1,
                      overflow: 'hidden',
                      bgcolor: 'rgba(30, 41, 59, 0.82)',
                      flexShrink: 0,
                    }}
                  >
                      <Button
                        fullWidth
                        onClick={() => cargarEnvios(vuelo)}
                        sx={{
                          justifyContent: 'stretch',
                          color: 'inherit',
                          textTransform: 'none',
                          p: 1.25,
                        }}
                      >
                        <Box sx={{ width: '100%', textAlign: 'left' }}>
                          <Stack sx={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Typography sx={{ fontWeight: 700 }}>Vuelo {codigoVuelo}</Typography>
                            <Chip size="small" label={estado} color={colorPorEstado[estado]} />
                          </Stack>
                          <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
                            {vuelo.origenIata} - {vuelo.destinoIata}
                          </Typography>
                          <Stack sx={{ mt: 0.75, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                              {cantidadMaletasHeader}/{vuelo.capacidadMax} maletas
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {ocupacion}%
                            </Typography>
                          </Stack>
                        </Box>
                      </Button>

                      {expandido && (
                        <Box sx={{ px: 1.25, pb: 1.25 }}>
                          {loadingPorVuelo[codigoVuelo] ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                              <CircularProgress size={22} />
                            </Box>
                          ) : errorPorVuelo[codigoVuelo] ? (
                            <Typography variant="body2" color="error">
                              {errorPorVuelo[codigoVuelo]}
                            </Typography>
                          ) : envios.length === 0 ? (
                            <Box sx={emptySx}>Sin envios asignados</Box>
                          ) : (
                            <Table size="small" sx={tableSx}>
                              <TableHead>
                                <TableRow>
                                  <TableCell>ID</TableCell>
                                  <TableCell>Origen</TableCell>
                                  <TableCell>Destino</TableCell>
                                  <TableCell align="right">Maletas</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {envios.map((envio) => (
                                  <TableRow key={envio.idPedido}>
                                    <TableCell>{envio.idPedido}</TableCell>
                                    <TableCell>{envio.origenIata}</TableCell>
                                    <TableCell>{envio.destinoIata}</TableCell>
                                    <TableCell align="right">{envio.cantidadMaletas}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </Box>
                      )}
                  </Box>
                );
              })}
            </Stack>
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
