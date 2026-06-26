import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { INIT_WEB_SOCKET_URL } from './constants';
import { EventoBatch } from '@/app/shared/types/Evento';

class SimulacionWebSocket {
  private client: Client | null = null;

  conectar(topic: string, onMessage: (lote: EventoBatch) => void, onSuccess: () => void) {
    const socket = new SockJS(INIT_WEB_SOCKET_URL);
    this.client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,

      onConnect: () => {
        console.log('2. Conectado al WebSocket correctamente.');
        console.log(`[FRONT-SIM-TIME] ${new Date().toISOString()} WebSocket conectado`);

        this.client?.subscribe(topic, (message) => {
          if (message.body) {
            const lote = JSON.parse(message.body);
            onMessage(lote);
          }
        });
        console.log(`[FRONT-SIM-TIME] ${new Date().toISOString()} suscrito a topic topic=${topic}`);

        onSuccess();
      },

      onStompError: (frame) => {
        console.error('ERROR STOMP:', frame.headers['message']);
      },

      onWebSocketError: (error) => {
        console.error('ERROR WEBSOCKET:', error);
      }
    });

    console.log('1. Conectando al WebSocket...');
    console.log(`[FRONT-SIM-TIME] ${new Date().toISOString()} conectando WebSocket url=${INIT_WEB_SOCKET_URL}`);
    this.client.activate();
  }

  desconectar() {
    if (this.client) {
      this.client.deactivate();
      this.client = null;
      console.log('WebSocket desconectado.');
    }
  }
}

export const simulacionWS = new SimulacionWebSocket();
