import { DI } from '@aurelia/kernel';
import type {
  NotificationClassConfig,
  NotificationConfigOptions,
  NotificationDefaults,
  NotificationType,
} from './types';
import type { NotificationAnimations, NotificationOverflow, NotificationPosition } from './types';

export const INotificationConfig = DI.createInterface<INotificationConfig>(
  'INotificationConfig',
  x => x.singleton(NotificationConfig)
);
export interface INotificationConfig extends NotificationConfig {}

const DEFAULT_CLASSES: NotificationClassConfig = {
  host: '',
  container: '',
  item: '',
  title: '',
  message: '',
  action: '',
  closeButton: '',
  progress: '',
  icon: '',
  count: '',
};

const DEFAULT_ANIMATIONS: NotificationAnimations = {
  enter: 160,
  exit: 200,
};

const DEFAULT_TYPES: Record<NotificationType, Partial<NotificationDefaults>> = {
  note: {},
  success: {},
  error: {
    role: 'alert',
    ariaLive: 'assertive',
  },
  info: {},
  warning: {
    role: 'alert',
    ariaLive: 'assertive',
  },
};

export class NotificationConfig {
  public defaults: NotificationDefaults = {
    type: 'note',
    position: 'top-right',
    message: '',
    allowHtml: false,
    duration: 4000,
    autoDismiss: true,
    dismissible: true,
    closeOnClick: false,
    showCloseButton: true,
    closeButtonLabel: 'Close notification',
    pauseOnHover: true,
    pauseOnFocus: true,
    showProgress: true,
    actions: [],
    ariaLive: 'polite',
    role: 'status',
  };

  public types: Record<NotificationType, Partial<NotificationDefaults>> = {
    note: {},
    success: {},
    error: {},
    info: {},
    warning: {},
  };

  public maxItems: number | Partial<Record<NotificationPosition, number>> = 5;
  public newestOnTop: boolean | Partial<Record<NotificationPosition, boolean>> = true;
  public overflow: NotificationOverflow | Partial<Record<NotificationPosition, NotificationOverflow>> = 'discard-oldest';
  public maxQueue: number | Partial<Record<NotificationPosition, number>> = 50;
  public dedupe = false;
  public animations: NotificationAnimations = { ...DEFAULT_ANIMATIONS };
  public classes: NotificationClassConfig = { ...DEFAULT_CLASSES };
  public onOpen?: NotificationConfigOptions['onOpen'];
  public onClose?: NotificationConfigOptions['onClose'];

  public constructor() {
    this.types = { ...DEFAULT_TYPES };
  }

  public configure(options: NotificationConfigOptions = {}): this {
    if (options.defaults) {
      this.defaults = {
        ...this.defaults,
        ...options.defaults,
      };
    }

    if (options.types) {
      const next: Record<NotificationType, Partial<NotificationDefaults>> = { ...this.types };
      for (const [key, value] of Object.entries(options.types)) {
        const type = key as NotificationType;
        next[type] = {
          ...(next[type] ?? {}),
          ...(value ?? {}),
        };
      }
      this.types = next;
    }

    if (options.maxItems !== undefined) {
      this.maxItems = options.maxItems;
    }

    if (options.newestOnTop !== undefined) {
      this.newestOnTop = options.newestOnTop;
    }

    if (options.overflow !== undefined) {
      this.overflow = options.overflow;
    }

    if (options.maxQueue !== undefined) {
      this.maxQueue = options.maxQueue;
    }

    if (options.dedupe !== undefined) {
      this.dedupe = options.dedupe;
    }

    if (options.animations) {
      this.animations = {
        ...this.animations,
        ...options.animations,
      };
    }

    if (options.classes) {
      this.classes = {
        ...this.classes,
        ...options.classes,
      };
    }

    if (options.onOpen) {
      this.onOpen = options.onOpen;
    }

    if (options.onClose) {
      this.onClose = options.onClose;
    }

    return this;
  }
}
