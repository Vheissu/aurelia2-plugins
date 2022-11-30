import { IContainer, IRegistry, noop } from '@aurelia/kernel';
import { IConfig } from './froala-editor-config';
import { FroalaEditor1 } from './froala-editor';

const DefaultComponents: IRegistry[] = [
    FroalaEditor1 as unknown as IRegistry,
];

function createConfiguration(options) {
    return {
        register(container: IContainer) {
            const configClass = container.get(IConfig);

            if (options?.callback) {
                options.callback(configClass);
            }

            return container.register(...DefaultComponents)
        },
        configure(options) {
            return createConfiguration(options);
        }
    };
}

export const FroalaConfiguration = createConfiguration({});