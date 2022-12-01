import { IContainer, IRegistry, noop } from '@aurelia/kernel';
import { IGoogleAnalytics } from './google-analytics';

const DefaultComponents: IRegistry[] = [
    IGoogleAnalytics as unknown as IRegistry,
];

function createConfiguration(options) {
    return {
        register(container: IContainer) {
            const instance = container.get(IGoogleAnalytics);

            if (options?.callback) {
                options.callback(instance);
            }

            return container.register(...DefaultComponents)
        },
        configure(options) {
            return createConfiguration(options);
        }
    };
}

export const GoogleAnalyticsConfiguration = createConfiguration({});