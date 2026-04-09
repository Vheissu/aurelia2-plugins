import { IContainer, IRegistry } from '@aurelia/kernel';
import { IFroalaConfig } from './froala-editor-config';
import { FroalaEditor } from './froala-editor';

const DefaultComponents: IRegistry[] = [
    IFroalaConfig as unknown as IRegistry,
    FroalaEditor as unknown as IRegistry,
];

interface FroalaConfigurationOptions {
    callback?: (config: IFroalaConfig) => void;
}

function createConfiguration(options?: FroalaConfigurationOptions) {
    return {
        register(container: IContainer) {
            const configClass = container.get(IFroalaConfig);

            if (options?.callback) {
                options.callback(configClass);
            }

            return container.register(...DefaultComponents)
        },
        configure(next?: FroalaConfigurationOptions) {
            return createConfiguration(next);
        }
    };
}

export const FroalaConfiguration = createConfiguration({});
export { IFroalaConfig, Config, type FroalaOptions } from './froala-editor-config';
export { FroalaEditor } from './froala-editor';
