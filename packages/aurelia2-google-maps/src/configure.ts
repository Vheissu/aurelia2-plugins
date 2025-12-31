import { DI } from "@aurelia/kernel";
import type { APIOptions } from "@googlemaps/js-api-loader";
import type { MarkerClustererOptions } from "@googlemaps/markerclusterer";

type LoaderOptions = APIOptions & { client?: string };

export interface ConfigInterface {
    apiScript?: string;
    apiKey?: string | false;
    key?: string;
    client?: string | false;
    apiLibraries?: string | string[];
    libraries?: string[];
    version?: string;
    mapIds?: string[];
    authReferrerPolicy?: string;
    channel?: string;
    solutionChannel?: string;
    loaderOptions?: Partial<LoaderOptions>;
    options?: google.maps.MapOptions;
    markerCluster?: {
        enable: boolean;
        options?: Omit<MarkerClustererOptions, "map" | "markers">;
    };
    region?: string;
    language?: string;
}

export interface IGoogleMapsConfiguration extends Configure {}
export const IGoogleMapsConfiguration = DI.createInterface<IGoogleMapsConfiguration>('IGoogleMapsConfiguration', x => x.singleton(Configure));

export class Configure {
    protected _config: ConfigInterface;

    constructor() {
        this._config = {
            apiScript: "https://maps.googleapis.com/maps/api/js",
            apiKey: "",
            key: "",
            client: "",
            apiLibraries: "",
            libraries: [],
            version: "",
            mapIds: [],
            authReferrerPolicy: "",
            channel: "",
            solutionChannel: "",
            loaderOptions: {},
            region: "",
            language: "",
            options: {},
            markerCluster: {
                enable: false,
                options: {},
            },
        };
    }

    getOptions(): ConfigInterface {
        return this._config;
    }

    options(obj: ConfigInterface = {}) {
        Object.assign(this._config, obj, {
            markerCluster: Object.assign({}, this._config.markerCluster, obj.markerCluster),
            loaderOptions: Object.assign({}, this._config.loaderOptions, obj.loaderOptions),
        });
    }

    get(key: string) {
        return this._config[key];
    }

    set(key: string, val: any) {
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
                .split(",")
                .map((lib) => lib.trim())
                .filter(Boolean)
                .forEach((lib) => libs.add(lib));
        };

        add(this._config.apiLibraries);
        add(this._config.libraries);
        add(this._config.loaderOptions?.libraries);

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
            mapIds: this._config.mapIds && this._config.mapIds.length ? this._config.mapIds : undefined,
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
