import { IContainer, IRegistry, Registration } from '@aurelia/kernel';
import { AureliaHooks, IAureliaHooks } from './aurelia-hooks';

const DefaultComponents: IRegistry[] = [
    Registration.singleton(AureliaHooks, AureliaHooks),
    Registration.aliasTo(AureliaHooks, IAureliaHooks),
];

export const AureliaHooksConfiguration = {
    register(container: IContainer): IContainer {
        return container.register(
            ...DefaultComponents
        );
    },
    configure() {
        return AureliaHooksConfiguration;
    },
};

export { AureliaHooks, IAureliaHooks } from './aurelia-hooks';
export type { ActionCallback, FilterCallback, HookPriority } from './aurelia-hooks';
