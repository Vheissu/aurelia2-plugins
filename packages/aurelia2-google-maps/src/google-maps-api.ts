import { DI, inject } from "@aurelia/kernel";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { IGoogleMapsConfiguration } from "./configure";

export const IGoogleMapsAPI = DI.createInterface<IGoogleMapsAPI>(
  "IGoogleMapsAPI",
  (x) => x.singleton(GoogleMapsAPI)
);
export interface IGoogleMapsAPI extends GoogleMapsAPI {}
@inject(IGoogleMapsConfiguration)
export class GoogleMapsAPI {
  private lastRequest: { key: string; ready: Promise<void> } | null = null;
  private _loaderConfigured = false;
  private _libraryPromises = new Map<string, Promise<unknown>>();

  constructor(readonly config: IGoogleMapsConfiguration) {}

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

  getMapsInstance(libraries?: string[]) {
    const requested = (libraries ?? this.config.getLibraries());
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
