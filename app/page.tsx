'use client'
import Link from "next/link";
import { Box, Card, CardActionArea, CardContent, CardMedia, Container, Typography } from "@mui/material";

const entryCards = [
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Vista general del estado operativo y métricas principales.",
    image: "https://placehold.co/800x480?text=Dashboard",
  },
  {
    href: "/simulation",
    title: "Simulation",
    description: "Acceso al panel de simulación para probar escenarios.",
    image: "https://placehold.co/800x480?text=Simulation",
  },
  {
    href: "/management",
    title: "Management",
    description: "Gestión de entidades, vuelos, envíos e incidencias.",
    image: "https://placehold.co/800x480?text=Management",
  },
];

export default function Home() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography component="h1" variant="h4" gutterBottom>
          Bag Control
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Selecciona una sección para entrar al sistema.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(3, minmax(0, 1fr))",
          },
        }}
      >
        {entryCards.map((card) => (
          <Card key={card.href} elevation={2} sx={{ borderRadius: 2, overflow: "hidden" }}>
            <CardActionArea component={Link} href={card.href} sx={{ height: "100%" }}>
              <CardMedia
                component="img"
                image={card.image}
                alt={card.title}
                sx={{ aspectRatio: "5 / 3", objectFit: "cover" }}
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
  );
}
