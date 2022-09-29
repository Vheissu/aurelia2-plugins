import { I18N, I18nConfiguration } from '@aurelia/i18n';
import { INotification } from './aurelia-notification';
import { INotificationConfig, Config } from './config';
import { DI, IContainer, IRegistry, Registration } from '@aurelia/kernel';
import { AppTask } from '@aurelia/runtime-html';

const DefaultComponents: IRegistry[] = [
    // MyComponent as unknown as IRegistry,
];

function createConfiguration(options?: Partial<any>) {
    return {
        register(container: IContainer): IContainer {
            return container.register(
                AppTask.creating(() => {
                    const hasI18n = container.has(I18N, true);

                    if (!hasI18n) {
                        container.register(I18nConfiguration)
                    }

                    const config = container.get(Config);

                    config.configure(options);
        
                    container.register(
                        Registration.instance(INotificationConfig, config), 
                        ...DefaultComponents
                    );
                }),
                AppTask.activated(() => {
                    const hasNotification = container.has(INotification, true);

                    if (!hasNotification) {
                        container.register(INotification);
                    }

                    const notification = container.get(INotification);

                    notification.setBaseCls();
                })
            );
        },
        configure(options?) {
            return createConfiguration(options);
        }
    }
}

export const AureliaNotification = createConfiguration({});

export { INotificationConfig, INotification };