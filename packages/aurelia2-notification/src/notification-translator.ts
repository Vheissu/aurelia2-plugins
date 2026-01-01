import { DI } from '@aurelia/kernel';
import type { IDisposable } from 'aurelia';
import type { NotificationMessage, NotificationMessageDescriptor } from './types';

export interface INotificationTranslator {
  translate(message: NotificationMessage): string | string[];
  subscribe?(callback: () => void): IDisposable;
}

export const INotificationTranslator = DI.createInterface<INotificationTranslator>('INotificationTranslator');

export class DefaultNotificationTranslator implements INotificationTranslator {
  public translate(message: NotificationMessage): string | string[] {
    if (Array.isArray(message)) {
      return message;
    }

    if (typeof message === 'string') {
      return message;
    }

    return this.resolveDescriptor(message);
  }

  protected resolveDescriptor(message: NotificationMessageDescriptor): string | string[] {
    if (message.defaultValue !== undefined) {
      return message.defaultValue;
    }

    return message.key;
  }
}
