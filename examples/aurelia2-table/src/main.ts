import Aurelia from 'aurelia';
import { MyApp } from './my-app';
import { AureliaTableConfiguration } from 'aurelia2-table';

Aurelia
  .register(AureliaTableConfiguration)
  .app(MyApp)
  .start();
