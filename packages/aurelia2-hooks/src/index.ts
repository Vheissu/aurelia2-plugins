import { IContainer, IRegistry } from '@aurelia/kernel';
import { AureliaHooks } from './aurelia-hooks';

const DefaultComponents: IRegistry[] = [
    AureliaHooks as unknown as IRegistry
];

export const AureliaHooksConfiguration = {
    register(container: IContainer): IContainer {
        container.register(
            ...DefaultComponents
        );

        return container;
    }
};

export { AureliaHooks, IAureliaHooks } from './aurelia-hooks';