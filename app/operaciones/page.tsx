'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Button, Typography } from '@mui/material'
import { getUsuarioGuardado, UsuarioGuardado } from '@/app/shared/hooks/LoginModal'
import { SimulacionService } from '@/app/services/simulation.service'

export default function OperacionesPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<UsuarioGuardado | null>(null)
  const [iniciando, setIniciando] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <Box sx={{ maxWidth: 600, mx: 'auto', py: 8, px: 2, textAlign: 'center' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
        Visualizador de Operaciones
      </Typography>
      <Typography variant="body1" sx={{ color: '#475569', mb: 1 }}>
        Inicia el mapa de operaciones en tiempo real. Solo una instancia activa permitida.
      </Typography>
      <Typography variant="body2" sx={{ color: '#64748b', mb: 4 }}>
        {usuario.nombre} — {usuario.rol}
      </Typography>

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
    </Box>
  )
}
