# aurelia2-google-maps

A plugin for working with Google Maps in Aurelia 2 applications.

## Installation

```
npm install aurelia2-google-maps
```

If you are using TypeScript, add the Google Maps types:

```
npm install -D @types/google.maps
```

## Configure your app

Inside of `main.ts`/`main.js` register the plugin:

```
import { GoogleMapsConfiguration } from "aurelia2-google-maps";

Aurelia.register(
  GoogleMapsConfiguration.configure({
    apiKey: "YOUR_API_KEY",
    libraries: ["places", "geometry", "drawing"],
    options: {
      backgroundColor: "#495061",
    },
  })
);
```

If you prefer a callback style:

```
import { GoogleMapsConfiguration } from "aurelia2-google-maps";

Aurelia.register(
  GoogleMapsConfiguration.customize((config) => {
    config.options({
      apiKey: "YOUR_API_KEY",
      language: "en",
      region: "US",
    });
  })
);
```

### Loader options

You can pass any loader options through `loaderOptions` (for example `mapIds`, `authReferrerPolicy`, `channel`, or `solutionChannel`). Use `libraries` or `apiLibraries` to load extra Google Maps libraries.

## Using the map component

```
<google-map
  latitude.bind="lat"
  longitude.bind="lng"
  zoom.bind="zoom"
  markers.bind="markers"
  polygons.bind="polygons"
  auto-update-bounds.bind="true"
  on-event.bind="handleMapEvent">
</google-map>
```

`onEvent` receives a typed event union. You can switch on `event.type` to handle map, marker, polygon, and info window events.

## Places, Geocoder, Autocomplete

```
import { GoogleMaps } from "aurelia2-google-maps";

export class MyViewModel {
  map!: GoogleMaps;

  async attached() {
    const geocoder = await this.map.getGeocoder();
    const places = await this.map.getPlacesService();
    const autocomplete = await this.map.createAutocomplete(
      this.addressInput,
      { fields: ["place_id", "geometry", "name"] }
    );
  }
}
```

## Marker clustering

Marker clustering uses `@googlemaps/markerclusterer` and accepts the modern `MarkerClustererOptions` under `markerCluster.options`.

```
GoogleMapsConfiguration.configure({
  markerCluster: {
    enable: true,
    options: {
      onClusterClick: (event, cluster, map) => {
        map.fitBounds(cluster.bounds);
      }
    }
  }
});
```

Note: the legacy `markerCluster.src`, `imagePath`, and `imageExtension` options are no longer used.
