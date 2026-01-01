import { IContainer, IRegistry, Registration } from '@aurelia/kernel';
import { INotificationConfig, NotificationConfig } from './config';
import { AuNotificationHostCustomElement } from './au-notification-host';
import { DefaultNotificationTranslator, INotificationTranslator } from './notification-translator';
import { INotificationService, NotificationService } from './notification-service';
import type { NotificationConfigOptions } from './types';

const DefaultComponents: IRegistry[] = [
  AuNotificationHostCustomElement as unknown as IRegistry,
];

const DefaultServices: IRegistry[] = [
  Registration.cachedCallback(
    NotificationService,
    (container: IContainer) =>
      new NotificationService(
        container.get(INotificationConfig) as NotificationConfig,
        container.get(INotificationTranslator)
      )
  ),
  Registration.aliasTo(NotificationService, INotificationService),
  Registration.singleton(DefaultNotificationTranslator, DefaultNotificationTranslator),
  Registration.aliasTo(DefaultNotificationTranslator, INotificationTranslator),
];

function createConfiguration(options?: NotificationConfigOptions) {
  return {
    register(container: IContainer): IContainer {
      const config = container.get(INotificationConfig) as NotificationConfig;
      config.configure(options);

      return container.register(
        Registration.instance(INotificationConfig, config),
        Registration.instance(NotificationConfig, config),
        ...DefaultServices,
        ...DefaultComponents
      );
    },
    configure(next?: NotificationConfigOptions) {
      return createConfiguration(next);
    },
  };
}

export const AureliaNotificationConfiguration = createConfiguration({});

export { INotificationConfig, NotificationConfig } from './config';
export { INotificationService, NotificationService } from './notification-service';
export { INotificationTranslator, DefaultNotificationTranslator } from './notification-translator';
export { AuNotificationHostCustomElement } from './au-notification-host';
export { NotificationI18nConfiguration } from './i18n-adapter';
export * from './types';
