# aurelia2-notification

An Aurelia 2 notification/toast library with no third‑party runtime dependencies. Fully configurable, accessible defaults, optional i18n adapter, and a host component you can drop into any app.

## Features
- Positions (top/bottom + left/center/right)
- Stacking order control
- Max visible per position + overflow policy (queue/discard)
- Auto‑dismiss with duration + pause on hover/focus
- Dismiss actions, click‑to‑dismiss, and close button
- Progress indicator
- Typed API + update/ref control
- Optional i18n adapter (`@aurelia/i18n`)
- Styling via CSS variables + class hooks

## Install
```
npm i aurelia2-notification
```

## Basic setup
```ts
import { Aurelia } from 'aurelia';
import { AureliaNotificationConfiguration } from 'aurelia2-notification';

Aurelia.register(
  AureliaNotificationConfiguration.configure({
    defaults: {
      position: 'top-right',
      duration: 4000,
      showProgress: true,
    },
    maxItems: 4,
    newestOnTop: true,
  })
);
```

Add the host somewhere in your root component template (typically `app.html`):
```html
<au-notification-host></au-notification-host>
```

Then inject and use the service:
```ts
import { resolve } from '@aurelia/kernel';
import { INotificationService } from 'aurelia2-notification';

const notifications = resolve(INotificationService);
notifications.success('Saved!');
notifications.error('Something went wrong', { duration: 8000 });
```

## Optional i18n
The plugin does **not** force `@aurelia/i18n`. If you want translations, register the adapter:
```ts
import { AureliaNotificationConfiguration, NotificationI18nConfiguration } from 'aurelia2-notification';

Aurelia.register(
  AureliaNotificationConfiguration,
  NotificationI18nConfiguration
);
```

Then pass translation descriptors:
```ts
notifications.notify({
  message: { key: 'toast.saved', params: { name: 'Profile' } },
  type: 'success',
});
```

## API
```ts
interface INotificationService {
  notify(message: NotificationMessage, options?: NotificationOptions): NotificationRef;
  notify(options: NotificationOptions & { message: NotificationMessage }): NotificationRef;
  success(message: NotificationMessage, options?: NotificationOptions): NotificationRef;
  error(message: NotificationMessage, options?: NotificationOptions): NotificationRef;
  info(message: NotificationMessage, options?: NotificationOptions): NotificationRef;
  warning(message: NotificationMessage, options?: NotificationOptions): NotificationRef;
  note(message: NotificationMessage, options?: NotificationOptions): NotificationRef;
  dismiss(id: string, reason?: NotificationCloseReason): void;
  clear(reason?: NotificationCloseReason): void;
  update(id: string, patch: NotificationOptions): void;
  pause(id: string): void;
  resume(id: string): void;
}
```

### NotificationOptions
```ts
type NotificationMessage =
  | string
  | string[]
  | { key: string; params?: Record<string, unknown>; defaultValue?: string | string[] };

interface NotificationAction {
  id?: string;
  label: NotificationMessage;
  ariaLabel?: NotificationMessage;
  class?: string;
  dismiss?: boolean;
  callback?: (notification, action) => void | Promise<void>;
}

interface NotificationOptions {
  id?: string;
  type?: 'note' | 'success' | 'error' | 'info' | 'warning';
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  message?: NotificationMessage;
  title?: NotificationMessage;
  allowHtml?: boolean;
  icon?: string;
  class?: string | string[];
  style?: string;
  data?: unknown;
  duration?: number;
  autoDismiss?: boolean;
  dismissible?: boolean;
  closeOnClick?: boolean;
  showCloseButton?: boolean;
  closeButtonLabel?: NotificationMessage;
  pauseOnHover?: boolean;
  pauseOnFocus?: boolean;
  showProgress?: boolean;
  actions?: NotificationAction[];
  ariaLive?: 'polite' | 'assertive' | 'off';
  role?: 'status' | 'alert';
  onOpen?: (item) => void;
  onClose?: (item, reason) => void;
  onClick?: (item, event) => void;
  dedupe?: boolean;
}
```

### NotificationRef
```ts
interface NotificationRef {
  id: string;
  dismiss(reason?: NotificationCloseReason): void;
  update(patch: NotificationOptions): void;
  pause(): void;
  resume(): void;
}
```

### Global configuration
```ts
AureliaNotificationConfiguration.configure({
  defaults: {
    duration: 4500,
    autoDismiss: true,
    dismissible: true,
    closeOnClick: false,
    pauseOnHover: true,
    pauseOnFocus: true,
    showProgress: true,
    showCloseButton: true,
    closeButtonLabel: 'Close notification',
  },
  types: {
    error: { role: 'alert', ariaLive: 'assertive' },
    warning: { role: 'alert', ariaLive: 'assertive' },
  },
  maxItems: 5,
  newestOnTop: true,
  overflow: 'discard-oldest', // or 'discard-newest' | 'queue'
  maxQueue: 50,
  dedupe: false,
  animations: { enter: 160, exit: 200 },
});
```

## Multiple hosts / positions
You can render a single host (shows all positions) or multiple hosts for specific positions:
```html
<au-notification-host position="top-right"></au-notification-host>
<au-notification-host position="bottom-left"></au-notification-host>
```

## Styling
The host ships with a polished default theme that you can override with CSS variables:
```css
au-notification-host {
  --au-notification-bg: #0b1320;
  --au-notification-fg: #f8fafc;
  --au-notification-muted: #cbd5f5;
  --au-notification-radius: 12px;
  --au-notification-shadow: 0 12px 34px rgba(0, 0, 0, 0.3);
  --au-notification-success-bg: #0f766e;
  --au-notification-success-accent: #5eead4;
  --au-notification-error-bg: #b91c1c;
  --au-notification-error-accent: #fca5a5;
}
```

There is also a built-in light theme you can enable with a class or attribute:
```html
<au-notification-host class="au-notification-host--light"></au-notification-host>
<au-notification-host data-theme="light"></au-notification-host>
```

You can also add classes via config:
```ts
AureliaNotificationConfiguration.configure({
  classes: {
    host: 'my-host',
    item: 'my-toast',
    action: 'my-action',
  }
});
```
