# aurelia2-google-maps

A plugin for working with Google Maps in Aurelia 2 applications.

## Installation

`npm install aurelia2-google-maps` to install the plugin.

Inside of `main.ts`/`main.js` import the plugin and register it:

```
import { GoogleMapsConfiguration } from 'aurelia2-google-maps';

Aurelia.register(
    GoogleMapsConfiguration.customize((config) => {
        config.options({
            apiKey: '',
            region: 'AU',
            options: {
                backgroundColor: '#495061',
            }
        });
    }),
);
```