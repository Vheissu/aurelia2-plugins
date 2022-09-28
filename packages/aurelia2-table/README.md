## Aurelia 2

This is a rewritten fork of the Aurelia Table plugin by @tochoromero — the original was a highly useful and simple to use table plugin for Aurelia, I wanted to port it to Aurelia 2. The core functionality remains the same, so all previous documentation for this works.

The original repository can be found [here](https://github.com/tochoromero/aurelia-table) if you're looking for the Aurelia v1 plugin.

Please visit the [project page](http://tochoromero.github.com/aurelia-table) for the documentation and examples.

## Installing it

To install just run `npm install aurelia2-table` in your project directory.

Inside of `main.js`/`main.ts` or whever you instantiate Aurelia 2, import the configuration object and register it:

```
import Aurelia from 'aurelia';
import { MyApp } from './my-app';
import { AureliaTableConfiguration } from 'aurelia2-table';

Aurelia
  .register(AureliaTableConfiguration)
  .app(MyApp)
  .start();
```

Now, use it as per the original documentation.

## Features

Aurelia Table is very easy to use, and you have complete control over the look and feel. You can make your table look exactly the way you want using plain html and css.

Out of the box you will get:
 - Row Filtering
 - Column Sorting
 - Client side pagination
 - Row Selection
 
For a complete list of features and examples please visit the [project page](https://tochoromero.github.io/aurelia-table/).