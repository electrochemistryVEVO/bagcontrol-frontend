'use client';

import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Chip,
    Collapse,
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
    TableRow,
    TextField,
    Typography,
    SelectChangeEvent,
    TablePagination,
} from '@mui/material';
import { RefObject, useMemo, useRef, useState } from 'react';
import type { AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import { Envio } from "@/app/shared/types/Envio";
import Draggable from "react-draggable";

type PanelEnviosProps = {
    aeropuertos: AeropuertoSimulacion[],
    envios: Envio[],
    visible: boolean,
    onMostrarRutaEnvio: (idPedido: string) => void,
}

type EstadoEnvio = "EN_CURSO" | "ENTREGADO" | "PLANIFICADO";

// Color del chip segun el estado del envio
const colorEstado: Record<string, 'warning' | 'success' | 'default'> = {
    EN_CURSO: 'warning',
    ENTREGADO: 'success',
    PLANIFICADO: 'default',
};

// Etiqueta corta para que el chip no ocupe demasiado espacio
const etiquetaEstado: Record<string, string> = {
    EN_CURSO: 'En curso',
    ENTREGADO: 'Entregado',
    PLANIFICADO: 'Planificado',
};

export function PanelEnvios({ aeropuertos, envios, visible, onMostrarRutaEnvio }: PanelEnviosProps) {
    const [panelAbierto, setPanelAbierto] = useState(false);
    const [busquedaOrigen, setBusquedaOrigen] = useState('');
    const [busquedaDestino, setBusquedaDestino] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    // Controla que fila esta expandida para mostrar el detalle de maletas
    const [envioExpandido, setEnvioExpandido] = useState<string | null>(null);

    const nodeRef = useRef<HTMLDivElement>(null);

    // Paginacion
    const [page, setPage] = useState<number>(0);
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);

    const enviosFiltrados = useMemo(() => {
        return [...envios].filter((envio) => {
            const filtradoOrigen = !busquedaOrigen
                ? true
                : envio.origenIata.toLowerCase().includes(busquedaOrigen.trim().toLowerCase());
            const filtradoDestino = !busquedaDestino
                ? true
                : envio.destinoIata.toLowerCase().includes(busquedaDestino.trim().toLowerCase());
            const filtradoEstado = !filtroEstado
                ? true
                : (envio as any)._estado === filtroEstado;
            return filtradoEstado && filtradoOrigen && filtradoDestino;
        });
    }, [envios, busquedaOrigen, busquedaDestino, filtroEstado]);

    if (!visible) return null;

    const toggleExpandir = (idPedido: string) => {
        setEnvioExpandido((actual) => (actual === idPedido ? null : idPedido));
    };

    return (
        <Draggable nodeRef={nodeRef as RefObject<HTMLDivElement>}>
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
                    {/* Titulo */}
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

                    {/* Detalles */}
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
                        {panelAbierto && (
                            <>
                                {/* Filtros */}
                                <Stack spacing={1} sx={{ flexShrink: 0, pb: 1.5 }}>
                                    <Stack spacing={1} direction="row">
                                        <TextField
                                            size="small"
                                            value={busquedaOrigen}
                                            onChange={(e) => setBusquedaOrigen(e.target.value)}
                                            placeholder="IATA origen"
                                            fullWidth
                                            sx={inputSx}
                                        />
                                        <TextField
                                            size="small"
                                            value={busquedaDestino}
                                            onChange={(e) => setBusquedaDestino(e.target.value)}
                                            placeholder="IATA destino"
                                            fullWidth
                                            sx={inputSx}
                                        />
                                    </Stack>
                                    <FormControl size="small" fullWidth sx={inputSx}>
                                        <InputLabel id="filtro-estado-label">Filtrar envios</InputLabel>
                                        <Select
                                            labelId="filtro-estado-label"
                                            value={filtroEstado}
                                            label="Filtrar envios"
                                            onChange={(e: SelectChangeEvent) =>
                                                setFiltroEstado(e.target.value as EstadoEnvio)
                                            }
                                        >
                                            <MenuItem value="">Todos</MenuItem>
                                            <MenuItem value="PLANIFICADO">Planificados</MenuItem>
                                            <MenuItem value="EN_CURSO">En vuelos</MenuItem>
                                            <MenuItem value="ENTREGADO">Entregados</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Stack>

                                {/* Tabla */}
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
                                                        <TableCell sx={{ maxWidth: 110 }}>ID</TableCell>
                                                        <TableCell>Ruta</TableCell>
                                                        <TableCell>Estado</TableCell>
                                                        <TableCell align="center">Maletas</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {enviosFiltrados
                                                        .slice(page * rowsPerPage, (page + 1) * rowsPerPage)
                                                        .map((envio) => {
                                                            const estado = (envio as any)._estado as string | undefined;
                                                            const expandido = envioExpandido === envio.idPedido;
                                                            // Genera los codigos de maleta desde el id y la cantidad
                                                            const maletas = Array.from(
                                                                { length: envio.cantidadMaletas },
                                                                (_, i) => `${envio.idPedido}-M${i + 1}`
                                                            );
                                                            return (
                                                                <>
                                                                    {/* Fila principal — clic expande/colapsa maletas */}
                                                                    <TableRow
                                                                        key={envio.idPedido}
                                                                        onClick={() => toggleExpandir(envio.idPedido)}
                                                                        sx={{
                                                                            ...clickableRowSx,
                                                                            ...(expandido && {
                                                                                bgcolor: 'rgba(56, 189, 248, 0.08)',
                                                                            }),
                                                                        }}
                                                                    >
                                                                        {/* ID truncado; el titulo completo aparece en hover */}
                                                                        <TableCell
                                                                            sx={{
                                                                                maxWidth: 110,
                                                                                overflow: 'hidden',
                                                                                textOverflow: 'ellipsis',
                                                                                whiteSpace: 'nowrap',
                                                                            }}
                                                                            title={envio.idPedido}
                                                                        >
                                                                            {envio.idPedido}
                                                                        </TableCell>
                                                                        {/* Origen → Destino en una sola celda */}
                                                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                                            {envio.origenIata} → {envio.destinoIata}
                                                                        </TableCell>
                                                                        {/* Estado como chip de color */}
                                                                        <TableCell>
                                                                            <Chip
                                                                                size="small"
                                                                                label={etiquetaEstado[estado ?? ''] ?? (estado ?? '—')}
                                                                                color={colorEstado[estado ?? ''] ?? 'default'}
                                                                                sx={{ fontSize: 10, height: 20 }}
                                                                            />
                                                                        </TableCell>
                                                                        {/* Cantidad total de maletas */}
                                                                        <TableCell align="center">
                                                                            {envio.cantidadMaletas}
                                                                        </TableCell>
                                                                    </TableRow>

                                                                    {/* Fila expandida: lista de maletas con boton Ruta */}
                                                                    {expandido && (
                                                                        <TableRow key={`${envio.idPedido}-detalle`}>
                                                                            <TableCell
                                                                                colSpan={4}
                                                                                sx={{ p: 0, borderBottom: '1px solid rgba(148,163,184,0.18)' }}
                                                                            >
                                                                                <Collapse in={expandido} unmountOnExit>
                                                                                    <Box
                                                                                        sx={{
                                                                                            bgcolor: 'rgba(15, 23, 42, 0.6)',
                                                                                            px: 1.5,
                                                                                            py: 0.75,
                                                                                        }}
                                                                                    >
                                                                                        <Typography
                                                                                            variant="caption"
                                                                                            sx={{
                                                                                                color: '#93c5fd',
                                                                                                fontWeight: 700,
                                                                                                display: 'block',
                                                                                                mb: 0.5,
                                                                                            }}
                                                                                        >
                                                                                            {envio.cantidadMaletas} maleta{envio.cantidadMaletas !== 1 ? 's' : ''}
                                                                                        </Typography>
                                                                                        <Stack spacing={0.5}>
                                                                                            {maletas.map((codigo) => (
                                                                                                <Stack
                                                                                                    key={codigo}
                                                                                                    direction="row"
                                                                                                    alignItems="center"
                                                                                                    justifyContent="space-between"
                                                                                                    sx={{
                                                                                                        bgcolor: 'rgba(30, 41, 59, 0.7)',
                                                                                                        borderRadius: 1,
                                                                                                        px: 1,
                                                                                                        py: 0.4,
                                                                                                    }}
                                                                                                >
                                                                                                    {/* Codigo completo de la maleta */}
                                                                                                    <Typography
                                                                                                        variant="caption"
                                                                                                        sx={{
                                                                                                            fontFamily: 'monospace',
                                                                                                            color: '#e2e8f0',
                                                                                                            flex: 1,
                                                                                                            overflow: 'hidden',
                                                                                                            textOverflow: 'ellipsis',
                                                                                                            whiteSpace: 'nowrap',
                                                                                                            mr: 1,
                                                                                                        }}
                                                                                                    >
                                                                                                        {codigo}
                                                                                                    </Typography>
                                                                                                    {/* Boton Ruta: muestra la ruta del envio en el mapa */}
                                                                                                    <Button
                                                                                                        size="small"
                                                                                                        variant="contained"
                                                                                                        onClick={(e) => {
                                                                                                            // Evita que el clic propague y colapse la fila
                                                                                                            e.stopPropagation();
                                                                                                            onMostrarRutaEnvio(envio.idPedido);
                                                                                                        }}
                                                                                                        sx={{
                                                                                                            minWidth: 0,
                                                                                                            px: 1,
                                                                                                            py: 0.25,
                                                                                                            fontSize: 11,
                                                                                                            lineHeight: 1.4,
                                                                                                            flexShrink: 0,
                                                                                                        }}
                                                                                                    >
                                                                                                        Ruta
                                                                                                    </Button>
                                                                                                </Stack>
                                                                                            ))}
                                                                                        </Stack>
                                                                                    </Box>
                                                                                </Collapse>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    )}
                                                                </>
                                                            );
                                                        })}
                                                    <TableRow>
                                                        <TablePagination
                                                            page={page}
                                                            onPageChange={(_, value) => setPage(value)}
                                                            rowsPerPage={rowsPerPage}
                                                            onRowsPerPageChange={(e) =>
                                                                setRowsPerPage(Number(e.target.value))
                                                            }
                                                            count={enviosFiltrados.length}
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

const clickableRowSx = {
    cursor: 'pointer',
    '&:hover': {
        backgroundColor: 'rgba(56, 189, 248, 0.12)',
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
    '&::-webkit-scrollbar': { width: 10 },
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
