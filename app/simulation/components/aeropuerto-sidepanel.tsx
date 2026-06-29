'use client';

import { Box, Table, TableBody, TableCell, TablePagination, TableRow } from "@mui/material";
import { memo, useEffect, useState, RefObject } from "react";
import styles from "../../stylesheets/sidepanel.module.css";
import { AeropuertoSimulacion } from "@/app/shared/types/Aeropuerto";
import {Envio, EnvioAeropuerto, EnvioAlmacen} from "@/app/shared/types/Envio";
import { MapGeoJSONFeature } from "@vis.gl/react-maplibre";
import { HourFormat } from "@/app/shared/Utils";
import { SimulacionService } from "@/app/services/simulation.service";

function AeropuertoPanelContents({
    codigoIata,
    isOpen,
    aeropuertosRef,
    idSimulacion,
    tiempoSimulacionRef,
    onMostrarRutaEnvio,
    onEnfocarAeropuerto,
}: {
    codigoIata: string;
    isOpen: boolean;
    aeropuertosRef: RefObject<Record<string, AeropuertoSimulacion>>;
    idSimulacion: string;
    tiempoSimulacionRef: RefObject<number>;
    onMostrarRutaEnvio: (idPedido: string) => void;
    onEnfocarAeropuerto: (codigoIata: string) => void;
}) {
    // 1. Inicializamos con los datos reactivos del Snapshot de simulación
    const [data, setData] = useState<AeropuertoSimulacion | undefined>();
    
    // Paginación local para la lista de paquetes críticos
    const [page, setPage] = useState<number>(0);
    const [rowsPerPage, setRowsPerPage] = useState<number>(5);
    const [pageAlmacen, setPageAlmacen] = useState<number>(0);
    const [rowsPerPageAlmacen, setRowsPerPageAlmacen] = useState<number>(5);
    const [enviosAlmacen, setEnviosAlmacen] = useState<EnvioAlmacen[]>([]);

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

        const timestamp = new Date(tiempoSimulacionRef.current).toISOString();
        SimulacionService.obtenerEnviosPorAlmacen(idSimulacion, codigoIata, timestamp)
            .then(({ data }) => setEnviosAlmacen(data))
            .catch(() => setEnviosAlmacen([]));
    }, [codigoIata, idSimulacion, isOpen, tiempoSimulacionRef]);

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

    const listaCriticos = data.enviosProximosAVencer || [];

    return (
        <Box sx={{ width: 500 }} className={styles.panel} role="presentation">
            <div className={styles.header}>
                <h1>Aeropuerto {data.codigoIata}</h1>
                <button className={styles.close}>×</button>
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
                <div className={styles["section-title"]}>
                    Productos en almacen
                </div>

                <div className={styles["subtitle"]}>
                    Envios en destino final y en transito por este aeropuerto
                </div>

                <Table className={styles["package-list"]}>
                    <TableBody>
                        {enviosAlmacen.length === 0 ? (
                            <TableRow>
                                <TableCell style={{ color: '#94a3b8', textAlign: 'center' }}>
                                    Sin productos registrados en este almacen
                                </TableCell>
                            </TableRow>
                        ) : (
                            enviosAlmacen
                                .slice(pageAlmacen * rowsPerPageAlmacen, pageAlmacen * rowsPerPageAlmacen + rowsPerPageAlmacen)
                                .map((item: EnvioAlmacen) => (
                                    <TableRow key={item.envio.idPedido} className={styles["package-item"]}>
                                        <TableCell className={styles["package-code"]}>
                                            {item.envio.idPedido}
                                        </TableCell>
                                        <TableCell>
                                            {item.tipoAlmacen === 'DESTINO_FINAL' ? 'Destino final' : 'Tránsito'}
                                        </TableCell>
                                        <TableCell>
                                            {item.envio.cantidadMaletas} maletas
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
                    count={enviosAlmacen.length}
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

                <div className={styles["packages-header"]}>
                    <span>Paquetes en riesgo de SLA:</span>
                    <a href="#" className={styles["view-all"]}>ver todos</a>
                </div>

                <div className={styles["subtitle"]}>
                    Mostrando resultados próximos a incumplir plazo
                </div>

                {/* TABLA DE ENVÍOS CRÍTICOS EXTRAÍDOS DEL INYECTOR DEL WS */}
                <Table className={styles["package-list"]}>
                    <TableBody>
                        {listaCriticos.length === 0 ? (
                            <TableRow>
                                <TableCell style={{ color: '#94a3b8', textAlign: 'center' }}>
                                    Sin alertas críticas de SLA en este aeropuerto
                                </TableCell>
                            </TableRow>
                        ) : (
                            listaCriticos
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((envio: EnvioAeropuerto) => (
                                    <TableRow key={envio.envio.idPedido} className={styles["package-item"]}>
                                        <TableCell className={styles["package-code"]}>
                                            Pedido #{envio.envio.idPedido}
                                        </TableCell>
                                        <TableCell className={`${styles["package-time"]} ${styles.red}`}>
                                            Fec. Límite: {envio.envio.fechaHora ? HourFormat(new Date(envio.envio.fechaHora)) : 'No disponible'}
                                        </TableCell>
                                        <TableCell style={{ width: 40 }}>
                                            <svg className={styles["external"]} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M14 3h7v7" />
                                                <path d="M10 14L21 3" />
                                                <rect x="3" y="7" width="14" height="14" rx="2" />
                                            </svg>
                                        </TableCell>
                                    </TableRow>
                                ))
                        )}
                    </TableBody>
                </Table>
                
                <TablePagination
                    rowsPerPage={rowsPerPage}
                    component="div"
                    rowsPerPageOptions={[5, 10, 15]}
                    page={page}
                    count={listaCriticos.length}
                    onPageChange={(_, value) => setPage(value)}
                    onRowsPerPageChange={(e) => setRowsPerPage(Number(e.target.value))}
                />
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
};

export default memo(function AeropuertoSidePanel({
    openPanel,
    selAirport,
    aeropuertosRef,
    idSimulacion,
    tiempoSimulacionRef,
    onMostrarRutaEnvio,
    onEnfocarAeropuerto,
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
            />
        </div>
    );
});

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
