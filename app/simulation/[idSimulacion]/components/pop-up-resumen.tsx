import {EventoVuelo} from "@/app/shared/types/Evento";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary, Box, Button,
    Dialog, DialogActions,
    DialogContent,
    DialogTitle, Icon,
    List,
    ListItem, Stack, Table, TableBody, TableCell, TablePagination, TableRow,
    Typography
} from "@mui/material";
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import styles from "@/app/stylesheets/sidepanel.module.css"
import {RefObject, useEffect, useMemo, useState} from "react";
import {Envio, EnvioAeropuerto} from "@/app/shared/types/Envio";
import {SimulacionService} from "@/app/services/simulation.service";
import {HourFormat} from "@/app/shared/Utils";
import {useRouter} from "next/navigation";

type Props = {
    openDialog : boolean
    idSimulacion : string
    tiempoSimulacionRef : RefObject<number>
    ultimoVuelo : EventoVuelo | null | undefined
}
export function PopUpResumen(props : Props){
    const {ultimoVuelo,idSimulacion,openDialog,tiempoSimulacionRef} = props;
    const [enviosPorVuelo,setEnviosPorVuelo] = useState<Envio[]>([]);
    const [accordionOpen,setAccordionOpen] = useState(false);
    const router = useRouter();

    //Paginacion envios
    const [enviosPage,setEnviosPage] = useState<number>(0);
    const [enviosRpp,setEnviosRpp] = useState<number>(5);

    useEffect(() => {
        if(ultimoVuelo && openDialog){
            const timestamp = new Date(tiempoSimulacionRef.current).toISOString();
            SimulacionService.obtenerEnviosPorVuelo(idSimulacion,ultimoVuelo,timestamp)
                .then((res)=>{setEnviosPorVuelo(res.data)})
        }
    }, [idSimulacion, openDialog, tiempoSimulacionRef, ultimoVuelo]);
    return (<Dialog open={openDialog} fullWidth maxWidth="sm">
        <DialogTitle>Resumen de simulación</DialogTitle>
        <DialogContent sx={{overflow:'hidden'}}>
            <Accordion expanded={accordionOpen} className={styles.card}>
                <AccordionSummary sx={{
                    '& .MuiAccordionSummary-content': {
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                    },}}  onClick={()=>{setAccordionOpen(!accordionOpen)}}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Último vuelo en simulación</Typography>
                    <ArrowDropDownIcon/>
                </AccordionSummary>
                <AccordionDetails>
                    {ultimoVuelo ? (<Stack sx={{gap:"20px"}}>
                            <div className={styles.card}>
                            <Typography variant="h6" sx={{pb:1}}>Información general</Typography>
                        <List>
                            <ListItem sx={{justifyContent:'space-between'}}>
                                <Typography sx={{ fontWeight: 700 }}>Código de vuelo:</Typography>
                                <p>{ultimoVuelo?.codigoVuelo}</p>
                            </ListItem>
                            <ListItem sx={{justifyContent:'space-between'}}>
                                <Typography sx={{ fontWeight: 700 }}>Código de aeropuerto origen:</Typography>
                                <p>{ultimoVuelo?.origenIata}</p>
                            </ListItem>
                            <ListItem sx={{justifyContent:'space-between'}}>
                                <Typography sx={{ fontWeight: 700 }}>Código de aeropuerto destino:</Typography>
                                <p>{ultimoVuelo?.destinoIata}</p>
                            </ListItem>
                            <ListItem sx={{justifyContent:'space-between'}}>
                                <Typography sx={{ fontWeight: 700 }}>Hora de llegada</Typography>
                                <p>{ultimoVuelo?.fechaHoraEvento}</p>
                            </ListItem>
                        </List>
                        </div>
                        <div className={styles.card}>
                            <Typography variant="h6" sx={{pb:1}}>Envíos</Typography>
                            <Table className={styles["package-list"]}>
                                <TableBody>
                                    {enviosPorVuelo.length === 0 ? (
                                        <TableRow>
                                            <TableCell style={{ color: '#94a3b8', textAlign: 'center' }}>
                                                Sin envios.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        enviosPorVuelo
                                            .slice(enviosPage * enviosRpp, enviosPage * enviosRpp + enviosRpp)
                                            .map((envio: Envio) => (
                                                <TableRow key={envio.idPedido} className={styles["package-item"]}>
                                                    <TableCell className={styles["package-code"]}>
                                                        Pedido #{envio.idPedido}
                                                    </TableCell>
                                                    <TableCell className={`${styles["package-time"]} ${styles.red}`}>
                                                        Hora: {envio.fechaHora ? HourFormat(new Date(envio.fechaHora)) : 'No disponible'}
                                                    </TableCell>
                                                    <TableCell className={styles["package-code"]}>
                                                        Maletas: {envio.cantidadMaletas}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                    )}
                                </TableBody>
                            </Table>

                            <TablePagination
                                rowsPerPage={enviosRpp}
                                component="div"
                                rowsPerPageOptions={[5, 10, 15]}
                                page={enviosPage}
                                count={enviosPorVuelo.length}
                                onPageChange={(_, value) => setEnviosPage(value)}
                                onRowsPerPageChange={(e) => setEnviosRpp(Number(e.target.value))}
                            />
                        </div>
                        </Stack>)
                    : (<p>No se encontró un último vuelo.</p>)}
                </AccordionDetails>
            </Accordion>
        </DialogContent>
        <DialogActions>
            <Button onClick={()=>{
                router.back();
                setTimeout(() => router.push('/simulation'), 500);
            }}>
                REGRESAR
            </Button>
        </DialogActions>
    </Dialog>)
}