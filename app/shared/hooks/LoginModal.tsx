'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  TextField,
  Typography,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';

// ─── Credenciales de demo ─────────────────────────────────────────────────────
// Mientras el backend no tenga /api/auth, el login valida contra este objeto.
// Para conectar al backend real: reemplaza intentarLogin/intentarRegistro
// por llamadas a axiosApi.post('/auth/login', ...) y nada más cambia.
const DEMO_USERS: Record<string, string> = {
  'admin@bagcontrol.com': 'admin123',
  'demo@bagcontrol.com':  'demo123',
};

// ─── Sesión en localStorage (sin tocar axios ni WebSocket) ───────────────────
const SESSION_KEY = 'bagcontrol_user';

export function getUsuarioGuardado(): { email: string; nombre: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function guardarSesion(email: string, nombre: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email, nombre }));
}

export function cerrarSesion() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Lógica de auth (demo) ────────────────────────────────────────────────────
async function intentarLogin(email: string, password: string) {
  // TODO: swap por axiosApi.post('/auth/login', { email, password })
  await new Promise((r) => setTimeout(r, 400));
  const emailN = email.toLowerCase().trim();
  const passGuardada = DEMO_USERS[emailN];
  if (passGuardada === undefined) throw new Error('No existe una cuenta con ese correo.');
  if (passGuardada !== password)   throw new Error('Contraseña incorrecta.');
  return { email: emailN, nombre: emailN.split('@')[0] };
}

async function intentarRegistro(email: string, password: string, nombre: string) {
  // TODO: swap por axiosApi.post('/auth/register', { email, password, nombre })
  await new Promise((r) => setTimeout(r, 400));
  const emailN = email.toLowerCase().trim();
  if (DEMO_USERS[emailN] !== undefined) throw new Error('Ya existe una cuenta con ese correo.');
  DEMO_USERS[emailN] = password;
  return { email: emailN, nombre: nombre.trim() };
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function LoginModal({
  abierto,
  onExito,
}: {
  abierto: boolean;
  onExito: (usuario: { email: string; nombre: string }) => void;
}) {
  const [tab, setTab]           = useState<0 | 1>(0);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre]     = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const limpiar = () => setError('');

  const handleSubmit = async () => {
    setError('');
    const e = email.trim();
    const p = password.trim();
    const n = nombre.trim();

    if (!e || !p || (tab === 1 && !n)) { setError('Completá todos los campos.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setError('Ingresá un correo válido.'); return; }
    if (p.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }

    setLoading(true);
    try {
      const usuario = tab === 0
        ? await intentarLogin(e, p)
        : await intentarRegistro(e, p, n);
      guardarSesion(usuario.email, usuario.nombre);
      onExito(usuario);
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={abierto}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          bgcolor: '#1e293b',
          color: '#f8fafc',
          borderRadius: 3,
          border: '1px solid rgba(148,163,184,0.2)',
        },
      }}
    >
      <DialogContent sx={{ p: 4 }}>
        {/* Título */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={800} sx={{ color: '#38bdf8' }}>
            BagControl
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            Sistema de gestión logística de equipajes
          </Typography>
        </Box>

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => { setTab(v); limpiar(); }}
          variant="fullWidth"
          sx={{
            mb: 3,
            '& .MuiTab-root':    { color: '#94a3b8', fontWeight: 600 },
            '& .Mui-selected':   { color: '#38bdf8' },
            '& .MuiTabs-indicator': { backgroundColor: '#38bdf8' },
          }}
        >
          <Tab label="Iniciar sesión" />
          <Tab label="Registrarse" />
        </Tabs>

        {/* Campos */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tab === 1 && (
            <TextField
              label="Nombre"
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); limpiar(); }}
              fullWidth size="small"
              InputLabelProps={{ sx: { color: '#94a3b8' } }}
              InputProps={{ sx: { color: '#f8fafc', bgcolor: '#0f172a', borderRadius: 1 } }}
            />
          )}
          <TextField
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); limpiar(); }}
            fullWidth size="small"
            InputLabelProps={{ sx: { color: '#94a3b8' } }}
            InputProps={{ sx: { color: '#f8fafc', bgcolor: '#0f172a', borderRadius: 1 } }}
          />
          <TextField
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); limpiar(); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            fullWidth size="small"
            InputLabelProps={{ sx: { color: '#94a3b8' } }}
            InputProps={{ sx: { color: '#f8fafc', bgcolor: '#0f172a', borderRadius: 1 } }}
          />

          {error && (
            <Alert severity="error" sx={{ py: 0.5, fontSize: 13 }}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            fullWidth
            sx={{
              mt: 0.5,
              bgcolor: '#38bdf8',
              color: '#0f172a',
              fontWeight: 800,
              '&:hover': { bgcolor: '#0ea5e9' },
              '&:disabled': { bgcolor: '#334155', color: '#64748b' },
            }}
          >
            {loading
              ? <CircularProgress size={20} sx={{ color: '#64748b' }} />
              : tab === 0 ? 'Entrar' : 'Crear cuenta'}
          </Button>

          <Typography variant="caption" sx={{ color: '#475569', textAlign: 'center' }}>
            Demo · admin@bagcontrol.com / admin123
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
