import { IContainer, IRegistry } from '@aurelia/kernel';
import { IGoogleAnalytics } from './google-analytics';

export { IGoogleAnalytics } from './google-analytics';

interface GoogleAnalyticsOptions {
    callback?: (instance: IGoogleAnalytics) => void;
}

const DefaultComponents: IRegistry[] = [
    IGoogleAnalytics as unknown as IRegistry,
];

function createConfiguration(options: GoogleAnalyticsOptions) {
    return {
        register(container: IContainer) {
            const instance = container.get(IGoogleAnalytics);

            if (options?.callback) {
                options.callback(instance);
            }

            return container.register(...DefaultComponents)
        },
        configure(options: GoogleAnalyticsOptions) {
            return createConfiguration(options);
        }
    };
}

export const GoogleAnalyticsConfiguration = createConfiguration({});