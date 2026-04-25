import { DI } from 'aurelia';
import { WebSocketRealtimeTransport } from './websocket-transport';
import type {
  RealtimeChannelHandler,
  RealtimeConfigurationOptions,
  RealtimeDispose,
  RealtimeEnvelope,
  RealtimeMessageHandler,
  RealtimeStatus,
  RealtimeStatusHandler,
  RealtimeTransport,
  RealtimeTransportEvent,
} from './types';

const defaultOptions: Required<RealtimeConfigurationOptions> = {
  url: '',
  protocols: [],
  autoConnect: false,
  queueWhileDisconnected: true,
  reconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  transportFactory: (options) => new WebSocketRealtimeTransport(options),
};

export class RealtimeService {
  public options: Required<RealtimeConfigurationOptions> = { ...defaultOptions };
  public status: RealtimeStatus = 'idle';

  private transport: RealtimeTransport | null = null;
  private transportSubscription: RealtimeDispose | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private outboundQueue: RealtimeEnvelope[] = [];
  private channels = new Map<string, Set<RealtimeChannelHandler>>();
  private statusListeners = new Set<RealtimeStatusHandler>();
  private messageListeners = new Set<RealtimeMessageHandler>();

  public configure(options: RealtimeConfigurationOptions = {}): void {
    this.options = {
      ...defaultOptions,
      ...options,
    };
    if (this.options.autoConnect) {
      void this.connect();
    }
  }

  public async connect(): Promise<void> {
    if (this.status === 'open' || this.status === 'connecting') return;
    this.setStatus('connecting');
    this.transport = this.options.transportFactory({
      url: this.options.url,
      protocols: this.options.protocols,
    });
    this.transportSubscription = this.transport.subscribe((event) => void this.handleTransportEvent(event));
    await this.transport.connect();
  }

  public async disconnect(): Promise<void> {
    this.clearReconnect();
    this.reconnectAttempts = 0;
    await this.transport?.disconnect();
    this.transportSubscription?.dispose();
    this.transportSubscription = null;
    this.transport = null;
    this.setStatus('closed');
  }

  public async publish<TPayload = unknown>(
    channel: string,
    type: string,
    payload?: TPayload,
    meta?: Record<string, unknown>
  ): Promise<RealtimeEnvelope<TPayload>> {
    const envelope: RealtimeEnvelope<TPayload> = {
      id: createId(),
      channel,
      type,
      payload,
      meta,
    };
    await this.send(envelope);
    return envelope;
  }

  public async send(envelope: RealtimeEnvelope): Promise<void> {
    if (this.status !== 'open' || !this.transport) {
      if (!this.options.queueWhileDisconnected) {
        throw new Error('Realtime transport is not open.');
      }
      this.outboundQueue.push(envelope);
      return;
    }

    await this.transport.send(JSON.stringify(envelope));
  }

  public subscribe<TPayload = unknown>(channel: string, handler: RealtimeChannelHandler<TPayload>): RealtimeDispose {
    let handlers = this.channels.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.channels.set(channel, handlers);
    }
    handlers.add(handler as RealtimeChannelHandler);

    return {
      dispose: () => {
        handlers?.delete(handler as RealtimeChannelHandler);
      },
    };
  }

  public onMessage(handler: RealtimeMessageHandler): RealtimeDispose {
    this.messageListeners.add(handler);
    return {
      dispose: () => {
        this.messageListeners.delete(handler);
      },
    };
  }

  public onStatus(handler: RealtimeStatusHandler): RealtimeDispose {
    this.statusListeners.add(handler);
    return {
      dispose: () => {
        this.statusListeners.delete(handler);
      },
    };
  }

  public getQueuedMessages(): RealtimeEnvelope[] {
    return [...this.outboundQueue];
  }

  private async handleTransportEvent(event: RealtimeTransportEvent): Promise<void> {
    if (event.type === 'open') {
      this.reconnectAttempts = 0;
      this.setStatus('open');
      await this.flushQueue();
      return;
    }

    if (event.type === 'message') {
      this.dispatchMessage(parseMessage(event.data));
      return;
    }

    if (event.type === 'error') {
      this.setStatus('error');
      return;
    }

    this.setStatus('closed');
    if (this.options.reconnect && event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private async flushQueue(): Promise<void> {
    const pending = [...this.outboundQueue];
    this.outboundQueue = [];
    for (const envelope of pending) {
      await this.send(envelope);
    }
  }

  private dispatchMessage(message: RealtimeEnvelope): void {
    for (const listener of this.messageListeners) {
      listener(message);
    }

    for (const handler of this.channels.get(message.channel) ?? []) {
      handler(message);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts || this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, this.options.reconnectDelay);
  }

  private clearReconnect(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private setStatus(status: RealtimeStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}

export const IRealtime = DI.createInterface<IRealtime>('IRealtime', (x) => x.singleton(RealtimeService));
export interface IRealtime extends RealtimeService {}

function parseMessage(data: string | RealtimeEnvelope): RealtimeEnvelope {
  if (typeof data !== 'string') return data;
  const parsed = JSON.parse(data) as RealtimeEnvelope;
  if (!parsed.channel || !parsed.type) {
    throw new Error('Realtime messages must include channel and type.');
  }
  return parsed;
}

function createId(): string {
  return `rt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
