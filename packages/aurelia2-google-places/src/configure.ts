import { DI } from '@aurelia/kernel';
import type { LoaderOptions } from '@googlemaps/js-api-loader';

export interface ConfigInterface {
  apiKey?: string;
  key?: string;
  client?: string;
  apiLibraries?: string | string[];
  libraries?: string[];
  version?: string;
  authReferrerPolicy?: string;
  channel?: string;
  solutionChannel?: string;
  loaderOptions?: Partial<LoaderOptions>;
  options?: google.maps.places.AutocompleteOptions;
  region?: string;
  language?: string;
}

export interface IGooglePlacesConfiguration extends Configure {}
export const IGooglePlacesConfiguration = DI.createInterface<IGooglePlacesConfiguration>(
  'IGooglePlacesConfiguration',
  (x) => x.singleton(Configure)
);

export class Configure {
  protected _config: ConfigInterface;

  constructor() {
    this._config = {
      apiKey: '',
      key: '',
      client: '',
      apiLibraries: '',
      libraries: [],
      version: '',
      authReferrerPolicy: '',
      channel: '',
      solutionChannel: '',
      loaderOptions: {},
      options: {},
      region: '',
      language: '',
    };
  }

  getOptions(): ConfigInterface {
    return this._config;
  }

  options(obj: ConfigInterface = {}) {
    Object.assign(this._config, obj, {
      loaderOptions: Object.assign({}, this._config.loaderOptions, obj.loaderOptions),
      options: Object.assign({}, this._config.options, obj.options),
    });
  }

  get(key: keyof ConfigInterface) {
    return this._config[key];
  }

  set(key: keyof ConfigInterface, val: any) {
    this._config[key] = val;
    return this._config[key];
  }

  getLibraries(): string[] {
    const libs = new Set<string>();
    const add = (value?: string | string[]) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach((lib) => lib && libs.add(lib.trim()));
        return;
      }
      value
        .split(',')
        .map((lib) => lib.trim())
        .filter(Boolean)
        .forEach((lib) => libs.add(lib));
    };

    add(this._config.apiLibraries);
    add(this._config.libraries);
    add(this._config.loaderOptions?.libraries);

    libs.add('places');

    return Array.from(libs);
  }

  getLoaderOptions(): LoaderOptions {
    const libraries = this.getLibraries();
    const loaderOptions: LoaderOptions = {
      key: this._config.key || this._config.apiKey || undefined,
      v: this._config.version || undefined,
      language: this._config.language || undefined,
      region: this._config.region || undefined,
      libraries: libraries.length ? libraries : undefined,
      authReferrerPolicy: this._config.authReferrerPolicy || undefined,
      channel: this._config.channel || undefined,
      solutionChannel: this._config.solutionChannel || undefined,
    };

    const merged = Object.assign({}, loaderOptions, this._config.loaderOptions);

    if (this._config.client && !(merged as any).client) {
      (merged as any).client = this._config.client;
    }

    return merged;
  }
}
