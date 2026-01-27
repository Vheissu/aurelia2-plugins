import { IContainer, IRegistry } from 'aurelia';
import { AuAurafallCustomElement } from './au-aurafall';

const DefaultComponents = [AuAurafallCustomElement];

export const AureliaAurafallConfiguration: IRegistry = {
  register(container: IContainer): IContainer {
    return container.register(...DefaultComponents);
  },
};
