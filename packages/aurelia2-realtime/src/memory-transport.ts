import type { RealtimeDispose, RealtimeEnvelope, RealtimeStatus, RealtimeTransport, RealtimeTransportEvent } from './types';

export class MemoryRealtimeTransport implements RealtimeTransport {
  public status: RealtimeStatus = 'idle';
  public sent: string[] = [];

  private listeners = new Set<(event: RealtimeTransportEvent) => void>();

  public async connect(): Promise<void> {
    this.status = 'open';
    this.emit({ type: 'open' });
  }

  public async disconnect(): Promise<void> {
    this.status = 'closed';
    this.emit({ type: 'close', code: 1000, reason: 'manual' });
  }

  public async send(data: string): Promise<void> {
    this.sent.push(data);
  }

  public subscribe(listener: (event: RealtimeTransportEvent) => void): RealtimeDispose {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  public push(message: RealtimeEnvelope | string): void {
    this.emit({ type: 'message', data: typeof message === 'string' ? message : JSON.stringify(message) });
  }

  public close(code = 1006, reason = 'closed'): void {
    this.status = 'closed';
    this.emit({ type: 'close', code, reason });
  }

  public fail(error: unknown): void {
    this.status = 'error';
    this.emit({ type: 'error', error });
  }

  private emit(event: RealtimeTransportEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
