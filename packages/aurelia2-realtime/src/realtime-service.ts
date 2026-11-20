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
  private connecting: Promise<void> | null = null;
  private connectionVersion = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private outboundQueue: { envelope: RealtimeEnvelope; data: string }[] = [];
  private drainingQueue = false;
  private channels = new Map<string, Set<RealtimeChannelHandler>>();
  private statusListeners = new Set<RealtimeStatusHandler>();
  private messageListeners = new Set<RealtimeMessageHandler>();

  public configure(options: RealtimeConfigurationOptions = {}): void {
    this.options = {
      ...defaultOptions,
      ...options,
    };
    if (this.options.autoConnect) {
      void this.connect().catch(() => {});
    }
  }

  public connect(): Promise<void> {
    if (this.connecting) return this.connecting;
    if (this.status === 'open') return Promise.resolve();

    this.clearReconnect();
    const version = ++this.connectionVersion;
    const connection = Promise.resolve().then(() => this.startConnection(version));
    this.connecting = connection;
    const clear = () => {
      if (this.connecting === connection) this.connecting = null;
    };
    void connection.then(clear, clear);
    this.setStatus('connecting');
    return connection;
  }

  public async disconnect(): Promise<void> {
    this.clearReconnect();
    this.reconnectAttempts = 0;
    this.connectionVersion += 1;
    this.connecting = null;
    const transport = this.releaseTransport();
    this.setStatus('closed');
    await transport?.disconnect();
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
      this.outboundQueue.push({ envelope, data: JSON.stringify(envelope) });
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
    return this.outboundQueue.map(({ envelope }) => envelope);
  }

  private async startConnection(version: number): Promise<void> {
    if (version !== this.connectionVersion) return;
    try {
      const previous = this.releaseTransport();
      if (previous && previous.status !== 'closed') await previous.disconnect();
      if (version !== this.connectionVersion) return;

      const transport = this.transport = this.options.transportFactory({
        url: this.options.url,
        protocols: this.options.protocols,
      });
      this.transportSubscription = transport.subscribe((event) => {
        if (version === this.connectionVersion) this.handleTransportEvent(event);
      });
      await transport.connect();
    } catch (error) {
      if (version === this.connectionVersion && this.status !== 'closed') {
        this.setStatus('error');
        if (this.options.reconnect) this.scheduleReconnect();
      }
      throw error;
    }
  }

  private releaseTransport(): RealtimeTransport | null {
    const transport = this.transport;
    this.transportSubscription?.dispose();
    this.transportSubscription = null;
    this.transport = null;
    return transport;
  }

  private handleTransportEvent(event: RealtimeTransportEvent): void {
    if (event.type === 'open') {
      this.setStatus('open');
      void this.flushQueue();
      return;
    }

    if (event.type === 'message') {
      const message = parseMessage(event.data);
      if (message) this.dispatchMessage(message);
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
    if (this.drainingQueue) return;
    this.drainingQueue = true;
    try {
      while (this.transport && this.status === 'open' && this.outboundQueue.length) {
        const version = this.connectionVersion;
        try {
          await this.transport.send(this.outboundQueue[0].data);
          this.outboundQueue.shift();
        } catch {
          if (version === this.connectionVersion && this.status === 'open') {
            this.setStatus('error');
            if (this.options.reconnect) this.scheduleReconnect();
          }
        }
      }
      if (this.status === 'open' && this.outboundQueue.length === 0) this.reconnectAttempts = 0;
    } finally {
      this.drainingQueue = false;
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
      void this.connect().catch(() => {});
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

function parseMessage(data: string | RealtimeEnvelope): RealtimeEnvelope | null {
  let parsed: RealtimeEnvelope;
  try {
    parsed = typeof data === 'string' ? JSON.parse(data) as RealtimeEnvelope : data;
  } catch {
    return null;
  }
  if (typeof parsed?.channel !== 'string' || !parsed.channel ||
      typeof parsed.type !== 'string' || !parsed.type) return null;
  return parsed;
}

function createId(): string {
  return `rt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
