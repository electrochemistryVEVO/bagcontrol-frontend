'use client';

import { ParametrosSimulacion, SimulacionService } from '@/app/services/simulation.service';
import { useRouter } from 'next/navigation';
import {
  Map,
} from '@vis.gl/react-maplibre';
import styles from '../../stylesheets/contenedor.module.css';
import {FormControl, InputLabel, MenuItem, Slider, Typography} from "@mui/material";
import {Select} from "@mui/material";
import {useEffect, useState} from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {DateFormat} from "@/app/shared/Utils";

enum SimulationType{
    TIEMPO_REAL,
    VENTANA_TIEMPO,
    COLAPSO_OPERATIVO
}

export function ContenedorSimulacion() {
  const router = useRouter();
  const [simulationType,setSimulationType] = useState<SimulationType>(SimulationType.COLAPSO_OPERATIVO);
  const [startDate, setStartDate] = useState<Date|null>(new Date('2026-02-10'));
  const [endDate, setEndDate] = useState<Date|null>(new Date('2026-02-15'));
  const [timeScale,setTimeScale] = useState<number>(10);



  const handlePreparar = async () => {
      //Validar seleccion de tipo de simulacion
      if(simulationType==null)throw new Error("Tienes que seleccionar el tipo de simulacion");
      //Validar existencia de fechas
      if(startDate==null)
          throw new Error("Tienes que seleccionar la fecha de inicio");
      //Validar rango de fechas
      if(simulationType===SimulationType.VENTANA_TIEMPO){
          if(endDate == null)throw new Error("Tienes que seleccionar la fecha de fin");
          const dateDistance = (endDate.getTime() - startDate.getTime()) / 1000 / 60 / 60 / 24 //en dias
          if(dateDistance < 3 || dateDistance > 5) throw new Error("Rango de fechas debe de estar entre 3 y 5 dias");
      }
      const _startDate = startDate;
      const _endDate =
          (   simulationType===SimulationType.VENTANA_TIEMPO ? endDate :
              simulationType===SimulationType.TIEMPO_REAL ? new Date(_startDate.getTime() + 1000*60*60*24) : null)
      const _k = simulationType===SimulationType.TIEMPO_REAL ? 1 : timeScale;
      localStorage.setItem("fechaInicio",DateFormat(_startDate))
      console.log(_startDate);
      console.log(_endDate);
    const params : ParametrosSimulacion = { fechaInicio: DateFormat(_startDate),
        fechaFin: _endDate ? DateFormat(_endDate) : undefined ,
        k: _k*10}; //saMs de back es constante y es 10 segundos
    const { data } = await SimulacionService.prepararInicio(params); 
    router.push(`/simulation/${data.simulacionId}?topic=${encodeURIComponent(data.websocketTopic)}`);
  };



  return (
    <div className={styles.mapContainer}>
        <Map
            initialViewState={{ longitude: 0, latitude: 0, zoom: 3.5 }}
            mapStyle="https://demotiles.maplibre.org/style.json"
            interactiveLayerIds={['point']}
        >            
        </Map>
            
      <div className={styles.simulacionModal}>
        <h2 className={styles.simulacionTitle}>Configurar Simulación</h2>
          <FormControl>
              <InputLabel id="select_sim_type_label">Seleccionar tipo de simulación</InputLabel>
              <Select id="simulation_type"
                  labelId="select_sim_type_label"
                  value={simulationType}
                  onChange={(e)=>{
                      if(typeof e.target.value === "string")return;
                      setSimulationType(e.target.value)}}
              >
                  <MenuItem value={SimulationType.TIEMPO_REAL}>Ejecución en tiempo real</MenuItem>
                  <MenuItem value={SimulationType.VENTANA_TIEMPO}>Ventana de 3 a 5 días</MenuItem>
                  <MenuItem value={SimulationType.COLAPSO_OPERATIVO}>Hasta el colapso operativo</MenuItem>
              </Select>
              {simulationType === SimulationType.VENTANA_TIEMPO && (<>
                <Typography id="select_date_range_label">Seleccionar rango de fechas de simulacion</Typography>
                <DatePicker aria-labelledby="select_date_range_label" showMonthYearDropdown={true} selectsRange={true}
                    startDate={startDate} endDate={endDate}
                    selectedDates={[new Date('2026-02-10'),new Date('2026-02-15')]}
                    onChange={(update)=> {setStartDate(update[0]);setEndDate(update[1]);}}
                >
                </DatePicker>
              </>)}
              {(simulationType === SimulationType.TIEMPO_REAL || simulationType === SimulationType.COLAPSO_OPERATIVO) && (
                  <>
                      <Typography id="select_date_start_label">Seleccionar fecha inicio</Typography>
                      <DatePicker aria-labelledby="select_date_start_label" showMonthYearDropdown={true}
                                  onChange={(update:Date|null)=> {setStartDate(update);}}
                                  selected={startDate}
                      >
                      </DatePicker>
                  </>
              )}
              {(simulationType === SimulationType.VENTANA_TIEMPO || simulationType === SimulationType.COLAPSO_OPERATIVO) && (
                  <>
                      <Typography id="select_time_scale_label">
                          Numero de segundos simulados por segundo real
                      </Typography>
                      <Slider className={styles.simulacionContainerForm}
                      aria-labelledby="select_time_scale_label" id="select_time_scale"
                      defaultValue={30} min={1} max={300}
                      onChange = {(_,update)=>{setTimeScale(update);}}
                      valueLabelDisplay="auto"
                      marks = {[{value:1,label:'1'},{value:300,label:'300'}]}
                      />
                  </>
              )}
              <button
                  onClick={handlePreparar}
                  className={styles.simulacionButton}
              >
                  Preparar e Iniciar
              </button>
          </FormControl>
        </div>
    </div>
  );
}