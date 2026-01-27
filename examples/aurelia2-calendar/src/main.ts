import Aurelia from 'aurelia';
import { MyApp } from './my-app';
import { AureliaCalendarConfiguration } from 'aurelia2-calendar';

Aurelia
  .register(AureliaCalendarConfiguration)
  .app(MyApp)
  .start();
