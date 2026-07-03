'use client';

import React, { useRef, useState } from 'react';
import type { RefObject } from 'react';
import Draggable from 'react-draggable';
import { Paper, Box, Typography } from '@mui/material';

interface Props {
  visible: boolean;
  ocupacionFlota: number;
  ocupacionAeropuertos: number;
  maletasPendientes: number;
  tiempoPromedioEntregaMs: number | null; // null = sin datos aún
}

function colorPorPorcentaje(p: number) {
  if (p >= 85) return '#ef4444';
  if (p >= 60) return '#eab308';
  return '#22c55e';
}

function formatDuracion(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export function PanelMetricas({ visible, ocupacionFlota, ocupacionAeropuertos, maletasPendientes, tiempoPromedioEntregaMs }: Props) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [expandido, setExpandido] = useState(false);

  if (!visible) return null;

  const floraRedondeada   = Math.round(Math.max(0, Math.min(100, ocupacionFlota)));
  const aeropRedondeado   = Math.round(Math.max(0, Math.min(100, ocupacionAeropuertos)));
  const colorFlota        = colorPorPorcentaje(floraRedondeada);
  const colorAeropuertos  = colorPorPorcentaje(aeropRedondeado);
  const colorGlobal       = colorPorPorcentaje(Math.max(floraRedondeada, aeropRedondeado));

  return (
    <Draggable nodeRef={nodeRef as RefObject<HTMLDivElement>} handle=".metricas-drag-handle">
      <Paper
        ref={nodeRef}
        elevation={8}
        sx={{
          position: 'absolute',
          bottom: 90,
          right: 16,
          zIndex: 24,
          width: expandido ? 300 : 'auto',
          minWidth: 130,
          bgcolor: 'rgba(15, 23, 42, 0.92)',
          color: '#f8fafc',
          border: '1px solid rgba(148, 163, 184, 0.24)',
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
          userSelect: 'none',
        }}
      >
        {/* ── Barra de título / arrastre ─────────────────── */}
        <Box
          className="metricas-drag-handle"
          onClick={() => setExpandido(e => !e)}
          sx={{
            cursor: 'grab',
            px: 1.5,
            py: 0.75,
            bgcolor: 'rgba(30, 41, 59, 0.9)',
            borderBottom: expandido ? '1px solid rgba(148,163,184,0.15)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {/* semáforo global */}
          <span style={{
            width: 9, height: 9, borderRadius: '50%',
            background: colorGlobal, display: 'inline-block', flexShrink: 0,
          }} />
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', flexGrow: 1 }}>
            Métricas
          </Typography>
          <Typography sx={{ fontSize: 11, color: '#64748b' }}>
            {expandido ? '▲' : '▼'}
          </Typography>
        </Box>

        {/* ── Contenido expandido ───────────────────────── */}
        {expandido && (
          <Box sx={{ px: 1.5, py: 1.25, display: 'flex', flexDirection: 'column', gap: 1.2 }}>

            {/* Ocupación flota */}
            <MetricaFila
              label="Flota"
              valor={`${floraRedondeada}%`}
              color={colorFlota}
              barra={floraRedondeada}
            />

            {/* Ocupación aeropuertos */}
            <MetricaFila
              label="Aeropuertos"
              valor={`${aeropRedondeado}%`}
              color={colorAeropuertos}
              barra={aeropRedondeado}
            />

            {/* Tiempo promedio de entrega */}
            <Box>
              <Typography sx={{ fontSize: 10, color: '#94a3b8', mb: 0.2 }}>
                Promedio entrega
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                {tiempoPromedioEntregaMs !== null ? formatDuracion(tiempoPromedioEntregaMs) : '—'}
              </Typography>
            </Box>

            {/* Maletas pendientes */}
            <Box>
              <Typography sx={{ fontSize: 10, color: '#94a3b8', mb: 0.2 }}>
                Pendientes
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                {maletasPendientes.toLocaleString('es-PE')} maletas
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>
    </Draggable>
  );
}

function MetricaFila({ label, valor, color, barra }: {
  label: string;
  valor: string;
  color: string;
  barra: number;
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.3 }}>
        <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{valor}</Typography>
      </Box>
      {/* barra de progreso */}
      <Box sx={{ height: 4, bgcolor: 'rgba(148,163,184,0.15)', borderRadius: 99 }}>
        <Box sx={{
          height: '100%',
          width: `${barra}%`,
          bgcolor: color,
          borderRadius: 99,
          transition: 'width 0.4s ease',
        }} />
      </Box>
    </Box>
  );
}
