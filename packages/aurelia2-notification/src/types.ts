export type NotificationType = 'note' | 'success' | 'error' | 'info' | 'warning';

export type NotificationPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type NotificationState = 'queued' | 'entering' | 'visible' | 'leaving';

export type NotificationCloseReason =
  | 'timeout'
  | 'manual'
  | 'action'
  | 'overflow'
  | 'replace'
  | 'clear';

export type NotificationAriaLive = 'polite' | 'assertive' | 'off';
export type NotificationAriaRole = 'status' | 'alert';

export interface NotificationMessageDescriptor {
  key: string;
  params?: Record<string, unknown>;
  defaultValue?: string | string[];
}

export type NotificationMessage =
  | string
  | string[]
  | NotificationMessageDescriptor;

export interface NotificationAction {
  id?: string;
  label: NotificationMessage;
  ariaLabel?: NotificationMessage;
  class?: string;
  dismiss?: boolean;
  callback?: (notification: NotificationItem, action: NotificationAction) => void | Promise<void>;
}

export interface NotificationOptions {
  id?: string;
  type?: NotificationType;
  position?: NotificationPosition;
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
  ariaLive?: NotificationAriaLive;
  role?: NotificationAriaRole;
  onOpen?: (item: NotificationItem) => void;
  onClose?: (item: NotificationItem, reason: NotificationCloseReason) => void;
  onClick?: (item: NotificationItem, event: Event) => void;
  dedupe?: boolean;
}

export interface NotificationDefaults {
  type: NotificationType;
  position: NotificationPosition;
  message: NotificationMessage;
  title?: NotificationMessage;
  allowHtml: boolean;
  icon?: string;
  class?: string | string[];
  style?: string;
  data?: unknown;
  duration: number;
  autoDismiss: boolean;
  dismissible: boolean;
  closeOnClick: boolean;
  showCloseButton: boolean;
  closeButtonLabel: NotificationMessage;
  pauseOnHover: boolean;
  pauseOnFocus: boolean;
  showProgress: boolean;
  actions: NotificationAction[];
  ariaLive: NotificationAriaLive;
  role: NotificationAriaRole;
}

export type NotificationOverflow =
  | 'discard-oldest'
  | 'discard-newest'
  | 'queue';

export interface NotificationConfigOptions {
  defaults?: Partial<NotificationDefaults>;
  types?: Partial<Record<NotificationType, Partial<NotificationDefaults>>>;
  maxItems?: number | Partial<Record<NotificationPosition, number>>;
  newestOnTop?: boolean | Partial<Record<NotificationPosition, boolean>>;
  overflow?: NotificationOverflow | Partial<Record<NotificationPosition, NotificationOverflow>>;
  maxQueue?: number | Partial<Record<NotificationPosition, number>>;
  dedupe?: boolean;
  animations?: Partial<NotificationAnimations>;
  classes?: Partial<NotificationClassConfig>;
  onOpen?: (item: NotificationItem) => void;
  onClose?: (item: NotificationItem, reason: NotificationCloseReason) => void;
}

export interface NotificationAnimations {
  enter: number;
  exit: number;
}

export interface NotificationClassConfig {
  host: string;
  container: string;
  item: string;
  title: string;
  message: string;
  action: string;
  closeButton: string;
  progress: string;
  icon: string;
  count: string;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  position: NotificationPosition;
  message: NotificationMessage;
  title?: NotificationMessage;
  allowHtml: boolean;
  icon?: string;
  class?: string;
  style?: string;
  data?: unknown;
  duration: number;
  autoDismiss: boolean;
  dismissible: boolean;
  closeOnClick: boolean;
  showCloseButton: boolean;
  closeButtonLabel: NotificationMessage;
  pauseOnHover: boolean;
  pauseOnFocus: boolean;
  showProgress: boolean;
  actions: NotificationAction[];
  ariaLive: NotificationAriaLive;
  role: NotificationAriaRole;
  count: number;
  state: NotificationState;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  remaining: number;
  paused: boolean;
  dedupeKey?: string;
  onOpen?: (item: NotificationItem) => void;
  onClose?: (item: NotificationItem, reason: NotificationCloseReason) => void;
  onClick?: (item: NotificationItem, event: Event) => void;
  dismissTimeoutId: number | null;
  removalTimeoutId: number | null;
}

export interface NotificationRef {
  id: string;
  dismiss: (reason?: NotificationCloseReason) => void;
  update: (patch: NotificationOptions) => void;
  pause: () => void;
  resume: () => void;
}
