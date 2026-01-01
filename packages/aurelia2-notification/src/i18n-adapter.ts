import { IContainer, Registration } from '@aurelia/kernel';
import { I18N } from '@aurelia/i18n';
import type { IDisposable } from 'aurelia';
import type { NotificationMessage, NotificationMessageDescriptor } from './types';
import { INotificationTranslator } from './notification-translator';

export class I18nNotificationTranslator implements INotificationTranslator {
  public constructor(private readonly i18n: I18N) {}

  public translate(message: NotificationMessage): string | string[] {
    if (Array.isArray(message)) {
      return message.map((entry) => this.i18n.tr(entry));
    }

    if (typeof message === 'string') {
      return this.i18n.tr(message);
    }

    return this.translateDescriptor(message);
  }

  public subscribe(callback: () => void): IDisposable {
    const subscriber = {
      handleLocaleChange: () => callback(),
    };

    this.i18n.subscribeLocaleChange(subscriber);

    return {
      dispose: () => this.i18n.unsubscribeLocaleChange(subscriber),
    };
  }

  protected translateDescriptor(message: NotificationMessageDescriptor): string | string[] {
    return this.i18n.tr(message.key, message.params);
  }
}

export const NotificationI18nConfiguration = {
  register(container: IContainer) {
    return container.register(
      Registration.singleton(I18nNotificationTranslator, I18nNotificationTranslator),
      Registration.aliasTo(I18nNotificationTranslator, INotificationTranslator)
    );
  },
};
