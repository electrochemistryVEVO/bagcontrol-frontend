import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

class SimulacionWebSocket {
  private client: Client | null = null;

  conectar(topic: string, onMessage: (lote: any) => void, onSuccess: () => void) {
    const socket = new SockJS('http://localhost:8080/ws/simulacion'); //harcodeado

    this.client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      
      onConnect: () => {
        console.log('2. Conectado al WebSocket correctamente.');
        
        this.client?.subscribe(topic, (message) => {
          if (message.body) {
            const lote = JSON.parse(message.body);
            onMessage(lote);
          }
        });

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
    this.client.activate();
  }

  desconectar() {
    if (this.client && this.client.connected) {
      this.client.deactivate();
      console.log('WebSocket desconectado.');
    }
  }
}

export const simulacionWS = new SimulacionWebSocket();