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
    SelectChangeEvent, TablePagination,
} from '@mui/material';
import {RefObject, useMemo, useRef, useState} from 'react';
import type { AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import type { EstadoCapacidad } from '@/app/shared/types/Evento';
import {Envio} from "@/app/shared/types/Envio";
import Draggable from "react-draggable";

type PanelAeropuertosProps = {
    aeropuertos: AeropuertoSimulacion[];
    visible: boolean;
};

type PanelEnviosProps = {
    aeropuertos: AeropuertoSimulacion[],
    envios : Envio[],
    visible: boolean
}

type Continente = 'america' | 'asia' | 'europa' | 'oceania' | 'africa';

type EstadoEnvio = "EN_CURSO" | "ENTREGADO" | "PLANIFICADO"

function calcularOcupacion(aeropuerto: AeropuertoSimulacion) {
    if (typeof aeropuerto.porcentajeOcupacion === 'number') {
        return Math.round(aeropuerto.porcentajeOcupacion);
    }
    if (!aeropuerto.capacidadAlmacen) return 0;
    return Math.round((aeropuerto.maletasActuales / aeropuerto.capacidadAlmacen) * 100);
}
export function PanelEnvios({ aeropuertos,envios, visible }: PanelEnviosProps) {
    const [panelAbierto, setPanelAbierto] = useState(false);
    //const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('desc');
    const [busquedaOrigen, setBusquedaOrigen] = useState('');
    const [busquedaDestino, setBusquedaDestino] = useState('');
    const [filtroEstado,setFiltroEstado] = useState('');
    //const [tipoOrden,setTipoOrden] = useState<OrderingFuncs>('calcularOcupacion');
    //const [aeropuertoExpandido, setAeropuertoExpandido] = useState<string | null>(null);

    const nodeRef = useRef<HTMLDivElement>(null);

    //Paginacion
    const [page,setPage] = useState<number>(0);
    const [rowsPerPage,setRowsPerPage] = useState<number>(10);

    const enviosFiltrados = useMemo(() => {
        return [...envios]
            .filter((envio)=>{
                const filtradoOrigen = !busquedaOrigen ? true:
                    envio.origenIata.toLowerCase().includes(busquedaOrigen.trim().toLowerCase());
                const filtradoDestino = !busquedaDestino ? true:
                    envio.destinoIata.toLowerCase().includes(busquedaDestino.trim().toLowerCase());
                const filtradoEstado = !filtroEstado ? true:
                    (envio as any)._estado === filtroEstado;
                return filtradoEstado && filtradoOrigen && filtradoDestino;
            })
            /*.sort((a, b) => {
                const sortFunc = orderFunctions[tipoOrden];
                const diferencia = sortFunc(a) - sortFunc(b);
                return direccionOrden === 'asc' ? diferencia : -diferencia;
            });*/
    }, [envios]);

    if (!visible) return null;

    return (
        <Draggable
            nodeRef={nodeRef as RefObject<HTMLDivElement>}
        >
            <Paper
                elevation={8}
                ref={nodeRef}
                sx={{
                    position: 'absolute',
                    top: 200,
                    right: 16,
                    zIndex: 19,
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
                        <Chip size="small" label={envios.length} color={envios.length ? 'primary' : 'default'} />
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
                        {panelAbierto && (<>{/*Filtros y orden de envios*/}
                            <Stack spacing={1.5} sx={{ flexShrink: 0, pb: 1.5 }}>
                                <Stack spacing={1.5} sx={{ flexShrink: 0, pb: 0.5 }} direction="row">
                                    <TextField
                                        size="small"
                                        value={busquedaOrigen}
                                        onChange={(event) => setBusquedaOrigen(event.target.value)}
                                        placeholder="IATA origen"
                                        fullWidth
                                        sx={inputSx}
                                    />
                                    <TextField
                                        size="small"
                                        value={busquedaDestino}
                                        onChange={(event) => setBusquedaDestino(event.target.value)}
                                        placeholder="IATA destino"
                                        fullWidth
                                        sx={inputSx}
                                    />
                                </Stack>
                                <FormControl size="small" fullWidth sx={inputSx}>
                                    <InputLabel id="filtro-continente-label">Filtrar por estado</InputLabel>
                                    <Select
                                        labelId="filtro-continente-label"
                                        value={filtroEstado}
                                        label="Filtrar por continente"
                                        onChange={(event: SelectChangeEvent) => setFiltroEstado(event.target.value as EstadoEnvio)}
                                    >
                                        <MenuItem value="PLANIFICADO">Envios planificados</MenuItem>
                                        <MenuItem value="EN_CURSO">Envios en vuelos</MenuItem>
                                        <MenuItem value="ENTREGADO">Envios entregados</MenuItem>
                                    </Select>
                                </FormControl>
                            </Stack>
                            {/*Lista de envios en transporte, planificados y en las ultimas 4 horas*/}
                            {enviosFiltrados.length === 0 ? (
                                <Box sx={emptySx}>No hay envios disponibles</Box>
                            ) : (
                                <Stack spacing={1} sx={scrollListSx}>
                                    <Box
                                        sx={{
                                            border: '1px solid rgba(148, 163, 184, 0.2)',
                                            borderRadius: 1,
                                            overflow: 'hidden',
                                            bgcolor: 'rgba(30, 41, 59, 0.82)',
                                            flexShrink: 0,
                                        }}
                                    >
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
                                                {enviosFiltrados
                                                    .slice(page*rowsPerPage,(page+1)*rowsPerPage)
                                                    .map((envio) => (
                                                        <TableRow key={envio.idPedido}>
                                                            <TableCell>{envio.idPedido}</TableCell>
                                                            <TableCell>{envio.origenIata}</TableCell>
                                                            <TableCell>{envio.destinoIata}</TableCell>
                                                            <TableCell align="right">{envio.cantidadMaletas}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                <TableRow>
                                                    <TablePagination page={page}
                                                                     onPageChange={(_,value)=>setPage(value)}
                                                                     rowsPerPage={rowsPerPage}
                                                                     onRowsPerPageChange={(e)=>setRowsPerPage(Number(e.target.value))}
                                                                     count={enviosFiltrados.length}
                                                    />
                                                </TableRow>
                                            </TableBody>

                                        </Table>
                                    </Box>
                                </Stack>
                            )}</>)}
                    </AccordionDetails>
                </Accordion>
            </Paper>
        </Draggable>

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
