import { DI, Registration, type IContainer, type IRegistry } from '@aurelia/kernel';
import { IWindow } from '@aurelia/runtime-html';
import type { IAuthConfigOptions } from '../src/configuration';
import { IAuthOptions } from '../src/configuration';
import { createDefaultAuthConfigOptions, mergeAuthConfigOptions } from '../src/base-config';
import { IStorage, ITransactionStorage, type IStorage as StorageContract } from '../src/storage';

export class TestStorage implements StorageContract {
  public readonly values = new Map<string, string>();

  public get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public set(key: string, value: string): void {
    this.values.set(key, value);
  }

  public remove(key: string): void {
    this.values.delete(key);
  }

  public clear(keys: readonly string[] = []): void {
    for (const key of keys) this.values.delete(key);
  }
}

export function createUnitContainer(
  overrides: Partial<IAuthConfigOptions> = {},
  registrations: readonly IRegistry[] = [],
  browserWindow: Window = window,
): { container: IContainer; storage: TestStorage; transactions: TestStorage } {
  const container = DI.createContainer();
  const storage = new TestStorage();
  const transactions = new TestStorage();
  const options = mergeAuthConfigOptions(createDefaultAuthConfigOptions(browserWindow), {
    storage: 'memory',
    transactionStorage: 'memory',
    ...overrides,
  });
  container.register(
    Registration.instance(IWindow, browserWindow),
    Registration.instance(IAuthOptions, options),
    Registration.instance(IStorage, storage),
    Registration.instance(ITransactionStorage, transactions),
    ...registrations,
  );
  return { container, storage, transactions };
}

export function createJwt(payload: Readonly<Record<string, unknown>>): string {
  return [
    encode({ alg: 'none', typ: 'JWT' }),
    encode(payload),
    'signature',
  ].join('.');
}

function encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
