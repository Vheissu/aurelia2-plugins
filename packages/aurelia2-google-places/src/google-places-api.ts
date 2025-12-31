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
  private _scriptPromise: Promise<void> | null = null;
  private _loaderConfigured = false;
  private _libraryPromises = new Map<string, Promise<unknown>>();

  constructor(readonly config: IGooglePlacesConfiguration) {}

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

  getPlacesInstance(libraries?: string[]) {
    if (this._scriptPromise) {
      return this._scriptPromise;
    }

    this._scriptPromise = Promise.resolve().then(async () => {
      await this.importLibrary('maps');

      const libs = new Set<string>(libraries ?? this.config.getLibraries());
      libs.add('places');
      libs.delete('maps');

      if (libs.size) {
        await Promise.all(
          Array.from(libs)
            .filter(Boolean)
            .map((library) => this.importLibrary(library))
        );
      }
    });

    return this._scriptPromise;
  }
}
