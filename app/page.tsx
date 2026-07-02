'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Box, Card, CardActionArea, CardContent,
  CardMedia, Container, Typography, Button,
} from '@mui/material';
import { LoginModal, getUsuarioGuardado, cerrarSesion } from '@/app/shared/hooks/LoginModal';

const entryCards = [
  {
    href: '/simulation?tipo=operacion',
    title: 'Operacion dia a dia',
    description: 'Mapa operativo compartido para registrar envios mientras la operacion esta activa.',
    image: 'https://placehold.co/800x480?text=Operacion+dia+a+dia',
  },
  {
    href: '/simulation?tipo=simulacion',
    title: 'Simulacion',
    description: 'Escenarios aislados de 5 dias o hasta el colapso, con gestion previa de entidades.',
    image: 'https://placehold.co/800x480?text=Simulacion',
  },
];

export default function Home() {
  const [usuario, setUsuario] = useState<{ email: string; nombre: string } | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  useEffect(() => {
    const guardado = getUsuarioGuardado();
    if (guardado) {
      setUsuario(guardado);
    } else {
      setModalAbierto(true);
    }
  }, []);

  const handleExito = (u: { email: string; nombre: string }) => {
    setUsuario(u);
    setModalAbierto(false);
  };

  const handleCerrarSesion = () => {
    cerrarSesion();
    setUsuario(null);
    setModalAbierto(true);
  };

  return (
    <>
      <LoginModal abierto={modalAbierto} onExito={handleExito} />

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography component="h1" variant="h4" gutterBottom>
              Bag Control
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Selecciona un flujo para entrar al sistema.
            </Typography>
          </Box>

          {usuario && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Hola, <strong>{usuario.nombre}</strong>
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
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {entryCards.map((card) => (
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
