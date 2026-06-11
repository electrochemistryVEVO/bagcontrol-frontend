'use client';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import type { AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import type { EstadoCapacidad } from '@/app/shared/types/Evento';

type PanelAeropuertosProps = {
  aeropuertos: AeropuertoSimulacion[];
  visible: boolean;
};

type DireccionOrden = 'asc' | 'desc';

const colorPorEstado: Record<EstadoCapacidad, 'success' | 'warning' | 'error'> = {
  VERDE: 'success',
  AMARILLO: 'warning',
  ROJO: 'error',
};

function calcularOcupacion(aeropuerto: AeropuertoSimulacion) {
  if (typeof aeropuerto.porcentajeOcupacion === 'number') {
    return Math.round(aeropuerto.porcentajeOcupacion);
  }
  if (!aeropuerto.capacidadAlmacen) return 0;
  return Math.round((aeropuerto.maletasActuales / aeropuerto.capacidadAlmacen) * 100);
}

export function PanelAeropuertos({ aeropuertos, visible }: PanelAeropuertosProps) {
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('desc');
  const [aeropuertoExpandido, setAeropuertoExpandido] = useState<string | null>(null);

  const aeropuertosOrdenados = useMemo(() => {
    return [...aeropuertos].sort((a, b) => {
      const diferencia = calcularOcupacion(a) - calcularOcupacion(b);
      return direccionOrden === 'asc' ? diferencia : -diferencia;
    });
  }, [aeropuertos, direccionOrden]);

  if (!visible) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        top: 88,
        right: 16,
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
          <Typography sx={{ fontWeight: 700 }}>Aeropuertos</Typography>
          <Chip size="small" label={aeropuertos.length} color={aeropuertos.length ? 'primary' : 'default'} />
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
            <Button
              variant="outlined"
              size="small"
              onClick={() => setDireccionOrden((actual) => (actual === 'asc' ? 'desc' : 'asc'))}
              sx={{
                color: '#e2e8f0',
                borderColor: 'rgba(148, 163, 184, 0.35)',
                textTransform: 'none',
                alignSelf: 'flex-start',
              }}
            >
              Ocupacion {direccionOrden === 'asc' ? 'ascendente' : 'descendente'}
            </Button>
          </Stack>

          {aeropuertosOrdenados.length === 0 ? (
            <Box sx={emptySx}>No hay aeropuertos disponibles</Box>
          ) : (
            <Stack spacing={1} sx={scrollListSx}>
              {aeropuertosOrdenados.map((aeropuerto) => {
                const ocupacion = calcularOcupacion(aeropuerto);
                const enviosProximos = aeropuerto.enviosProximosAVencer || [];
                const expandido = aeropuertoExpandido === aeropuerto.codigoIata;

                return (
                  <Box
                    key={aeropuerto.codigoIata}
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
                        onClick={() => setAeropuertoExpandido((actual) => (
                          actual === aeropuerto.codigoIata ? null : aeropuerto.codigoIata
                        ))}
                        sx={{
                          justifyContent: 'stretch',
                          color: 'inherit',
                          textTransform: 'none',
                          p: 1.25,
                        }}
                      >
                        <Box sx={{ width: '100%', textAlign: 'left' }}>
                          <Stack sx={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Typography sx={{ fontWeight: 700 }}>{aeropuerto.codigoIata}</Typography>
                            <Stack sx={{ flexDirection: 'row', gap: 0.75 }}>
                              {enviosProximos.length > 0 && (
                                <Chip
                                  size="small"
                                  label={`${enviosProximos.length} SLA`}
                                  color="warning"
                                  variant="outlined"
                                />
                              )}
                              <Chip
                                size="small"
                                label={aeropuerto.estadoCapacidad}
                                color={colorPorEstado[aeropuerto.estadoCapacidad]}
                              />
                            </Stack>
                          </Stack>

                          <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
                            {aeropuerto.ciudad} - {aeropuerto.pais}
                          </Typography>

                          <Stack sx={{ mt: 0.75, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                              {aeropuerto.maletasActuales}/{aeropuerto.capacidadAlmacen} maletas
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {ocupacion}%
                            </Typography>
                          </Stack>
                        </Box>
                      </Button>

                      {expandido && (
                        <Box sx={{ px: 1.25, pb: 1.25 }}>
                          {enviosProximos.length === 0 ? (
                            <Box sx={emptySx}>Sin envios proximos a vencer</Box>
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
                                {enviosProximos.map((envio) => (
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
