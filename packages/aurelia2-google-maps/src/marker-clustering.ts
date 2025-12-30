import { DI, inject } from "@aurelia/kernel";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { IGoogleMapsConfiguration } from "./configure";

export const IMarkerClustering = DI.createInterface<IMarkerClustering>(
  "IMarkerClustering",
  (x) => x.singleton(MarkerClustering)
);

export interface IMarkerClustering extends MarkerClustering {}
@inject(IGoogleMapsConfiguration)
export class MarkerClustering {
    private markerClusterer: MarkerClusterer | null = null;

    constructor(readonly config: IGoogleMapsConfiguration) {}

    isEnabled() {
        return this.config.get('markerCluster') && this.config.get('markerCluster').enable;
    }

    clearMarkers(){
        this.markerClusterer?.clearMarkers();
    }

    loadScript() {
        // MarkerClusterer is bundled as a module now; no script load is required.
    }

    renderClusters(map: google.maps.Map, markers: google.maps.Marker[]) {
        if (!this.isEnabled()) {
            return;
        }

        this.markerClusterer?.clearMarkers();
        const options = this.config.get("markerCluster")?.options || {};
        this.markerClusterer = new MarkerClusterer({
            map,
            markers,
            ...options,
        });
    }
}
