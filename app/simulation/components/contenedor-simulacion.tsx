'use client';

import { ParametrosSimulacion, SimulacionService } from '@/app/services/simulation.service';
import { useRouter, useSearchParams } from 'next/navigation';
import { Map, MapRef } from '@vis.gl/react-maplibre';
import styles from '../../stylesheets/contenedor.module.css';
import { TextField, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useToast } from '@/app/shared/hooks/useToast';

enum SimulationType {
    OPERACION_DIA,
    VENTANA_CINCO_DIAS,
    COLAPSO_OPERATIVO
}

const MAX_OPERACION_DIA_MS = 2 * 24 * 60 * 60 * 1000;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

function tipoDesdeQuery(tipo: string | null): SimulationType {
    if (tipo === 'operacion') return SimulationType.OPERACION_DIA;
    if (tipo === 'simulacion') return SimulationType.VENTANA_CINCO_DIAS;
    if (tipo === 'colapso') return SimulationType.COLAPSO_OPERATIVO;
    return SimulationType.COLAPSO_OPERATIVO;
}

export function ContenedorSimulacion() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [simulationType, setSimulationType] = useState<SimulationType>(() => tipoDesdeQuery(searchParams.get('tipo')));
    const [startDate, setStartDate] = useState<Date | null>(new Date('2026-02-10T08:30:00'));
    const [endDate, setEndDate] = useState<Date | null>(new Date('2026-02-15T18:00:00'));
    const [timeScale, setTimeScale] = useState<number>(300);
    const { showToast, ToastComponent } = useToast();
    const mapRef = useRef<MapRef | null>(null);

    useEffect(() => {
        setSimulationType(tipoDesdeQuery(searchParams.get('tipo')));
    }, [searchParams]);

    useEffect(() => {
        if (simulationType === SimulationType.OPERACION_DIA) {
            const ahora = new Date();
            setStartDate(ahora);
            setEndDate(new Date(ahora.getTime() + UN_DIA_MS));
            return;
        }
        if (simulationType === SimulationType.VENTANA_CINCO_DIAS && startDate) {
            setEndDate(new Date(startDate.getTime() + 5 * UN_DIA_MS));
        }
    }, [simulationType]);

    const formatLocalDateTime = (date: Date): string => {
        const pad = (value: number) => value.toString().padStart(2, '0');
        return [
            date.getFullYear(),
            pad(date.getMonth() + 1),
            pad(date.getDate()),
        ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };

    const obtenerMensajeError = (error: unknown): string | null => {
        if (!error || typeof error !== 'object' || !('response' in error)) return null;
        const response = (error as { response?: { data?: { message?: string; error?: string; detail?: string } } }).response;
        return response?.data?.message || response?.data?.detail || response?.data?.error || null;
    };

    const handlePreparar = async () => {
        if (startDate == null) return showToast('Tienes que seleccionar la fecha de inicio', 'error');

        const fechaFinCalculada =
            simulationType === SimulationType.VENTANA_CINCO_DIAS
                ? new Date(startDate.getTime() + 5 * UN_DIA_MS)
                : simulationType === SimulationType.OPERACION_DIA
                    ? endDate
                    : null;

        if (simulationType === SimulationType.OPERACION_DIA) {
            if (fechaFinCalculada == null) return showToast('Selecciona la fecha fin de la operacion', 'error');
            const horizonteMs = fechaFinCalculada.getTime() - startDate.getTime();
            if (horizonteMs <= 0) return showToast('La fecha fin debe ser mayor a la fecha inicio', 'error');
            if (horizonteMs > MAX_OPERACION_DIA_MS) {
                return showToast('La operacion dia a dia no puede planificar mas de 2 dias', 'error');
            }
        }

        const k = simulationType === SimulationType.OPERACION_DIA ? 1 : timeScale;
        const formattedStart = formatLocalDateTime(startDate);
        const params: ParametrosSimulacion = {
            fechaInicio: formattedStart,
            fechaFin: fechaFinCalculada ? formatLocalDateTime(fechaFinCalculada) : undefined,
            k,
            modo: String(simulationType),
        };

        try {
            showToast('Preparando entorno...', 'info');
            const { data } = await SimulacionService.prepararInicio(params);
            showToast('Listo. Abriendo visualizador...', 'success');
            setTimeout(() => {
                router.push(`/simulation/${data.simulacionId}?topic=${encodeURIComponent(data.websocketTopic)}&k=${k}&modo=${simulationType}&fechaInicio=${formattedStart}`);
            }, 300);
        } catch (error) {
            console.error(error);
            showToast(obtenerMensajeError(error) || 'Error al conectar con el servidor de simulacion', 'error');
        }
    };

    const titulo =
        simulationType === SimulationType.OPERACION_DIA
            ? 'Operacion dia a dia'
            : simulationType === SimulationType.VENTANA_CINCO_DIAS
                ? 'Simulacion de 5 dias'
                : 'Colapso logistico';

    return (
        <div className={styles.mapContainer}>
            <Map
                ref={mapRef}
                initialViewState={{ longitude: 0, latitude: 0, zoom: 3.5 }}
                mapStyle="https://tiles.openfreemap.org/styles/bright"
                onLoad={() => {
                    const language = 'es';
                    mapRef.current?.getMap().setLayoutProperty('label_country_1', 'text-field', ['get', `name:${language}`]);
                    mapRef.current?.getMap().setLayoutProperty('label_country_2', 'text-field', ['get', `name:${language}`]);
                    mapRef.current?.getMap().setLayoutProperty('label_country_3', 'text-field', ['get', `name:${language}`]);
                }}
                interactiveLayerIds={['point']}
            />

            <div className={styles.simulacionModal}>
                <h2 className={styles.simulacionTitle}>{titulo}</h2>
                <p className={styles.simulacionSubtitle}>
                    {simulationType === SimulationType.OPERACION_DIA
                        ? 'Inicia con envios vacios y usa solo envios registrados manualmente.'
                        : 'Configura el escenario y abre el visualizador operativo.'}
                </p>

                <div className={styles.formContainer}>
                    <div>
                        <label className={styles.fieldLabel}>Escenario</label>
                        <div className={styles.modeGrid}>
                            <button
                                type="button"
                                className={`${styles.modeButton} ${simulationType === SimulationType.VENTANA_CINCO_DIAS ? styles.modeButtonActive : ''}`}
                                onClick={() => setSimulationType(SimulationType.VENTANA_CINCO_DIAS)}
                            >
                                Simulacion
                            </button>
                            <button
                                type="button"
                                className={`${styles.modeButton} ${simulationType === SimulationType.OPERACION_DIA ? styles.modeButtonActive : ''}`}
                                onClick={() => setSimulationType(SimulationType.OPERACION_DIA)}
                            >
                                Operacion dia a dia
                            </button>
                            <button
                                type="button"
                                className={`${styles.modeButton} ${simulationType === SimulationType.COLAPSO_OPERATIVO ? styles.modeButtonActive : ''}`}
                                onClick={() => setSimulationType(SimulationType.COLAPSO_OPERATIVO)}
                            >
                                Colapso logistico
                            </button>
                        </div>
                    </div>

                    <div className={styles.datePickerWrapper}>
                        <span id="select_date_start_label" className={styles.fieldLabel}>
                            {simulationType === SimulationType.OPERACION_DIA ? 'Inicio operativo' : 'Fecha y hora de inicio'}
                        </span>
                        <DatePicker
                            aria-labelledby="select_date_start_label"
                            showMonthYearDropdown
                            showTimeSelect
                            timeFormat="HH:mm"
                            timeIntervals={15}
                            dateFormat="yyyy-MM-dd HH:mm"
                            onChange={(date: Date | null) => {
                                setStartDate(date);
                                if (simulationType === SimulationType.OPERACION_DIA && date) {
                                    setEndDate(new Date(date.getTime() + UN_DIA_MS));
                                }
                            }}
                            selected={startDate}
                        />
                    </div>

                    {simulationType === SimulationType.OPERACION_DIA && (
                        <>
                            <div className={styles.datePickerWrapper}>
                                <span id="select_date_end_label" className={styles.fieldLabel}>Fin operativo</span>
                                <DatePicker
                                    aria-labelledby="select_date_end_label"
                                    showMonthYearDropdown
                                    showTimeSelect
                                    timeFormat="HH:mm"
                                    timeIntervals={15}
                                    dateFormat="yyyy-MM-dd HH:mm"
                                    onChange={(date: Date | null) => setEndDate(date)}
                                    selected={endDate}
                                    minDate={startDate ?? undefined}
                                />
                            </div>
                            <div className={styles.infoText}>Horizonte maximo: 2 dias. Los envios se agregan manualmente.</div>
                        </>
                    )}

                    {(simulationType === SimulationType.VENTANA_CINCO_DIAS || simulationType === SimulationType.COLAPSO_OPERATIVO) && (
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
                                slotProps={{ htmlInput: { min: 1, max: 10000 } }}
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
                                    '& .MuiInputBase-input': { padding: '12px 14px' },
                                }}
                            />
                        </div>
                    )}

                    <button onClick={handlePreparar} className={styles.simulacionButton}>
                        {simulationType === SimulationType.OPERACION_DIA ? 'Iniciar operacion' : 'Preparar e iniciar'}
                    </button>
                </div>
            </div>
            {ToastComponent}
        </div>
    );
}
