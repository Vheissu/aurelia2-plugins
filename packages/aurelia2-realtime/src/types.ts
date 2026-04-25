export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export interface RealtimeEnvelope<TPayload = unknown> {
  id?: string;
  channel: string;
  type: string;
  payload?: TPayload;
  meta?: Record<string, unknown>;
}

export type RealtimeTransportEvent =
  | { type: 'open' }
  | { type: 'close'; code?: number; reason?: string }
  | { type: 'error'; error: unknown }
  | { type: 'message'; data: string | RealtimeEnvelope };

export interface RealtimeDispose {
  dispose(): void;
}

export interface RealtimeTransport {
  readonly status: RealtimeStatus;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(data: string): Promise<void>;
  subscribe(listener: (event: RealtimeTransportEvent) => void): RealtimeDispose;
}

export interface RealtimeTransportOptions {
  url: string;
  protocols?: string | string[];
}

export type RealtimeTransportFactory = (options: RealtimeTransportOptions) => RealtimeTransport;
export type RealtimeChannelHandler<TPayload = unknown> = (message: RealtimeEnvelope<TPayload>) => void;
export type RealtimeStatusHandler = (status: RealtimeStatus) => void;
export type RealtimeMessageHandler = (message: RealtimeEnvelope) => void;

export interface RealtimeConfigurationOptions {
  url?: string;
  protocols?: string | string[];
  autoConnect?: boolean;
  queueWhileDisconnected?: boolean;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  transportFactory?: RealtimeTransportFactory;
}
