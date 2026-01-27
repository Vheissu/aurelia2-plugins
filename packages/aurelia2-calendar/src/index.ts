import { IContainer, IRegistry } from 'aurelia';
import { AuCalendarCustomElement } from './au-calendar';

const DefaultComponents: IRegistry[] = [
  AuCalendarCustomElement as unknown as IRegistry,
];

export const AureliaCalendarConfiguration: IRegistry = {
  register(container: IContainer): IContainer {
    return container.register(...DefaultComponents);
  },
};

export { CalendarMath } from './calendar-math';
export * from './types';
export * from './au-calendar';
