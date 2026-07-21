'use client';

import { Box, Table, TableBody, TableCell, TableHead, TablePagination, TableRow } from "@mui/material";
import { memo, useEffect, useMemo, useState, RefObject } from "react";
import styles from "../../stylesheets/sidepanel.module.css";
import { AeropuertoSimulacion } from "@/app/shared/types/Aeropuerto";
import { EnvioAlmacen } from "@/app/shared/types/Envio";
import { MapGeoJSONFeature } from "@vis.gl/react-maplibre";
import { HourFormat } from "@/app/shared/Utils";
import { SimulacionService, type VueloInstanciado } from "@/app/services/simulation.service";
import { formatShortDateTime } from "@/app/shared/dateTime";

function fechaIsoLocal(epochUtc: number, gmt: number) {
    return new Date(epochUtc + gmt * 3_600_000).toISOString().slice(0, 19);
}

function desplazarFecha(fecha: string, dias: number) {
    const base = new Date(`${fecha}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + dias);
    return base.toISOString().slice(0, 10);
}

function formatearFechaVuelo(fechaHora: string) {
    const [fecha, hora = ''] = fechaHora.split('T');
    return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)} ${hora.slice(0, 5)}`;
}

function AeropuertoPanelContents({
    codigoIata,
    isOpen,
    aeropuertosRef,
    idSimulacion,
    tiempoSimulacionRef,
    onMostrarRutaEnvio,
    onEnfocarAeropuerto,
    onClose,
}: {
    codigoIata: string;
    isOpen: boolean;
    aeropuertosRef: RefObject<Record<string, AeropuertoSimulacion>>;
    idSimulacion: string;
    tiempoSimulacionRef: RefObject<number>;
    onMostrarRutaEnvio: (idPedido: string) => void;
    onEnfocarAeropuerto: (codigoIata: string) => void;
    onClose?: () => void;
}) {
    // 1. Inicializamos con los datos reactivos del Snapshot de simulación
    const [data, setData] = useState<AeropuertoSimulacion | undefined>();
    
    const [pageAlmacen, setPageAlmacen] = useState<number>(0);
    const [rowsPerPageAlmacen, setRowsPerPageAlmacen] = useState<number>(5);
    const [enviosAlmacen, setEnviosAlmacen] = useState<EnvioAlmacen[]>([]);
    const [vuelosProgramados, setVuelosProgramados] = useState<VueloInstanciado[]>([]);

    // 2. Efecto de sincronización para mantener el Sheet "vivo" al ritmo del motor lógico
    useEffect(() => {
        if (!isOpen || !codigoIata) return;

        const liveData = aeropuertosRef.current?.[codigoIata];
        if (liveData) {
            setData({ ...liveData });
        }

        // Forzar clonación de estado en RAM cada 100ms para actualizaciones en vivo
        const timer = setInterval(() => {
            const liveData = aeropuertosRef.current?.[codigoIata];
            if (liveData) {
                setData({ ...liveData });
            }
        }, 100);

        return () => clearInterval(timer);
    }, [isOpen, codigoIata, aeropuertosRef]);

    useEffect(() => {
        if (!isOpen || !codigoIata) return;

        let vigente = true;
        // Usamos _ultimaActualizacionEpoch (el instante simulado exacto del evento
        // AEROPUERTO_ACTUALIZADO) en vez de tiempoSimulacionRef.current, que ya
        // puede estar varios minutos simulados adelante del momento del aterrizaje.
        const epochConsulta = data?._ultimaActualizacionEpoch ?? tiempoSimulacionRef.current;
        const timestamp = new Date(epochConsulta).toISOString();
        SimulacionService.obtenerEnviosPorAlmacen(idSimulacion, codigoIata, timestamp)
            .then(({ data }) => { if (vigente) setEnviosAlmacen(data); })
            .catch(() => { if (vigente) setEnviosAlmacen([]); });

        return () => { vigente = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigoIata, idSimulacion, isOpen, tiempoSimulacionRef, data?.maletasActuales, data?._ultimaActualizacionEpoch]);

    useEffect(() => {
        if (!isOpen || !codigoIata) return;
        let vigente = true;
        const cargarVuelos = async () => {
            const aeropuerto = aeropuertosRef.current?.[codigoIata];
            if (!aeropuerto) return;
            const fechaLocal = fechaIsoLocal(tiempoSimulacionRef.current, aeropuerto.gmt).slice(0, 10);
            const fechas = [-1, 0, 1].map((dias) => desplazarFecha(fechaLocal, dias));
            try {
                const respuestas = await Promise.all(
                    fechas.map((fecha) => SimulacionService.obtenerVuelosInstanciados(fecha))
                );
                if (!vigente) return;
                const unicos = new Map<string, VueloInstanciado>();
                respuestas.flatMap(({ data }) => data).forEach((vuelo) => {
                    unicos.set(`${vuelo.codigoBase}|${vuelo.fechaHoraSalida}`, vuelo);
                });
                setVuelosProgramados([...unicos.values()]);
            } catch {
                if (vigente) setVuelosProgramados([]);
            }
        };
        void cargarVuelos();
        const timer = window.setInterval(() => void cargarVuelos(), 30_000);
        return () => {
            vigente = false;
            window.clearInterval(timer);
        };
    }, [aeropuertosRef, codigoIata, isOpen, tiempoSimulacionRef]);

    const maletasAlmacen = useMemo(
        () => enviosAlmacen.flatMap((item) =>
            Array.from({ length: item.envio.cantidadMaletas }, (_, index) => ({
                codigoMaleta: `M${index + 1}`,
                claveMaleta: `${item.envio.idPedido}-M${index + 1}`,
                item,
            }))
        ),
        [enviosAlmacen]
    );

    const vuelosPorAeropuerto = useMemo(() => {
        const ahoraLocal = fechaIsoLocal(tiempoSimulacionRef.current, data?.gmt ?? 0);
        const disponibles = vuelosProgramados.filter((vuelo) => !vuelo.estaCancelado);
        return {
            salientes: disponibles
                .filter((vuelo) => vuelo.origenIata === codigoIata && vuelo.fechaHoraSalida >= ahoraLocal)
                .sort((a, b) => a.fechaHoraSalida.localeCompare(b.fechaHoraSalida))
                .slice(0, 5),
            llegantes: disponibles
                .filter((vuelo) => vuelo.destinoIata === codigoIata && vuelo.fechaHoraLlegada >= ahoraLocal)
                .sort((a, b) => a.fechaHoraLlegada.localeCompare(b.fechaHoraLlegada))
                .slice(0, 5),
        };
    }, [codigoIata, data?.gmt, tiempoSimulacionRef, vuelosProgramados]);

    if (!data) return null;

    // Cálculo dinámico de la fecha hora local según el desfase GMT del aeropuerto seleccionado
    // Usa el reloj simulado (tiempoSimulacionRef.current) en vez de new Date()
    // para que la hora local coincida con la simulación, no con el wall-clock
    const obtenerHoraLocal = (epochSimuladoMs: number) => {
        const d = new Date(epochSimuladoMs);
        const utcMs = d.getTime() + (d.getTimezoneOffset() * 60000);
        const fechaLocal = new Date(utcMs + (3600000 * data.gmt));
        return HourFormat(fechaLocal);
    };

    // Estilos condicionales para la barra de progreso basados en el semáforo del backend
    const colorProgresoClass = 
        data.estadoCapacidad === 'ROJO' ? styles["progress-fill-red"] :
        data.estadoCapacidad === 'AMARILLO' ? styles["progress-fill-yellow"] :
        styles["progress-fill-green"];

    const contenedorProgresoClass = 
        data.estadoCapacidad === 'ROJO' ? styles["progress-red"] :
        data.estadoCapacidad === 'AMARILLO' ? styles["progress-yellow"] :
        styles["progress-green"];

    return (
        <Box sx={{ width: 460, maxWidth: '100vw' }} className={styles.panel} role="presentation">
            <div className={styles.header}>
                <h1>Aeropuerto {data.codigoIata}</h1>
                <button className={styles.close} onClick={onClose}>×</button>
            </div>

            {/* CARD 1: INFORMACIÓN GEOGRÁFICA Y HORARIA */}
            <div className={styles.card}>
                <div className={styles["card-header"]}>
                    <h2 className={styles["section-title"]}>Información de aeropuerto</h2>
                    <button type="button" style={miniButtonStyle} onClick={() => onEnfocarAeropuerto(data.codigoIata)}>
                        Enfocar
                    </button>
                </div>

                <div className={styles["flight-info"]}>
                    <div className={styles["flight-row"]}>
                        <div className={styles["flight-label"]}>
                            <span>Ubicación</span>
                        </div>
                        <div className={styles["flight-location"]}>
                            <div>{data.nombre}</div>
                            <div>{data.ciudad} - {data.pais}</div>
                        </div>
                    </div>

                    <div className={styles["flight-arrow"]}>· · ·</div>

                    <div className={styles["flight-row"]}>
                        <div className={styles["flight-label"]}>
                            <span>Hora Local</span>
                        </div>
                        <div className={styles["flight-location"]}>
                            <div>{obtenerHoraLocal(tiempoSimulacionRef.current)}</div>
                            <div>(GMT {data.gmt > 0 ? "+" : ""}{data.gmt})</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles["section-title"]}>Próximos vuelos</div>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1 }}>
                    <ListaVuelosAeropuerto
                        titulo="Salientes"
                        vacio="Sin próximas salidas"
                        vuelos={vuelosPorAeropuerto.salientes}
                        codigoIata={codigoIata}
                        tipo="SALIDA"
                    />
                    <ListaVuelosAeropuerto
                        titulo="Llegadas"
                        vacio="Sin próximas llegadas"
                        vuelos={vuelosPorAeropuerto.llegantes}
                        codigoIata={codigoIata}
                        tipo="LLEGADA"
                    />
                </Box>
            </div>


            <div className={styles.card}>
                <div className={styles["card-header"]}>
                    <div className={styles["section-title"]}>
                        Envíos en almacén
                    </div>
                </div>

                <div className={styles["subtitle"]}>
                    {enviosAlmacen.length} envíos · {maletasAlmacen.length} maletas
                </div>

                <Table className={styles["package-list"]}>
                    <TableHead>
                        <TableRow className={styles["package-item"]}>
                            <TableCell className={styles["package-code"]}>Maleta</TableCell>
                            <TableCell>Código de envío</TableCell>
                            <TableCell>Registro</TableCell>
                            <TableCell />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {maletasAlmacen.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} style={{ color: '#94a3b8', textAlign: 'center' }}>
                                    Sin envíos registrados en este almacén
                                </TableCell>
                            </TableRow>
                        ) : (
                            maletasAlmacen
                                .slice(pageAlmacen * rowsPerPageAlmacen, pageAlmacen * rowsPerPageAlmacen + rowsPerPageAlmacen)
                                .map(({ codigoMaleta, claveMaleta, item }) => (
                                    <TableRow key={claveMaleta} className={styles["package-item"]}>
                                        <TableCell className={styles["package-code"]}>
                                            {codigoMaleta}
                                        </TableCell>
                                        <TableCell>
                                            {item.envio.idPedido}
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 10.5 }} title={item.envio.fechaHora}>
                                            {formatShortDateTime(item.envio.fechaHora)}
                                        </TableCell>
                                        <TableCell>
                                            <button
                                                type="button"
                                                onClick={() => onMostrarRutaEnvio(item.envio.idPedido)}
                                                style={miniButtonStyle}
                                            >
                                                Ruta
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                ))
                        )}
                    </TableBody>
                </Table>

                <TablePagination
                    rowsPerPage={rowsPerPageAlmacen}
                    component="div"
                    rowsPerPageOptions={[5, 10, 15]}
                    page={pageAlmacen}
                    count={maletasAlmacen.length}
                    onPageChange={(_, value) => setPageAlmacen(value)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPageAlmacen(Number(e.target.value));
                        setPageAlmacen(0);
                    }}
                />
            </div>
            {/* CARD 2: MONITOREO DE ALMACÉN EN TIEMPO REAL */}
            <div className={styles.card}>
                <div className={styles["section-title"]}>
                    Capacidad de Almacén
                </div>

                <div className={styles["capacity"]}>
                    <span>Carga actual:</span>
                    <span>{data.maletasActuales} / {data.capacidadAlmacen} maletas</span>
                </div>

                <div className={`${styles.progress} ${contenedorProgresoClass}`}>
                    <div 
                        className={`${styles["progress-fill"]} ${colorProgresoClass}`}
                        style={{ width: `${Math.min(100, data.porcentajeOcupacion)}%` }}
                    >
                        {data.porcentajeOcupacion.toFixed(2)}%
                    </div>
                </div>

            </div>
        </Box>
    );
}

type AeropuertoSidePanelProps = {
    openPanel: boolean;
    selAirport: MapGeoJSONFeature | null;
    aeropuertosRef: RefObject<Record<string, AeropuertoSimulacion>>;
    idSimulacion: string;
    tiempoSimulacionRef: RefObject<number>;
    onMostrarRutaEnvio: (idPedido: string) => void;
    onEnfocarAeropuerto: (codigoIata: string) => void;
    onClose?: () => void;
};

export default memo(function AeropuertoSidePanel({
    openPanel,
    selAirport,
    aeropuertosRef,
    idSimulacion,
    tiempoSimulacionRef,
    onMostrarRutaEnvio,
    onEnfocarAeropuerto,
    onClose,
}: AeropuertoSidePanelProps) {
    const properties = selAirport?.properties;
    if (!properties || !properties.isAirport) return null;

    return (
        <div>
            <AeropuertoPanelContents
                codigoIata={properties.codigoIata}
                isOpen={openPanel}
                aeropuertosRef={aeropuertosRef}
                idSimulacion={idSimulacion}
                tiempoSimulacionRef={tiempoSimulacionRef}
                onMostrarRutaEnvio={onMostrarRutaEnvio}
                onEnfocarAeropuerto={onEnfocarAeropuerto}
                onClose={onClose}
            />
        </div>
    );
});

function ListaVuelosAeropuerto({
    titulo,
    vacio,
    vuelos,
    codigoIata,
    tipo,
}: {
    titulo: string;
    vacio: string;
    vuelos: VueloInstanciado[];
    codigoIata: string;
    tipo: 'SALIDA' | 'LLEGADA';
}) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Box sx={{ color: '#93c5fd', fontWeight: 700, fontSize: 12, mb: 0.75 }}>{titulo}</Box>
            {vuelos.length === 0 ? (
                <Box sx={{ color: '#1a1a1a', fontSize: 11 }}>{vacio}</Box>
            ) : vuelos.map((vuelo) => (
                <Box
                    key={`${vuelo.codigoBase}|${vuelo.fechaHoraSalida}`}
                    sx={{ py: 0.65, borderBottom: '1px solid rgba(148,163,184,0.15)', '&:last-child': { borderBottom: 0 } }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontSize: 11.5 }}>
                        <strong>{vuelo.codigoBase}</strong>
                        <span style={{ color: '#1a1a1a' }}>
                            {tipo === 'SALIDA' ? `→ ${vuelo.destinoIata}` : `${vuelo.origenIata} →`}
                        </span>
                    </Box>
                    <Box sx={{ color: '#1a1a1a', fontSize: 10.5, mt: 0.2 }}>
                        {formatearFechaVuelo(tipo === 'SALIDA' ? vuelo.fechaHoraSalida : vuelo.fechaHoraLlegada)} · {codigoIata}
                    </Box>
                </Box>
            ))}
        </Box>
    );
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

