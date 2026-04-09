import { DI } from 'aurelia';

export interface FroalaOptions {
  iframe?: boolean;
  events?: Record<string, (...args: unknown[]) => unknown>;
  [key: string]: unknown;
}

export const IFroalaConfig = DI.createInterface<IFroalaConfig>('IFroalaConfig', x => x.singleton(Config));
export interface IFroalaConfig extends Config {}

export class Config {
  private _config: FroalaOptions;

  constructor() {
    this._config = {};
  }

  get(key: string): unknown {
    return this._config[key];
  }

  options(): FroalaOptions;
  options(obj: FroalaOptions): void;
  options(obj?: FroalaOptions): FroalaOptions | void {
    if (obj != null && Object.keys(obj).length) {
      Object.assign(this._config, obj);
    }
    else {
      return this._config;
    }
  }

  set(key: string, value: unknown): unknown {
    this._config[key] = value;
    return this._config[key];
  }
}