// Lightweight WebSocket client with reconnect and message dispatch
import { WEBSOCKET_CONFIG } from '@/config/config';

type MessageHandler = (msg: any) => void;

class WSClient {
  private url: string;
  private socket: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private attempts = 0;
  private maxAttempts = WEBSOCKET_CONFIG.RECONNECT_ATTEMPTS;

  constructor(url?: string) {
    this.url = url || WEBSOCKET_CONFIG.URL;
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;

    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      this.attempts = 0;
      // Optionally send a hello/subscribe message
      try { this.socket?.send(JSON.stringify({ type: 'subscribe', channel: 'updates' })); } catch(e) {}
    };

    this.socket.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        this.handlers.forEach(h => h(payload));
      } catch (e) {
        // ignore parse errors
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      // let onclose handle reconnect
      try { this.socket?.close(); } catch(e) {}
    };
  }

  scheduleReconnect() {
    if (this.attempts >= this.maxAttempts) return;
    this.attempts += 1;
    setTimeout(() => this.connect(), WEBSOCKET_CONFIG.RECONNECT_INTERVAL * this.attempts);
  }

  subscribe(handler: MessageHandler) {
    this.handlers.add(handler);
    // Ensure connection is started
    this.connect();
    return () => this.handlers.delete(handler);
  }

  close() {
    try { this.socket?.close(); } catch(e) {}
    this.socket = null;
    this.handlers.clear();
  }
}

const wsClient = new WSClient();
export default wsClient;
