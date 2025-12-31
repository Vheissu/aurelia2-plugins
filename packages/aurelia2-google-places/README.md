# aurelia2-google-places

A plugin for working with Google Places Autocomplete in Aurelia 2 applications.

## Installation

```
npm install aurelia2-google-places
```

If you are using TypeScript, add the Google Maps types:

```
npm install -D @types/google.maps
```

## Configure your app

Inside of `main.ts`/`main.js` register the plugin:

```
import { GooglePlacesConfiguration } from "aurelia2-google-places";

Aurelia.register(
  GooglePlacesConfiguration.configure({
    apiKey: "YOUR_API_KEY",
    libraries: ["places"],
    options: {
      fields: ["place_id", "geometry", "name"],
    },
  })
);
```

If you prefer a callback style:

```
import { GooglePlacesConfiguration } from "aurelia2-google-places";

Aurelia.register(
  GooglePlacesConfiguration.customize((config) => {
    config.options({
      apiKey: "YOUR_API_KEY",
      language: "en",
      region: "US",
    });
  })
);
```

### Loader options

You can pass any loader options through `loaderOptions` (for example `authReferrerPolicy`, `channel`, or `solutionChannel`). Use `libraries` or `apiLibraries` to load extra Google Maps libraries. The Places library is always included.

## Using the google-places attribute

```
<input
  type="text"
  google-places.bind="selectedPlace"
  options.bind="autocompleteOptions"
  fields.bind="['place_id', 'geometry', 'name']"
  types.bind="['address']"
  component-restrictions.bind="{ country: 'us' }"
  place-changed.trigger="handlePlaceChanged($event.detail.place)">
```

`place-changed` is a DOM event that includes `{ place, autocomplete }` in `event.detail`. The `google-places` binding is from-view, so `google-places.bind` will update the view-model when the user selects a place. You can also use `autocomplete.bind` to access the underlying `google.maps.places.Autocomplete` instance.
