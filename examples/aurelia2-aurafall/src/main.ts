import Aurelia from 'aurelia';
import { MyApp } from './my-app';
import { AureliaAurafallConfiguration } from 'aurelia2-aurafall';

Aurelia
  .register(AureliaAurafallConfiguration)
  .app(MyApp)
  .start();
