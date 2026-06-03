'use client';

import { ParametrosSimulacion, SimulacionService } from '@/app/services/simulation.service';
import { useRouter } from 'next/navigation';
import { Map } from '@vis.gl/react-maplibre';
import styles from '../../stylesheets/contenedor.module.css';
import { MenuItem, Typography, Select, TextField } from "@mui/material";
import { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { DateFormat } from "@/app/shared/Utils";
import { useToast } from '@/app/shared/hooks/useToast';

enum SimulationType {
    TIEMPO_REAL,
    VENTANA_TIEMPO,
    COLAPSO_OPERATIVO
}

export function ContenedorSimulacion() {
    const router = useRouter();
    const [simulationType, setSimulationType] = useState<SimulationType>(SimulationType.COLAPSO_OPERATIVO);
    const [startDate, setStartDate] = useState<Date | null>(new Date('2026-02-10'));
    const [endDate, setEndDate] = useState<Date | null>(new Date('2026-02-15'));
    const [timeScale, setTimeScale] = useState<number>(300);
    const { showToast, ToastComponent } = useToast();

    const handlePreparar = async () => {
        if (simulationType == null) return showToast("Tienes que seleccionar un tipo de simulación");
        if (startDate == null) return showToast("Tienes que seleccionar la fecha de inicio");
      
        if (simulationType === SimulationType.VENTANA_TIEMPO) {
            if (endDate == null) return showToast("Tienes que seleccionar la fecha de fin");
            const dateDistance = (endDate.getTime() - startDate.getTime()) / 1000 / 60 / 60 / 24;
            if (dateDistance < 3 || dateDistance > 5) throw new Error("Rango de fechas debe de estar entre 3 y 5 dias");
        }
      
        const _startDate = startDate;
        const _endDate = (
            simulationType === SimulationType.VENTANA_TIEMPO ? endDate :
            simulationType === SimulationType.TIEMPO_REAL ? new Date(_startDate.getTime() + 1000 * 60 * 60 * 24) : null
        );
        const _k = simulationType === SimulationType.TIEMPO_REAL ? 1 : timeScale;
        
        localStorage.setItem("fechaInicio", DateFormat(_startDate));
        
        const params: ParametrosSimulacion = { 
            fechaInicio: DateFormat(_startDate),
            fechaFin: _endDate ? DateFormat(_endDate) : undefined,
            k: _k
        };
        try {
            showToast("Preparando entorno de simulación...", "info");
            const { data } = await SimulacionService.prepararInicio(params);           
            showToast("¡Simulación lista! Redireccionando...", "success");
            setTimeout(() => {
                router.push(`/simulation/${data.simulacionId}?topic=${encodeURIComponent(data.websocketTopic)}&k=${_k}`);
            }, 300);
        } catch (error) {
            console.error(error);
            showToast("Error al conectar con el servidor de simulación", "error");
        }
    };
  return (
    <div className={styles.mapContainer}>
        <Map
            initialViewState={{ longitude: 0, latitude: 0, zoom: 3.5 }}
            mapStyle="https://demotiles.maplibre.org/style.json"
            interactiveLayerIds={['point']}
        />            
            
        <div className={styles.simulacionModal}>
            <h2 className={styles.simulacionTitle}>Configurar Simulación</h2>
            <p className={styles.simulacionSubtitle}>Establece los parámetros del motor operativo</p>
            
            <div className={styles.formContainer}>
                {/* Campo Tipo de simulación */}
                <div>
                    <label className={styles.fieldLabel} htmlFor="simulation_type">Tipo de simulación</label>
                    <Select
                        id="simulation_type"
                        value={simulationType}
                        onChange={(e) => {
                            if (typeof e.target.value === "string") return;
                            setSimulationType(e.target.value);
                        }}
                        fullWidth
                        sx={{
                            color: '#ffffff',
                            backgroundColor: 'rgba(30, 41,  slate, 0.7)',
                            '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
                            '.MuiSvgIcon-root': { color: '#94a3b8' }
                        }}
                    >
                        <MenuItem value={SimulationType.TIEMPO_REAL}>Ejecución en tiempo real</MenuItem>
                        <MenuItem value={SimulationType.VENTANA_TIEMPO}>Ventana de 3 a 5 días</MenuItem>
                        <MenuItem value={SimulationType.COLAPSO_OPERATIVO}>Hasta el colapso operativo</MenuItem>
                    </Select>
                </div>

                {/* Renderizado Condicional de Fechas */}
                {simulationType === SimulationType.VENTANA_TIEMPO && (
                    <div className={styles.datePickerWrapper}>
                        <span id="select_date_range_label" className={styles.fieldLabel}>Rango de fechas</span>
                        <DatePicker 
                            aria-labelledby="select_date_range_label" 
                            showMonthYearDropdown 
                            selectsRange 
                            startDate={startDate} 
                            endDate={endDate}
                            onChange={(update) => { setStartDate(update[0]); setEndDate(update[1]); }}
                            dateFormat="dd/MM/yyyy"
                        />
                    </div>
                )}

                {(simulationType === SimulationType.TIEMPO_REAL || simulationType === SimulationType.COLAPSO_OPERATIVO) && (
                    <div className={styles.datePickerWrapper}>
                        <span id="select_date_start_label" className={styles.fieldLabel}>Fecha de inicio</span>
                        <DatePicker 
                            aria-labelledby="select_date_start_label" 
                            showMonthYearDropdown
                            onChange={(date: Date | null) => { setStartDate(date); }}
                            selected={startDate}
                            dateFormat="dd/MM/yyyy"
                        />
                    </div>
                )}

                {/* Selector de escala de tiempo (K) */}
                {(simulationType === SimulationType.VENTANA_TIEMPO || simulationType === SimulationType.COLAPSO_OPERATIVO) && (
                    <div>
                        <Typography id="select_time_scale_label" className={styles.fieldLabel}>
                            Minutos simulados por minuto real (K)
                        </Typography>                        
                        <TextField
                            id="select_time_scale"
                            type="number"
                            value={timeScale}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                setTimeScale(val <= 0 ? 1 : val);
                            }}
                            slotProps={{
                                htmlInput: { min: 1, max: 10000 }
                            }}
                            fullWidth
                            variant="outlined"
                            placeholder="Ej. 15, 60, 1440"
                            sx={{
                                backgroundColor: 'rgba(30, 41, 59, 0.7)',
                                borderRadius: '8px',
                                '& .MuiOutlinedInput-root': {
                                    color: '#ffffff',
                                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.15)' },
                                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                                },
                                '& .MuiInputBase-input': {
                                    padding: '12px 14px', /* Sincroniza la altura visual con el selector superior */
                                }
                            }}
                        />            
                    </div>
                )}

                {/* Botón de envío */}
                <button onClick={handlePreparar} className={styles.simulacionButton}>
                    Preparar e Iniciar
                </button>
            </div>
        </div>
        {ToastComponent}
    </div>
  );
}