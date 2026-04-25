import type { NetworkStatusProvider, OfflineSyncDispose } from './types';

export class BrowserNetworkStatusProvider implements NetworkStatusProvider {
  public isOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  public subscribe(listener: (online: boolean) => void): OfflineSyncDispose {
    const online = () => listener(true);
    const offline = () => listener(false);

    globalThis.addEventListener?.('online', online);
    globalThis.addEventListener?.('offline', offline);

    return {
      dispose: () => {
        globalThis.removeEventListener?.('online', online);
        globalThis.removeEventListener?.('offline', offline);
      },
    };
  }
}

export class ManualNetworkStatusProvider implements NetworkStatusProvider {
  private online: boolean;
  private listeners = new Set<(online: boolean) => void>();

  public constructor(initialOnline = true) {
    this.online = initialOnline;
  }

  public isOnline(): boolean {
    return this.online;
  }

  public setOnline(online: boolean): void {
    this.online = online;
    for (const listener of this.listeners) {
      listener(online);
    }
  }

  public subscribe(listener: (online: boolean) => void): OfflineSyncDispose {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }
}
