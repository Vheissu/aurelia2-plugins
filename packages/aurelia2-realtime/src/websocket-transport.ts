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
        if (this.socket !== socket) return;
        this.status = 'open';
        resolve();
        this.emit({ type: 'open' });
      });
      socket.addEventListener('message', (event) => {
        if (this.socket === socket) this.emit({ type: 'message', data: event.data as string });
      });
      socket.addEventListener('close', (event) => {
        reject(new Error(`Realtime WebSocket closed before opening (${event.code}).`));
        if (this.socket !== socket) return;
        this.socket = null;
        this.status = 'closed';
        this.emit({ type: 'close', code: event.code, reason: event.reason });
      });
      socket.addEventListener('error', (event) => {
        reject(event);
        if (this.socket !== socket) return;
        this.status = 'error';
        this.emit({ type: 'error', error: event });
      });
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
