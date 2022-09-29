import { IContainer, IRegistry } from '@aurelia/kernel';
import { Outclick } from './aurelia-outclick';

const DefaultComponents: IRegistry[] = [
    Outclick as unknown as IRegistry
];

export const AureliaOutclick = {
    register(container: IContainer): IContainer {
        container.register(
            ...DefaultComponents
        );

        return container;
    }
};