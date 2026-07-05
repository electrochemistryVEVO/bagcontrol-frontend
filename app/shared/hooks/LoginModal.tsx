'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { AuthService } from '@/app/services/auth.service';

const SESSION_KEY = 'bagcontrol_user';

export type UsuarioGuardado = { email: string; nombre: string; rol: string; aeropuerto: string };

export function getUsuarioGuardado(): UsuarioGuardado | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      email: parsed.email || '',
      nombre: parsed.nombre || '',
      rol: parsed.rol || '',
      aeropuerto: parsed.aeropuerto || '',
    };
  } catch {
    return null;
  }
}

export function cerrarSesion() {
  AuthService.logout();
}

async function intentarLogin(email: string, password: string): Promise<UsuarioGuardado> {
  const usuario = await AuthService.login(email, password);
  return { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, aeropuerto: usuario.aeropuerto };
}

async function intentarRegistro(email: string, password: string, nombre: string): Promise<UsuarioGuardado> {
  const usuario = await AuthService.register(email, password, nombre);
  return { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, aeropuerto: usuario.aeropuerto };
}

export function LoginModal({
  abierto,
  onExito,
}: {
  abierto: boolean;
  onExito: (usuario: UsuarioGuardado) => void;
}) {
  const [tab, setTab] = useState<0 | 1>(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const limpiar = () => setError('');

  const handleSubmit = async () => {
    setError('');
    const e = email.trim();
    const p = password.trim();
    const n = nombre.trim();

    if (!e || !p || (tab === 1 && !n)) {
      setError('Completa todos los campos.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError('Ingresa un correo valido.');
      return;
    }
    if (tab === 1 && p.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const usuario = tab === 0
        ? await intentarLogin(e, p)
        : await intentarRegistro(e, p, n);
      onExito(usuario);
    } catch (err: any) {
      if (tab === 0 && err?.response?.status === 401) {
        setError('Contrasena incorrecta.');
      } else {
        const mensaje = err?.response?.data?.message || err?.response?.data?.error || err?.message;
        setError(mensaje ?? 'Error inesperado. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={abierto}
      maxWidth="xs"
      fullWidth
      onKeyDown={(event) => { if (event.key === 'Escape') event.preventDefault(); }}
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#1e293b',
            color: '#f8fafc',
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.2)',
          },
        },
      }}
    >
      <DialogContent sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ color: '#38bdf8', fontWeight: 800 }}>
            BagControl
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            Sistema de gestion logistica de equipajes
          </Typography>
        </Box>

        <Tabs
          value={tab}
          onChange={(_, v) => { setTab(v); limpiar(); }}
          variant="fullWidth"
          sx={{
            mb: 3,
            '& .MuiTab-root': { color: '#94a3b8', fontWeight: 600 },
            '& .Mui-selected': { color: '#38bdf8' },
            '& .MuiTabs-indicator': { backgroundColor: '#38bdf8' },
          }}
        >
          <Tab label="Iniciar sesion" />
          <Tab label="Registrarse" />
        </Tabs>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tab === 1 && (
            <TextField
              label="Nombre"
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); limpiar(); }}
              fullWidth
              size="small"
              slotProps={fieldSlotProps}
            />
          )}
          <TextField
            label="Correo electronico"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); limpiar(); }}
            fullWidth
            size="small"
            slotProps={fieldSlotProps}
          />
          <TextField
            label="Contrasena"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); limpiar(); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            fullWidth
            size="small"
            slotProps={fieldSlotProps}
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
            Demo: admin@bagcontrol.com / admin123
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

const fieldSlotProps = {
  input: {
    sx: {
      color: '#f8fafc',
      bgcolor: '#0f172a',
      borderRadius: 1,
    },
  },
  inputLabel: {
    sx: {
      color: '#94a3b8',
    },
  },
};
