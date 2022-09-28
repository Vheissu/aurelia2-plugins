import { DefaultComponents } from './components';
import { DI, IContainer } from '@aurelia/kernel';

const cardiganConfiguration = {
    register(container: IContainer): IContainer {
        return container.register(
            ...DefaultComponents
        );
    },

    createContainer(): IContainer {
        return this.register(DI.createContainer());
    }
};

export const CardiganConfiguration = {
    customize(components: any[] = []) {
        return { ...cardiganConfiguration };
    },
    ...cardiganConfiguration
};