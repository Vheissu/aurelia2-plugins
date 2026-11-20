import { bindable, BindingMode, customAttribute } from 'aurelia';
import { resolve } from '@aurelia/kernel';
import type { StorageBackend } from './types';
import { IStorage, AureliaStorage } from './storage';

@customAttribute({ name: 'persist', defaultProperty: 'key' })
export class PersistCustomAttribute {
  @bindable public key: string | null = null;
  @bindable({ mode: BindingMode.twoWay }) public value: unknown = undefined;
  @bindable public storage: StorageBackend | undefined = undefined;
  @bindable public ttl: number | undefined = undefined;
  @bindable public delay: number = 0;

  private readonly store: AureliaStorage;
  private hydrating = false;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor() {
    this.store = resolve(IStorage) as AureliaStorage;
  }

  public async binding(): Promise<void> {
    if (!this.key) return;

    this.hydrating = true;
    try {
      const stored = await this.store.get(this.key, { storage: this.storage });
      if (stored !== null && stored !== undefined) {
        this.value = stored;
      }
    } finally {
      this.hydrating = false;
    }
  }

  public valueChanged(newValue: unknown): void {
    const key = this.key;
    if (this.hydrating || !key) return;

    const options = { storage: this.storage, ttl: this.ttl };
    this.clearPendingWrite();
    if (this.delay > 0) {
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        void this.store.set(key, newValue, options);
      }, this.delay);
      return;
    }

    void this.store.set(key, newValue, options);
  }

  public unbinding(): void {
    this.clearPendingWrite();
  }

  private clearPendingWrite(): void {
    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }
}
