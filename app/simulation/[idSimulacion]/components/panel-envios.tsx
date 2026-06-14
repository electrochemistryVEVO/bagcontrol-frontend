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
import { useMemo, useState } from 'react';
import type { AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import type { EstadoCapacidad } from '@/app/shared/types/Evento';
import {Envio} from "@/app/shared/types/Envio";

type PanelAeropuertosProps = {
    aeropuertos: AeropuertoSimulacion[];
    visible: boolean;
};

type PanelEnviosProps = {
    envios : Envio[],
    visible: boolean
}

type Continente = 'america' | 'asia' | 'europa' | 'oceania' | 'africa';

type DireccionOrden = 'asc' | 'desc';

type OrderingFuncs = 'calcularOcupacion' | 'calcularProximidadSalida' | 'calcularProximidadLlegada'

const colorPorEstado: Record<EstadoCapacidad, 'success' | 'warning' | 'error'> = {
    VERDE: 'success',
    AMARILLO: 'warning',
    ROJO: 'error',
};

const orderFunctions : Record<OrderingFuncs, (x:AeropuertoSimulacion) => number> = {
    calcularOcupacion : function(aeropuerto: AeropuertoSimulacion) {
        return calcularOcupacion(aeropuerto);
    },
    calcularProximidadSalida : function (aeropuerto : AeropuertoSimulacion){
        let proximidad = Number.MAX_VALUE
        if(!aeropuerto.enviosProximosAVencer)return proximidad;
        for(const envio of aeropuerto.enviosProximosAVencer){
            const envioProx = Date.now() - (new Date(envio.fechaHoraSalidaUtc)).getTime();
            proximidad = envioProx < proximidad ? envioProx : proximidad;
        }
        return proximidad;
    },
    calcularProximidadLlegada : function(aeropuerto : AeropuertoSimulacion){
        let proximidad = Number.MAX_VALUE
        if(!aeropuerto.enviosProximosAVencer)return proximidad;
        for(const envio of aeropuerto.enviosProximosAVencer){
            const envioProx = Date.now() - (new Date(envio.fechaHoraLlegadaUtc)).getTime();
            proximidad = envioProx < proximidad ? envioProx : proximidad;
        }
        return proximidad;
    }
}

function calcularOcupacion(aeropuerto: AeropuertoSimulacion) {
    if (typeof aeropuerto.porcentajeOcupacion === 'number') {
        return Math.round(aeropuerto.porcentajeOcupacion);
    }
    if (!aeropuerto.capacidadAlmacen) return 0;
    return Math.round((aeropuerto.maletasActuales / aeropuerto.capacidadAlmacen) * 100);
}
export function PanelEnvios({ aeropuertos, visible }: PanelAeropuertosProps) {
    const [panelAbierto, setPanelAbierto] = useState(false);
    const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('desc');
    const [busqueda, setBusqueda] = useState('');
    const [filtroContinente,setFiltroContinente] = useState('');
    const [tipoOrden,setTipoOrden] = useState<OrderingFuncs>('calcularOcupacion');
    const [aeropuertoExpandido, setAeropuertoExpandido] = useState<string | null>(null);

    const aeropuertosOrdenados = useMemo(() => {
        return [...aeropuertos]
            .filter((aeropuerto)=>{
                const filtro = busqueda.trim().toLowerCase()
                const filtrado = !filtro ? true
                    : aeropuerto.codigoIata.toLowerCase().includes(filtro);
                const filtradoContinente = !filtroContinente ? true:
                    aeropuerto.continente.toLowerCase().includes(filtroContinente);
                return filtrado && filtradoContinente;
            })
            .sort((a, b) => {
                const sortFunc = orderFunctions[tipoOrden];
                const diferencia = sortFunc(a) - sortFunc(b);
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
                {/*Titulo*/}
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
                    <Typography sx={{ fontWeight: 700 }}>Envios</Typography>
                    <Chip size="small" label={aeropuertos.length} color={aeropuertos.length ? 'primary' : 'default'} />
                </AccordionSummary>
                {/*Detalles*/}
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
                    {/*Filtros y orden de envios*/}
                    <Stack spacing={1.5} sx={{ flexShrink: 0, pb: 1.5 }}>
                        <TextField
                            size="small"
                            value={busqueda}
                            onChange={(event) => setBusqueda(event.target.value)}
                            placeholder="Buscar por código IATA"
                            fullWidth
                            sx={inputSx}
                        />
                        <FormControl size="small" fullWidth sx={inputSx}>
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
                        <Stack spacing={1.5} sx={{ flexShrink: 0, pb: 0.5 }} direction="row">
                            <FormControl size="small" sx={inputSx}>
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
                                sx={{
                                    color: '#e2e8f0',
                                    borderColor: 'rgba(148, 163, 184, 0.35)',
                                    textTransform: 'none',
                                    alignSelf: 'flex-start',
                                }}
                            >
                                Orden {direccionOrden === 'asc' ? 'ascendente' : 'descendente'}
                            </Button>
                        </Stack>
                    </Stack>
                    {/*Lista de envios en transporte, planificados y en las ultimas 4 horas*/}
                    {aeropuertosOrdenados.length === 0 ? (
                        <Box sx={emptySx}>No hay envios disponibles</Box>
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
                                                                <TableRow key={envio.envio.idPedido}>
                                                                    <TableCell>{envio.envio.idPedido}</TableCell>
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

const inputSx = {
    '& .MuiInputBase-root': {
        color: '#f8fafc',
        bgcolor: 'rgba(15, 23, 42, 0.72)',
    },
    '& .MuiInputLabel-root': { color: '#cbd5e1' },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148, 163, 184, 0.35)' },
    '& .MuiSvgIcon-root': { color: '#cbd5e1' },
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
