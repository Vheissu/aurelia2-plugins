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
  private _scriptPromise: Promise<void> | null = null;
  private _loaderConfigured = false;
  private _libraryPromises = new Map<string, Promise<unknown>>();

  constructor(readonly config: IGoogleMapsConfiguration) {}

  private configureLoader() {
    if (this._loaderConfigured) {
      return;
    }

    setOptions(this.config.getLoaderOptions() as any);
    this._loaderConfigured = true;
  }

  importLibrary(name: string) {
    const normalized = name.trim();
    if (this._libraryPromises.has(normalized)) {
      return this._libraryPromises.get(normalized)!;
    }

    this.configureLoader();
    const promise = importLibrary(normalized as any);
    this._libraryPromises.set(normalized, promise);
    return promise;
  }

  getMapsInstance(libraries?: string[]) {
    if (this._scriptPromise) {
      return this._scriptPromise;
    }

    this._scriptPromise = Promise.resolve().then(async () => {
      await this.importLibrary("maps");
      const extraLibraries = libraries ?? this.config.getLibraries();
      if (extraLibraries.length) {
        await Promise.all(
          extraLibraries
            .filter(Boolean)
            .map((library) => this.importLibrary(library))
        );
      }
    });

    return this._scriptPromise;
  }
}
