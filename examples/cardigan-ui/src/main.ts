import Aurelia from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';
import { CardiganConfiguration } from 'au-cardigan';

import 'bootstrap/dist/css/bootstrap.css';

Aurelia
  .register(RouterConfiguration, CardiganConfiguration)
  .app(MyApp)
  .start();