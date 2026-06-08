import {Box, Button, Drawer, Table, TableBody, TableCell, TablePagination, TableRow} from "@mui/material";
import {memo, useCallback, useEffect, useMemo, useState} from "react";
import styles from "../../stylesheets/sidepanel.module.css";
import {EventoVuelo} from "@/app/shared/types/Evento";
import {MapGeoJSONFeature, MapLayerMouseEvent} from "@vis.gl/react-maplibre";
import {SimulacionService} from "@/app/services/simulation.service";
import {Envio} from "@/app/shared/types/Envio";
import {Aeropuerto} from "@/app/shared/types/Aeropuerto";
import {HourFormat} from "@/app/shared/Utils";


function SidePanelContents({flight,isOpen,idSimulacion,aeropuertos} : {flight:EventoVuelo,isOpen:boolean,idSimulacion:string,aeropuertos:Aeropuerto[]}){
    //Envios
    const [enviosAsignados,setEnviosAsignados] = useState<Envio[]>([]);

    //Paginacion
    const [page,setPage] = useState<number>(0);
    const [rowsPerPage,setRowsPerPage] = useState<number>(5);

    //Tomar los envios asignados al vuelo

    useEffect(() => {
        console.log(flight)
        if(flight){
            //Llamada a API
            SimulacionService.obtenerEnviosPorVuelo(idSimulacion,flight.codigoVuelo)
                .then(({data}:{data:Envio[]})=>{
                    setEnviosAsignados(data)})
                .catch((err)=>{console.error(err)})
        }
    }, [isOpen]);
    console.log(enviosAsignados)



    console.log(enviosAsignados)
    //Memo de aeropuertos para no perder el hilo
    const _aeropuertos = useMemo(()=>{
        return aeropuertos.reduce((acum:Map<string,Aeropuerto>,val:Aeropuerto)=>{
            acum.set(val.codigoIata,val)
            return acum
        },new Map<string,Aeropuerto>())
    },[flight]);


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

                <button className={styles["collapse-btn"]}>
                    <svg viewBox="0 0 24 24">
                        <path d="M6 15L12 9L18 15"/>
                    </svg>
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
                <span>Paquetes:</span>
                <a href="#" className={styles["view-all"]}>ver todos</a>
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
                                <TableCell className={styles["package-time red"]}>hasta {HourFormat(new Date(envio.fechaHora))}</TableCell>
                                <TableCell>
                                    <svg className={styles["external"]} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 3h7v7"/>
                                        <path d="M10 14L21 3"/>
                                        <rect x="3" y="7" width="14" height="14" rx="2"/>
                                    </svg>
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
    let flight = selFlight?.properties ? {...selFlight.properties} : null;
    if(!flight)return null;
    delete flight.bearing;
    delete flight.isAirplane;
    const _flight = flight as EventoVuelo;
    return (
        <div>
            <SidePanelContents flight={_flight} isOpen={props.openPanel} idSimulacion={props.idSimulacion} aeropuertos={props.aeropuertos}/>
        </div>
    )})