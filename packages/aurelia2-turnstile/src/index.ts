import { IContainer, IRegistry } from '@aurelia/kernel';
import { ITurnstileConfiguration, TurnstileConfigOptions } from './configure';
import { TurnstileCustomElement } from './turnstile-custom-element';

export { TurnstileCustomElement } from './turnstile-custom-element';
export { Configure, ITurnstileConfiguration } from './configure';
export type { TurnstileConfigOptions } from './configure';

const DefaultComponents: IRegistry[] = [
    TurnstileCustomElement as unknown as IRegistry,
];

function createTurnstileConfiguration(options: Partial<TurnstileConfigOptions>) {
    return {
        register(container: IContainer) {
            const configClass = container.get(ITurnstileConfiguration);
            configClass.options(options);
            return container.register(...DefaultComponents);
        },
        configure(options: TurnstileConfigOptions) {
            return createTurnstileConfiguration(options);
        },
        customize(callback?: (config: ITurnstileConfiguration) => void) {
            return {
                register(container: IContainer) {
                    const configClass = container.get(ITurnstileConfiguration);
                    configClass.options(options);
                    if (callback) {
                        callback(configClass);
                    }
                    return container.register(...DefaultComponents);
                },
                configure(options: TurnstileConfigOptions) {
                    return createTurnstileConfiguration(options);
                },
            };
        },
    };
}

export const TurnstileConfiguration = createTurnstileConfiguration({});
