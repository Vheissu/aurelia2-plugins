import { IContainer, IRegistry, noop } from '@aurelia/kernel';
import { IFroalaConfig } from './froala-editor-config';
import { FroalaEditor } from './froala-editor';

const DefaultComponents: IRegistry[] = [
    IFroalaConfig as unknown as IRegistry,
    FroalaEditor as unknown as IRegistry,
];

function createConfiguration(options) {
    return {
        register(container: IContainer) {
            const configClass = container.get(IFroalaConfig);

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
