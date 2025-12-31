import { bindable, BindingMode, customAttribute } from 'aurelia';
import { resolve } from '@aurelia/kernel';
import type { StorageBackend } from './types';
import { IStorage, AureliaStorage } from './storage';

@customAttribute('persist')
export class PersistCustomAttribute {
  @bindable({ primary: true }) public key: string | null = null;
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
    const stored = await this.store.get(this.key, { storage: this.storage });
    if (stored !== null && stored !== undefined) {
      this.value = stored;
    }
    this.hydrating = false;
  }

  public valueChanged(newValue: unknown): void {
    if (this.hydrating || !this.key) return;

    if (this.delay > 0) {
      if (this.pendingTimer) {
        clearTimeout(this.pendingTimer);
      }
      this.pendingTimer = setTimeout(() => {
        this.persistValue(newValue);
      }, this.delay);
      return;
    }

    void this.persistValue(newValue);
  }

  public detached(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  private async persistValue(value: unknown): Promise<void> {
    if (!this.key) return;
    await this.store.set(this.key, value, { storage: this.storage, ttl: this.ttl });
  }
}
