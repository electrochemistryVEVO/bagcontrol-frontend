'use client';

import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow, TextField,
    Typography,
    SelectChangeEvent,
} from '@mui/material';
import {memo, RefObject, useEffect, useMemo, useRef, useState} from 'react';
import type { AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import type { EstadoCapacidad } from '@/app/shared/types/Evento';
import styles from "../../../stylesheets/simpanel.module.css";
import Draggable from 'react-draggable';
import { calcularOcupacionAeropuerto, obtenerEstadoAeropuerto } from '@/app/shared/simulation/semaforo';
import { formatShortDateTime } from '@/app/shared/dateTime';

type PanelAeropuertosProps = {
  aeropuertos: AeropuertoSimulacion[];
  visible: boolean;
  onEnfocarAeropuerto: (codigoIata: string) => void;
  onFiltradoCambiado?: (iatas: string[] | null) => void;
};

type Continente = 'america' | 'asia' | 'europa' | 'oceania' | 'africa';

type DireccionOrden = 'asc' | 'desc';

type OrderingFuncs = 'calcularOcupacion' | 'calcularProximidadSalida' | 'calcularProximidadLlegada'

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

const orderFunctions : Record<OrderingFuncs, (x:AeropuertoSimulacion) => number> = {
    calcularOcupacion : function(aeropuerto: AeropuertoSimulacion) {
        return calcularOcupacion(aeropuerto);
    },
    calcularProximidadSalida : function (aeropuerto : AeropuertoSimulacion){
        if(!aeropuerto.enviosProximosAVencer || aeropuerto.enviosProximosAVencer.length < 1)return Number.MAX_VALUE;
        return Date.now() - (new Date(aeropuerto.enviosProximosAVencer[0].fechaHoraSalidaUtc)).getTime();
    },
    calcularProximidadLlegada : function(aeropuerto : AeropuertoSimulacion){
        if(!aeropuerto.enviosProximosAVencer || aeropuerto.enviosProximosAVencer.length < 1)return Number.MAX_VALUE;
        return Date.now() - (new Date(aeropuerto.enviosProximosAVencer[0].fechaHoraLlegadaUtc)).getTime();
    }
}

function calcularOcupacion(aeropuerto: AeropuertoSimulacion) {
  return calcularOcupacionAeropuerto(aeropuerto);
}

export function PanelAeropuertos({ aeropuertos, visible, onEnfocarAeropuerto, onFiltradoCambiado }: PanelAeropuertosProps) {
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('desc');
  const [busqueda, setBusqueda] = useState('');
  const [filtroContinente,setFiltroContinente] = useState('');
  const [filtroEstados, setFiltroEstados] = useState<EstadoCapacidad[]>(ESTADOS_CAPACIDAD);
  const [tipoOrden,setTipoOrden] = useState<OrderingFuncs>('calcularOcupacion');
  const [aeropuertoExpandido, setAeropuertoExpandido] = useState<string | null>(null);

  const nodeRef = useRef<HTMLDivElement>(null);


  // Notificar al mapa cuando cambia el filtro activo
  const hayFiltroActivo = busqueda.trim() !== '' || filtroContinente !== '' || filtroEstados.length < ESTADOS_CAPACIDAD.length;
  useEffect(() => {
    if (!onFiltradoCambiado) return;
    if (hayFiltroActivo) {
      // Se notifica después de calcular aeropuertosOrdenados, ver el useEffect de abajo
    } else {
      onFiltradoCambiado(null); // sin filtro → mostrar todos en el mapa
    }
  }, [hayFiltroActivo, onFiltradoCambiado]);

  const aeropuertosOrdenados = useMemo(() => {
    return [...aeropuertos]
        .filter((aeropuerto)=>{
            const filtro = busqueda.trim().toLowerCase()
            const filtrado = !filtro ? true
                : aeropuerto.codigoIata.toLowerCase().includes(filtro);
            const filtradoContinente = !filtroContinente ? true:
                aeropuerto.continente.toLowerCase().includes(filtroContinente);
            const filtradoEstado = filtroEstados.includes(obtenerEstadoAeropuerto(aeropuerto));
            return filtrado && filtradoContinente && filtradoEstado;
        })
        .sort((a, b) => {
            const sortFunc = orderFunctions[tipoOrden];
            const diferencia = sortFunc(a) - sortFunc(b);
            return direccionOrden === 'asc' ? diferencia : -diferencia;
    });
  }, [aeropuertos, direccionOrden,tipoOrden,busqueda,filtroContinente,filtroEstados]);

  // Notificar la lista filtrada al mapa
  useEffect(() => {
    if (!onFiltradoCambiado || !hayFiltroActivo) return;
    onFiltradoCambiado(aeropuertosOrdenados.map(a => a.codigoIata));
  }, [aeropuertosOrdenados, hayFiltroActivo, onFiltradoCambiado]);

  const toggleFiltroEstado = (estado: EstadoCapacidad) => {
    setFiltroEstados((actual) =>
      actual.includes(estado) ? actual.filter((e) => e !== estado) : [...actual, estado]
    );
  };

  if (!visible) return null;

  return (
      <Draggable
          nodeRef={nodeRef as RefObject<HTMLDivElement>}
      >
          <Paper
              elevation={8}
              className={styles.paper}
              ref={nodeRef}
          >
              <Accordion
                  expanded={panelAbierto}
                  onChange={(_, expanded) => setPanelAbierto(expanded)}
                  disableGutters
                  className={styles.accordion}
              >
                  <AccordionSummary
                      className={styles.accordionSummary}
                  >
                      <Typography sx={{ fontWeight: 700 }}>Aeropuertos</Typography>
                      <Chip size="small" label={aeropuertos.length} color={aeropuertos.length ? 'primary' : 'default'} />
                  </AccordionSummary>

        <AccordionDetails
            className={styles.accordionDetails}
        >
            {panelAbierto && (<>
                <Stack spacing={1.5} className={styles.filtersContainer}>
                    <TextField
                        size="small"
                        value={busqueda}
                        onChange={(event) => setBusqueda(event.target.value)}
                        placeholder="Buscar por código IATA"
                        fullWidth
                        className={styles.input}
                    />
                    <FormControl size="small" fullWidth className={styles.input}>
                        <InputLabel id="filtro-continente-label">Filtrar por continente</InputLabel>
                        <Select
                            labelId="filtro-continente-label"
                            value={filtroContinente}
                            label="Filtrar por continente"
                            onChange={(event: SelectChangeEvent) => setFiltroContinente(event.target.value as Continente)}
                        >
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
                    <Stack spacing={1.5} className={styles.orderContainer} direction="row">
                        <FormControl size="small" className={styles.input}>
                            <InputLabel id="orden-aeropuertos-label">Ordenar por</InputLabel>
                            <Select
                                labelId="orden-aeropuertos-label"
                                value={tipoOrden}
                                label="Filtrar por continente"
                                onChange={(event: SelectChangeEvent) => setTipoOrden(event.target.value as OrderingFuncs)}
                            >
                                <MenuItem value="calcularOcupacion">Ocupación</MenuItem>
                                <MenuItem value="calcularProximidadSalida">Proximidad de hora de salida</MenuItem>
                                <MenuItem value="calcularProximidadLlegada">Proximidad de hora de llegada</MenuItem>
                            </Select>
                        </FormControl>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setDireccionOrden((actual) => (actual === 'asc' ? 'desc' : 'asc'))}
                            className={styles.orderButton}
                        >
                            Orden {direccionOrden === 'asc' ? 'ascendente' : 'descendente'}
                        </Button>
                    </Stack>
                </Stack>

                          {aeropuertosOrdenados.length === 0 ? (
                              <Box className={styles.empty}>No hay aeropuertos disponibles</Box>
                          ) : (
                              <Stack spacing={1} className={styles.scrollList}>
                                  {aeropuertosOrdenados.map((aeropuerto) => {
                                      const ocupacion = calcularOcupacion(aeropuerto);
                                      const estado = obtenerEstadoAeropuerto(aeropuerto);
                                      const enviosProximos = aeropuerto.enviosProximosAVencer || [];
                                      const expandido = aeropuertoExpandido === aeropuerto.codigoIata;

                            return (
                                <Box className={styles.airportBoxList}
                                    key={aeropuerto.codigoIata}
                                >
                                    <Button
                                        fullWidth
                                        onClick={() => {
                                            // Enfocamos el mapa en el aeropuerto cada vez que se hace clic en la fila,
                                            // independientemente de si se expande o colapsa el detalle.
                                            onEnfocarAeropuerto(aeropuerto.codigoIata);
                                            setAeropuertoExpandido((actual) => (
                                                actual === aeropuerto.codigoIata ? null : aeropuerto.codigoIata
                                            ));
                                        }}
                                        className={styles.airportButton}
                                    >
                                        <Box className={styles.airportContent}>
                                            <Stack className={styles.airportHeader}>
                                                <Typography className={styles.airportCode}>{aeropuerto.codigoIata}</Typography>
                                                <Stack className={styles.airportChips}>
                                                    {enviosProximos.length > 0 && (
                                                        <Chip
                                                            size="small"
                                                            label={`${enviosProximos.length} SLA`}
                                                            color="warning"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                    {/*<Chip
                                                        size="small"
                                                        label={estado}
                                                        color={colorPorEstado[estado]}
                                                    />*/}
                                                </Stack>
                                            </Stack>

                                                      <Typography variant="body2" className={styles.airportLocation}>
                                                          {aeropuerto.ciudad} - {aeropuerto.pais}
                                                      </Typography>

                                                      <Stack className={styles.airportFooter}>
                                                          <Typography variant="caption" className={styles.airportCapacity}>
                                                              {aeropuerto.maletasActuales}/{aeropuerto.capacidadAlmacen} maletas
                                                          </Typography>
                                                          {enviosProximos.length > 0 && (
                                                              <Stack className={styles.airportProximidad}>
                                                                  <Typography variant="caption" className={styles.airportProximidadLinea}>
                                                                      S: {formatShortDateTime(enviosProximos[0].fechaHoraSalidaUtc)}
                                                                  </Typography>
                                                                  <Typography variant="caption" className={styles.airportProximidadLinea}>
                                                                      L: {formatShortDateTime(enviosProximos[0].fechaHoraLlegadaUtc)}
                                                                  </Typography>
                                                              </Stack>
                                                          )}
                                                          <Typography variant="caption" className={styles.airportCode}>
                                                              {ocupacion}%
                                                          </Typography>
                                                      </Stack>
                                                  </Box>
                                              </Button>

                                              {expandido && (
                                                  <Box className={styles.expandedContent}>
                                                      {enviosProximos.length === 0 ? (
                                                          <Box className={styles.empty}>Sin envios proximos a vencer</Box>
                                                      ) : (
                                                          <Table size="small" className={styles.table}>
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
                                                                      <TableRow key={envio.envio.idPedido}>
                                                                          <TableCell
                                                                              sx={{
                                                                                  maxWidth: 90,
                                                                                  overflow: 'hidden',
                                                                                  textOverflow: 'ellipsis',
                                                                                  whiteSpace: 'nowrap',
                                                                              }}
                                                                              title={envio.envio.idPedido}
                                                                          >
                                                                              {envio.envio.idPedido}
                                                                          </TableCell>
                                                                          <TableCell>{envio.envio.origenIata}</TableCell>
                                                                          <TableCell>{envio.envio.destinoIata}</TableCell>
                                                                          <TableCell align="right">{envio.envio.cantidadMaletas}</TableCell>
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
                      </>)}
                  </AccordionDetails>
              </Accordion>
          </Paper>
      </Draggable>

  );
}
