'use client';

import { useEffect, useState, useRef } from 'react';
import { SimulacionService } from '@/app/services/simulation.service';
import { simulacionWS } from '@/app/services/config/webSocket';
import { Aeropuerto } from '@/app/shared/types/Aeropuerto';
import { MapaSimulacion } from './components/mapa-simulacion';

interface Props {
  id: string;
  topic: string;
  aeropuertosIniciales: Aeropuerto[];
}

export function SimulacionCliente({ id, topic, aeropuertosIniciales }: Props) {
  const [conectado, setConectado] = useState(false);
  const arrancadoRef = useRef(false);
  
  // Referencias para llevar la cuenta en consola sin re-renderizar
  const totalLotesRef = useRef(0);
  const totalEventosRef = useRef(0);

  useEffect(() => {
    if (!topic || !id) return;

    const iniciar = async () => {
      simulacionWS.conectar(
        topic, 
        (lote) => {        
          totalLotesRef.current++;
          totalEventosRef.current += lote.cantidadEventos || 0;

          console.log("\n==============================");
          console.log("LOTE RECIBIDO #" + totalLotesRef.current);
          console.log("numeroLote backend:", lote.numeroLote);
          console.log("Ventana:", lote.ventanaInicio + " → " + lote.ventanaFin);
          console.log("Cantidad eventos del lote:", lote.cantidadEventos);
          console.log("Total eventos acumulados:", totalEventosRef.current);
          console.log("==============================");

          if (!Array.isArray(lote.eventos)) {
            console.log("El lote no trae eventos[]:", lote);
            return;
          }

          lote.eventos.forEach((evento: any, index: number) => {
            console.log(`\nEvento ${index + 1} del lote`);
            console.log("Tipo:", evento.tipo);

            if (evento.tipo === "AEROPUERTO_ACTUALIZADO") {
              console.log("Aeropuerto:", evento.codigoAeropuerto);
              console.log("Maletas:", `${evento.maletasActuales}/${evento.capacidadAlmacen}`);
              console.log("Estado:", evento.estado);
              console.log("Ocupación:", evento.porcentajeOcupacion);
            } else if (evento.tipo === "VUELO_DESPEGA" || evento.tipo === "VUELO_ATERRIZA") {
              console.log("Vuelo:", evento.codigoVuelo);
              console.log("Ruta:", `${evento.origenIata} → ${evento.destinoIata}`);
              console.log("Maletas:", evento.cantidadMaletas);
              console.log("Hora salida local:", evento.horaSalidaLocal || evento.horaSalida);
              console.log("Hora llegada local:", evento.horaLlegadaLocal || evento.horaLlegada);
            } else {
              console.log(evento);
            }
          });
        }, 
        async () => {
          if (!arrancadoRef.current) {
            arrancadoRef.current = true;
            console.log("✅ Suscrito al canal. Llamando a iniciarSimulacion...");
            await SimulacionService.iniciar(id);
            setConectado(true);
          }
        }
      );
    };

    iniciar();

    return () => {
      simulacionWS.desconectar();
      arrancadoRef.current = false;
    };
  }, [id, topic]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1rem', background: '#1e293b', color: 'white' }}>
        <span>ID Simulación: {id}</span>
        <span style={{ marginLeft: '20px', color: conectado ? '#4ade80' : '#f87171' }}>
          ● {conectado ? 'En vivo' : 'Sincronizando...'}
        </span>
      </header>

      <div style={{ flex: 1 }}>
        <MapaSimulacion aeropuertosIniciales={aeropuertosIniciales} />
      </div>
    </div>
  );
}