import { DI, inject } from '@aurelia/kernel';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { IGooglePlacesConfiguration } from './configure';

export const IGooglePlacesAPI = DI.createInterface<IGooglePlacesAPI>(
  'IGooglePlacesAPI',
  (x) => x.singleton(GooglePlacesAPI)
);
export interface IGooglePlacesAPI extends GooglePlacesAPI {}

@inject(IGooglePlacesConfiguration)
export class GooglePlacesAPI {
  private lastRequest: { key: string; ready: Promise<void> } | null = null;
  private _loaderConfigured = false;
  private _libraryPromises = new Map<string, Promise<unknown>>();

  constructor(readonly config: IGooglePlacesConfiguration) {}

  private configureLoader() {
    if (this._loaderConfigured) {
      return;
    }

    setOptions(this.config.getLoaderOptions());
    this._loaderConfigured = true;
  }

  importLibrary(name: string) {
    const normalized = name.trim();
    if (this._libraryPromises.has(normalized)) {
      return this._libraryPromises.get(normalized)!;
    }

    this.configureLoader();
    const promise = importLibrary(normalized as keyof google.maps.ImportLibraryMap).catch(error => {
      this._libraryPromises.delete(normalized);
      throw error;
    });
    this._libraryPromises.set(normalized, promise);
    return promise;
  }

  getPlacesInstance(libraries?: string[]) {
    const requested = ['places', ...(libraries ?? this.config.getLibraries())];
    const extras = [...new Set(requested.map(name => name.trim()))].filter(name => name && name !== 'maps').sort();
    const key = JSON.stringify(extras);
    if (this.lastRequest?.key === key) return this.lastRequest.ready;

    const ready = Promise.resolve().then(async () => {
      await this.importLibrary('maps');
      await Promise.all(extras.map(name => this.importLibrary(name)));
    }).catch(error => {
      if (this.lastRequest?.ready === ready) this.lastRequest = null;
      throw error;
    });
    this.lastRequest = { key, ready };
    return ready;
  }
}
