# aurelia2-auth
A port of the ever-popular v1 plugin aurelia-auth (https://github.com/paulvanbladel/aurelia-auth) for Aurelia 2.

**Full disclosure**: this plugin might not be very stable just yet. Use at your own risk.

## Installing it

`npm install aurelia2-auth` or `yarn add aurelia2-auth`

## Configure your app

Inside of your main.ts/main.js file register the plugin on the register method:

```
import { AureliaAuthConfiguration } from 'aurelia2-auth'; 

Aurelia.register(AureliaAuthConfiguration);
```

To change the configuration settings:

```
import { AureliaAuthConfiguration } from 'aurelia2-auth'; 

const configOptions = {
  // Some options
};

Aurelia.register(AureliaAuthConfiguration.configure(configOptions);
```

## Differences between aurelia-auth v1 and this version

There are a few differences in Aurelia 2 which mean the plugin works slightly differently.

- There are no longer router pipeline steps, instead you register a router hook which is exported as `AuthorizeHook` and can be supplied to register or the dependencies in a component
- The plugin is called `aurelia2-auth`
