import { DI } from 'aurelia';

export const IFroalaConfig = DI.createInterface<IFroalaConfig>('IFroalaConfig', x => x.singleton(Config));
export interface IFroalaConfig extends Config {}

export class Config {
  _config;

  constructor() {
    this._config = {};
  }

  get(key) {
    return this._config[key];
  }

  options(obj = {}) {
    if (Object.keys(obj).length) {
      Object.assign(this._config, obj);
    }
    else {
      return this._config;
    }
  }

  set(key, value) {
    this._config[key] = value;
    return this._config[key];
  }
}