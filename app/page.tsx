'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Box, Card, CardActionArea, CardContent,
  CardMedia, Container, Typography, Button,
} from '@mui/material';
import { LoginModal, getUsuarioGuardado, cerrarSesion, UsuarioGuardado } from '@/app/shared/hooks/LoginModal';

export default function Home() {
  const [usuario, setUsuario] = useState<UsuarioGuardado | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  useEffect(() => {
    const guardado = getUsuarioGuardado();
    if (guardado) {
      setUsuario(guardado);
    } else {
      setModalAbierto(true);
    }
  }, []);

  const handleExito = (u: UsuarioGuardado) => {
    setUsuario(u);
    setModalAbierto(false);
  };

  const handleCerrarSesion = () => {
    cerrarSesion();
    setUsuario(null);
    setModalAbierto(true);
  };

  const cards: { href: string; title: string; description: string; image: string }[] = [];

  if (usuario) {
    if (usuario.rol === 'REGISTRADOR' || usuario.rol === 'ADMINISTRADOR') {
      cards.push({
        href: '/registro',
        title: 'Registro de equipaje',
        description: 'Registrar maletas en operaciones dia a dia.',
        image: 'https://placehold.co/800x480?text=Registro+Equipaje',
      });
    }

    if (usuario.rol === 'LOGISTICA' || usuario.rol === 'ADMINISTRADOR') {
      cards.push({
        href: '/operaciones',
        title: 'Operacion dia a dia',
        description: 'Iniciar y monitorear el mapa de operaciones en tiempo real.',
        image: 'https://placehold.co/800x480?text=Operaciones',
      });
    }

    if (usuario.rol === 'ADMINISTRADOR') {
      cards.push({
        href: '/simulation?tipo=simulacion',
        title: 'Simulacion',
        description: 'Configurar simulaciones de 5 dias o hasta colapso operativo.',
        image: 'https://placehold.co/800x480?text=Simulacion',
      });
    }
  }

  const cols = cards.length;

  return (
    <>
      <LoginModal abierto={modalAbierto} onExito={handleExito} />

      <Container maxWidth={cols === 1 ? "sm" : cols === 2 ? "md" : "lg"} sx={{ py: { xs: 4, md: 8 } }}>
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography component="h1" variant="h4" gutterBottom>
              Bag Control
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Selecciona una seccion para entrar al sistema.
            </Typography>
          </Box>

          {usuario && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {usuario.nombre} — {usuario.rol}
                {usuario.aeropuerto ? ` · ${usuario.aeropuerto}` : ''}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={handleCerrarSesion}
                sx={{ fontSize: 12, textTransform: 'none', borderColor: 'rgba(148,163,184,0.4)' }}
              >
                Cerrar sesion
              </Button>
            </Box>
          )}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: {
              xs: '1fr',
              md: cols === 1 ? '1fr' : cols === 2 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
            },
            maxWidth: cols === 1 ? 400 : undefined,
            margin: cols === 1 ? '0 auto' : undefined,
          }}
        >
          {cards.map((card) => (
            <Card key={card.href} elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <CardActionArea component={Link} href={card.href} sx={{ height: '100%' }}>
                <CardMedia
                  component="img"
                  image={card.image}
                  alt={card.title}
                  sx={{ aspectRatio: '5 / 3', objectFit: 'cover' }}
                />
                <CardContent>
                  <Typography variant="h6" component="h2" gutterBottom>
                    {card.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {card.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Container>
    </>
  );
}
