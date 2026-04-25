import type { RealtimeDispose, RealtimeStatus, RealtimeTransport, RealtimeTransportEvent, RealtimeTransportOptions } from './types';

export class WebSocketRealtimeTransport implements RealtimeTransport {
  public status: RealtimeStatus = 'idle';

  private socket: WebSocket | null = null;
  private listeners = new Set<(event: RealtimeTransportEvent) => void>();

  public constructor(private readonly options: RealtimeTransportOptions) {}

  public connect(): Promise<void> {
    if (!this.options.url) {
      return Promise.reject(new Error('Realtime url is required.'));
    }

    this.status = 'connecting';
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.options.url, this.options.protocols);
      this.socket = socket;

      socket.addEventListener('open', () => {
        this.status = 'open';
        this.emit({ type: 'open' });
        resolve();
      });
      socket.addEventListener('message', (event) => {
        this.emit({ type: 'message', data: event.data as string });
      });
      socket.addEventListener('close', (event) => {
        this.status = 'closed';
        this.emit({ type: 'close', code: event.code, reason: event.reason });
      });
      socket.addEventListener('error', (event) => {
        this.status = 'error';
        this.emit({ type: 'error', error: event });
        reject(event);
      }, { once: true });
    });
  }

  public async disconnect(): Promise<void> {
    if (!this.socket) return;
    this.socket.close();
  }

  public async send(data: string): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Realtime transport is not open.');
    }
    this.socket.send(data);
  }

  public subscribe(listener: (event: RealtimeTransportEvent) => void): RealtimeDispose {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  private emit(event: RealtimeTransportEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
