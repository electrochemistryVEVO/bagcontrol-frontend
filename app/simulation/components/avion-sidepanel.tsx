import {Box, Table, TableBody, TableCell, TablePagination, TableRow} from "@mui/material";
import {memo, useEffect, useMemo, useState, RefObject} from "react";
import styles from "../../stylesheets/sidepanel.module.css";
import {EventoVuelo} from "@/app/shared/types/Evento";
import {MapGeoJSONFeature, MapLayerMouseEvent} from "@vis.gl/react-maplibre";
import {SimulacionService} from "@/app/services/simulation.service";
import {Envio} from "@/app/shared/types/Envio";
import {Aeropuerto} from "@/app/shared/types/Aeropuerto";
import {HourFormat} from "@/app/shared/Utils";


function SidePanelContents({
    flight,
    isOpen,
    idSimulacion,
    aeropuertos,
    tiempoSimulacionRef,
    onMostrarRutaEnvio,
    onEnfocarVuelo,
} : {
    flight: EventoVuelo,
    isOpen: boolean,
    idSimulacion: string,
    aeropuertos: Aeropuerto[],
    tiempoSimulacionRef: RefObject<number>,
    onMostrarRutaEnvio: (idPedido: string) => void,
    onEnfocarVuelo: () => void,
}){
    //Envios
    const [enviosAsignados,setEnviosAsignados] = useState<Envio[]>([]);

    //Paginacion
    const [page,setPage] = useState<number>(0);
    const [rowsPerPage,setRowsPerPage] = useState<number>(5);

    //Tomar los envios asignados al vuelo

    useEffect(() => {
        if(flight){
            const timestamp = new Date(tiempoSimulacionRef.current).toISOString();
            SimulacionService.obtenerEnviosPorVuelo(idSimulacion, flight.codigoVuelo, timestamp)
                .then(({data}: {data: Envio[]}) => {
                    setEnviosAsignados(data)})
                .catch((err) => {console.error(err)})
        }
    }, [flight, idSimulacion, isOpen, tiempoSimulacionRef]);
    //Memo de aeropuertos para no perder el hilo
    const _aeropuertos = useMemo(()=>{
        return aeropuertos.reduce((acum:Map<string,Aeropuerto>,val:Aeropuerto)=>{
            acum.set(val.codigoIata,val)
            return acum
        },new Map<string,Aeropuerto>())
    },[aeropuertos]);


    const aeropuertoOrigen = _aeropuertos.get(flight.origenIata);
    const aeropuertoDestino = _aeropuertos.get(flight.destinoIata);
    if(!aeropuertoOrigen || !aeropuertoDestino)return null;

    return flight && (<Box sx={{width: 500}} className={styles.panel} role="presentation">
        <div className={styles.header}>
            <h1>Vuelo {flight.codigoVuelo}</h1>
            <button className={styles.close}>×</button>
        </div>

        <div className={styles.card}>

            <div className={styles["card-header"]}>
                <h2 className={styles["section-title"]}>Información del vuelo</h2>

                <button type="button" style={miniButtonStyle} onClick={onEnfocarVuelo}>
                    Enfocar
                </button>
            </div>

            <div className={styles["flight-info"]}>

                <div className={styles["flight-row"]}>
                    <div className={styles["flight-label"]}>
                        <span>Origen</span>

                        <svg className={styles["plane-icon takeoff"]} viewBox="0 0 24 24">
                            <path
                                d="M2 16l20-8-1.5-2-8 2-3-5-2 .5 1.5 5-4 1.5-2-1-.5 1.5 2 2-.5 2z"
                                fill="currentColor"/>
                        </svg>
                    </div>

                    <div className={styles["flight-location"]}>
                        <div>{aeropuertoOrigen.ciudad} - {aeropuertoOrigen.pais}</div>
                        <div>{HourFormat(flight.horaSalidaLocal ? new Date(flight.horaSalidaLocal) : new Date(flight.horaSalidaUtc))}
                            (UTC{aeropuertoOrigen.gmt>0?"+":""}{aeropuertoOrigen.gmt})</div>
                    </div>
                </div>

                <div className={styles["flight-arrow"]}>
                    ↓
                </div>

                <div className={styles["flight-row"]}>
                    <div className={styles["flight-label"]}>
                        <span>Destino</span>

                        <svg className={styles["plane-icon landing"]} viewBox="0 0 24 24">
                            <path
                                d="M2 16l20-8-1.5-2-8 2-3-5-2 .5 1.5 5-4 1.5-2-1-.5 1.5 2 2-.5 2z"
                                fill="currentColor"/>
                        </svg>
                    </div>

                    <div className={styles["flight-location"]}>
                        <div>{aeropuertoDestino.ciudad} - {aeropuertoDestino.pais}</div>
                        <div>{HourFormat(flight.horaLlegadaLocal ? new Date(flight.horaLlegadaLocal) : new Date(flight.horaLlegadaUtc))}
                            (UTC{aeropuertoDestino.gmt>0?"+":""}{aeropuertoDestino.gmt})</div>
                    </div>
                </div>

            </div>

        </div>

        <div className={styles["card"]}>

            <div className={styles["section-title"]}>
                Información de paquetes
            </div>

            <div className={styles["capacity"]}>
                <span>Carga actual:</span>
                <span>{flight.cantidadMaletas}/{flight.capacidadMax}</span>
            </div>

            <div className={styles["progress progress-yellow"]}>
                <div className={styles["progress-fill progress-fill-yellow"]}>
                    {(flight.cantidadMaletas/flight.capacidadMax*100).toFixed(2)}%
                </div>
            </div>

            <div className={styles["packages-header"]}>
                <span>Envios asignados a esta UT:</span>
                <span className={styles["view-all"]}>{enviosAsignados.length} registros</span>
            </div>

            <div className={styles["subtitle"]}>
                Mostrando 5 resultados próximos
            </div>

            <Table className={styles["package-list"]}>

                <TableBody>
                    {
                        enviosAsignados
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((envio:Envio)=>(<TableRow key={envio.idPedido} className={styles["package-item"]}>
                                <TableCell className={styles["package-code"]}>{envio.idPedido}</TableCell>
                                <TableCell>{envio.origenIata} - {envio.destinoIata}</TableCell>
                                <TableCell>{envio.cantidadMaletas} maletas</TableCell>
                                <TableCell className={styles["package-time red"]}>{HourFormat(new Date(envio.fechaHora))}</TableCell>
                                <TableCell>
                                    <button
                                        type="button"
                                        onClick={() => onMostrarRutaEnvio(envio.idPedido)}
                                        style={miniButtonStyle}
                                    >
                                        Ruta
                                    </button>
                                </TableCell>
                            </TableRow>))
                    }
                </TableBody>
            </Table>
            <TablePagination rowsPerPage={rowsPerPage}
                             component="div"
                             rowsPerPageOptions={[5, 10, 15]}
                             page={page}
                             onPageChange={(_,_value)=>setPage(_value)}
                             onRowsPerPageChange={(_value)=>setRowsPerPage(Number(_value.target.value))}
                             count={enviosAsignados.length} />
        </div>
    </Box>)
}

export type OpenSimulationPanel = {
    open: boolean,
    selFlight: MapGeoJSONFeature | null,
    onClick: (e: MapLayerMouseEvent) => void,
    onClose: () => void
}

type AvionSidePanelProps = {
    openPanel: boolean,
    selFlight: MapGeoJSONFeature | null,
    idSimulacion: string,
    aeropuertos: Aeropuerto[],
    tiempoSimulacionRef: RefObject<number>,
    onMostrarRutaEnvio: (idPedido: string) => void,
    onEnfocarVuelo: () => void,
}

export function useOpenPanel(): OpenSimulationPanel {
    const [isOpen, setIsOpen] = useState(false);
    const [selFlight, setSelFlight] = useState<MapGeoJSONFeature | null>(null);
    return {
        open: isOpen,
        selFlight,
        onClick: (e: MapLayerMouseEvent) => {
            const properties = e.features?.[0]?.properties;
            if (!(properties?.isAirplane)) return;
            setSelFlight(e.features?.[0] ?? null);
            setIsOpen(true);
        },
        onClose: () => {
            setIsOpen(false)
        }
    };
}

export default memo(function AvionSidePanel(props: AvionSidePanelProps) {
    //Borrar logica tomada del mapa
    const {selFlight} = props;
    const flight = selFlight?.properties ? {...selFlight.properties} : null;
    if(!flight)return null;
    delete flight.bearing;
    delete flight.isAirplane;
    const _flight = flight as EventoVuelo;
    return (
        <div>
            <SidePanelContents
                flight={_flight}
                isOpen={props.openPanel}
                idSimulacion={props.idSimulacion}
                aeropuertos={props.aeropuertos}
                tiempoSimulacionRef={props.tiempoSimulacionRef}
                onMostrarRutaEnvio={props.onMostrarRutaEnvio}
                onEnfocarVuelo={props.onEnfocarVuelo}
            />
        </div>
    )})

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
