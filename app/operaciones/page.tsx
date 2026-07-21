'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Button, Typography } from '@mui/material'
import { getUsuarioGuardado, UsuarioGuardado } from '@/app/shared/hooks/LoginModal'
import { SimulacionService } from '@/app/services/simulation.service'
import { GestionAeropuertos } from '@/app/management/components/GestionAeropuertos'
import { GestionVuelos } from '@/app/management/components/GestionVuelos'

type SeccionPreparacion = 'inicio' | 'vuelos' | 'aeropuertos'

export default function OperacionesPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<UsuarioGuardado | null>(null)
  const [iniciando, setIniciando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seccion, setSeccion] = useState<SeccionPreparacion>('inicio')

  useEffect(() => {
    const u = getUsuarioGuardado()
    if (!u) {
      router.replace('/')
      return
    }
    if (u.rol !== 'LOGISTICA' && u.rol !== 'ADMINISTRADOR') {
      router.replace('/')
      return
    }
    setUsuario(u)
  }, [router])

  if (!usuario) return null

  const handleIniciar = async () => {
    setIniciando(true)
    setError(null)
    try {
      const { data } = await SimulacionService.iniciarOperacionDia()
      router.push(`/simulation/${data.simulacionId}?topic=${encodeURIComponent(data.websocketTopic)}&k=1&modo=0&tipo=operacion`)
    } catch {
      setError('Error al iniciar la operacion dia a dia. Verifica que el servidor este activo.')
      setIniciando(false)
    }
  }

  return (
    <Box sx={{ maxWidth: seccion === 'inicio' ? 720 : 1280, mx: 'auto', py: 5, px: 3 }}>
      <Box sx={{ textAlign: seccion === 'inicio' ? 'center' : 'left', mb: 3 }}>
        <Typography variant="overline" sx={{ color: '#0f766e', fontWeight: 800, letterSpacing: 1 }}>
          OPERACION DIA A DIA
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
          {seccion === 'inicio' ? 'Visualizador de Operaciones' : 'Preparación de entidades'}
        </Typography>
        <Typography variant="body1" sx={{ color: '#475569', mb: 1 }}>
          {seccion === 'inicio'
            ? 'Inicia el mapa de operaciones en tiempo real. Solo una instancia activa permitida.'
            : 'Carga los planes adicionales y ajusta capacidades antes de iniciar la operación.'}
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b' }}>
          {usuario.nombre} — {usuario.rol}
        </Typography>
      </Box>

      {usuario.rol === 'ADMINISTRADOR' && (
        <Box sx={{ display: 'flex', gap: 0.5, mb: 4, borderBottom: '1px solid #e2e8f0' }}>
          {([
            ['inicio', 'Inicio'],
            ['vuelos', 'Planes de vuelo'],
            ['aeropuertos', 'Aeropuertos'],
          ] as const).map(([id, etiqueta]) => (
            <Button key={id} onClick={() => setSeccion(id)} sx={{
              textTransform: 'none', fontWeight: 700, color: seccion === id ? '#0f766e' : '#64748b',
              borderBottom: seccion === id ? '2px solid #0f766e' : '2px solid transparent', borderRadius: 0,
            }}>
              {etiqueta}
            </Button>
          ))}
        </Box>
      )}

      {seccion === 'vuelos' && <GestionVuelos />}
      {seccion === 'aeropuertos' && <GestionAeropuertos />}
      {seccion === 'inicio' && <Box sx={{ textAlign: 'center' }}>

      {error && (
        <Box sx={{ mb: 3, p: 1.5, borderRadius: 1, bgcolor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </Box>
      )}

      <Button
        variant="contained"
        size="large"
        onClick={handleIniciar}
        disabled={iniciando}
        sx={{
          textTransform: 'none',
          fontWeight: 700,
          bgcolor: iniciando ? '#94a3b8' : '#16a34a',
          '&:hover': { bgcolor: iniciando ? '#94a3b8' : '#15803d' },
          px: 5, py: 1.5, borderRadius: 2,
        }}
      >
        {iniciando ? 'Iniciando operacion...' : 'Iniciar operacion dia a dia'}
      </Button>

      <Typography variant="body2" sx={{ color: '#94a3b8', mt: 3 }}>
        Los envios registrados desde la pantalla REG. MALETAS apareceran en el mapa en tiempo real.
      </Typography>
      </Box>}
    </Box>
  )
}
