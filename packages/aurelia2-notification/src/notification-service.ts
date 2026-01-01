import { observable } from 'aurelia';
import { DI } from '@aurelia/kernel';
import type { NotificationConfig } from './config';
import { DefaultNotificationTranslator, INotificationTranslator } from './notification-translator';
import type {
  NotificationCloseReason,
  NotificationDefaults,
  NotificationItem,
  NotificationMessage,
  NotificationOptions,
  NotificationOverflow,
  NotificationPosition,
  NotificationRef,
  NotificationType,
} from './types';

export const INotificationService = DI.createInterface<INotificationService>('INotificationService');
export interface INotificationService extends NotificationService {}

const POSITIONS: NotificationPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const scheduleMicrotask =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (callback: () => void) => Promise.resolve().then(callback);

export class NotificationService {
  @observable public items: NotificationItem[] = [];

  private readonly queues = new Map<NotificationPosition, NotificationItem[]>();
  private readonly dedupeIndex = new Map<string, NotificationItem>();
  public constructor(
    private readonly config: NotificationConfig,
    private readonly translator: INotificationTranslator = new DefaultNotificationTranslator()
  ) {
    for (const position of POSITIONS) {
      this.queues.set(position, []);
    }
  }

  public notify(message: NotificationMessage, options?: NotificationOptions): NotificationRef;
  public notify(options: NotificationOptions & { message: NotificationMessage }): NotificationRef;
  public notify(
    messageOrOptions: NotificationMessage | (NotificationOptions & { message?: NotificationMessage }),
    options: NotificationOptions = {}
  ): NotificationRef {
    const { message, normalized } = this.normalizeArgs(messageOrOptions, options);
    normalized.message = message;
    const defaults = this.resolveDefaults(normalized.type ?? this.config.defaults.type);
    const item = this.createItem(message, defaults, normalized);

    const existing = this.findExisting(item, normalized);
    if (existing) {
      this.updateItem(existing, normalized, 'replace', true);
      return this.createRef(existing);
    }

    const added = this.addOrQueue(item);
    if (added === 'discarded') {
      return this.createRef(item, true);
    }

    if (added === 'queued') {
      item.state = 'queued';
      return this.createRef(item);
    }

    return this.createRef(item);
  }

  public success(message: NotificationMessage, options: NotificationOptions = {}): NotificationRef {
    return this.notify(message, { ...options, type: 'success' });
  }

  public error(message: NotificationMessage, options: NotificationOptions = {}): NotificationRef {
    return this.notify(message, { ...options, type: 'error' });
  }

  public info(message: NotificationMessage, options: NotificationOptions = {}): NotificationRef {
    return this.notify(message, { ...options, type: 'info' });
  }

  public warning(message: NotificationMessage, options: NotificationOptions = {}): NotificationRef {
    return this.notify(message, { ...options, type: 'warning' });
  }

  public note(message: NotificationMessage, options: NotificationOptions = {}): NotificationRef {
    return this.notify(message, { ...options, type: 'note' });
  }

  public dismiss(id: string, reason: NotificationCloseReason = 'manual'): void {
    const item = this.findById(id);
    if (!item) {
      this.removeFromQueue(id, reason);
      return;
    }

    if (item.state === 'leaving') {
      return;
    }

    this.clearDismissTimer(item);
    item.state = 'leaving';

    const exit = Math.max(0, this.config.animations.exit);
    if (item.removalTimeoutId) {
      clearTimeout(item.removalTimeoutId);
    }

    if (exit === 0) {
      this.removeItem(item, reason);
      return;
    }

    item.removalTimeoutId = window.setTimeout(() => {
      this.removeItem(item, reason);
    }, exit);
  }

  public clear(reason: NotificationCloseReason = 'clear'): void {
    for (const item of [...this.items]) {
      this.dismiss(item.id, reason);
    }
    for (const position of POSITIONS) {
      const queue = this.queues.get(position);
      if (queue?.length) {
        queue.splice(0, queue.length);
      }
    }
  }

  public pause(id: string): void {
    const item = this.findById(id);
    if (!item) return;
    this.pauseItem(item);
  }

  public resume(id: string): void {
    const item = this.findById(id);
    if (!item) return;
    this.resumeItem(item);
  }

  public update(id: string, patch: NotificationOptions): void {
    const item = this.findById(id);
    if (!item) return;
    this.updateItem(item, patch, 'replace', false);
  }

  public getItemsForPosition(position: NotificationPosition): NotificationItem[] {
    const newestOnTop = this.resolvePositionValue(this.config.newestOnTop, position, true);
    const items = this.items.filter((item) => item.position === position && item.state !== 'queued');

    return items.sort((a, b) => {
      if (a.createdAt === b.createdAt) return 0;
      const comparison = a.createdAt > b.createdAt ? 1 : -1;
      return newestOnTop ? -comparison : comparison;
    });
  }

  public getPositions(): NotificationPosition[] {
    return [...POSITIONS];
  }

  public translate(message: NotificationMessage): string | string[] {
    return this.translator.translate(message);
  }

  private normalizeArgs(
    messageOrOptions: NotificationMessage | (NotificationOptions & { message?: NotificationMessage }),
    options: NotificationOptions
  ): { message: NotificationMessage; normalized: NotificationOptions } {
    if (options && Object.keys(options).length) {
    const message = messageOrOptions as NotificationMessage;
    const normalizedOptions = {
      ...options,
      message,
    };

    return {
      message,
      normalized: normalizedOptions,
    };
    }

    if (this.isNotificationOptions(messageOrOptions)) {
      const normalizedOptions = messageOrOptions as NotificationOptions;
      const message = normalizedOptions.message ?? this.config.defaults.message;
      return {
        message,
        normalized: {
          ...normalizedOptions,
          message,
        },
      };
    }

    return {
      message: messageOrOptions as NotificationMessage,
      normalized: { message: messageOrOptions as NotificationMessage },
    };
  }

  private isNotificationOptions(value: unknown): value is NotificationOptions {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

    const keys = [
      'message',
      'title',
      'type',
      'position',
      'duration',
      'actions',
      'id',
      'data',
      'icon',
      'class',
      'style',
    ];

    return keys.some((key) => key in (value as Record<string, unknown>));
  }

  private resolveDefaults(type: NotificationType): NotificationDefaults {
    return {
      ...this.config.defaults,
      ...(this.config.types[type] ?? {}),
      type,
    };
  }

  private createItem(
    message: NotificationMessage,
    defaults: NotificationDefaults,
    options: NotificationOptions
  ): NotificationItem {
    const now = Date.now();
    const duration = options.duration ?? defaults.duration;
    const autoDismiss = options.autoDismiss ?? defaults.autoDismiss;
    const actions = options.actions ?? defaults.actions ?? [];
    const className = this.mergeClasses(defaults.class, options.class);
    const ariaLive = options.ariaLive ?? defaults.ariaLive;
    const role = options.role ?? defaults.role;

    const item: NotificationItem = {
      id: options.id ?? this.createId(),
      type: options.type ?? defaults.type,
      position: options.position ?? defaults.position,
      message,
      title: options.title ?? defaults.title,
      allowHtml: options.allowHtml ?? defaults.allowHtml,
      icon: options.icon ?? defaults.icon,
      class: className ?? undefined,
      style: options.style ?? defaults.style,
      data: options.data ?? defaults.data,
      duration,
      autoDismiss: duration > 0 ? autoDismiss : false,
      dismissible: options.dismissible ?? defaults.dismissible,
      closeOnClick: options.closeOnClick ?? defaults.closeOnClick,
      showCloseButton: options.showCloseButton ?? defaults.showCloseButton,
      closeButtonLabel: options.closeButtonLabel ?? defaults.closeButtonLabel,
      pauseOnHover: options.pauseOnHover ?? defaults.pauseOnHover,
      pauseOnFocus: options.pauseOnFocus ?? defaults.pauseOnFocus,
      showProgress: options.showProgress ?? defaults.showProgress,
      actions: actions.map((action) => ({ ...action })),
      ariaLive,
      role,
      count: 1,
      state: 'entering',
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      remaining: Math.max(0, duration),
      paused: false,
      dedupeKey: this.createDedupeKey(message, options.type ?? defaults.type, options.position ?? defaults.position),
      onOpen: options.onOpen,
      onClose: options.onClose,
      onClick: options.onClick,
      dismissTimeoutId: null,
      removalTimeoutId: null,
    };

    return item;
  }

  private createRef(item: NotificationItem, discarded = false): NotificationRef {
    return {
      id: item.id,
      dismiss: (reason) => {
        if (discarded) return;
        this.dismiss(item.id, reason ?? 'manual');
      },
      update: (patch) => {
        if (discarded) return;
        this.update(item.id, patch);
      },
      pause: () => {
        if (discarded) return;
        this.pause(item.id);
      },
      resume: () => {
        if (discarded) return;
        this.resume(item.id);
      },
    };
  }

  private findExisting(item: NotificationItem, options: NotificationOptions): NotificationItem | null {
    if (options.id) {
      const found = this.findById(options.id);
      if (found) return found;
      return null;
    }

    const allowDedupe = options.dedupe ?? this.config.dedupe;
    if (!allowDedupe) return null;

    const dedupeKey = item.dedupeKey ?? this.createDedupeKey(item.message, item.type, item.position);
    const existing = this.dedupeIndex.get(dedupeKey);
    if (existing && existing.state !== 'leaving') {
      return existing;
    }

    return (
      this.items.find(
        (entry) =>
          entry.state !== 'leaving' &&
          this.createDedupeKey(entry.message, entry.type, entry.position) === dedupeKey
      ) ?? null
    );
  }

  private updateItem(
    item: NotificationItem,
    patch: NotificationOptions,
    reason: NotificationCloseReason,
    incrementCount: boolean
  ): void {
    const now = Date.now();
    const defaults = this.resolveDefaults(patch.type ?? item.type);

    const previousKey = item.dedupeKey;

    item.type = patch.type ?? item.type;
    item.position = patch.position ?? item.position;
    item.message = patch.message ?? item.message;
    item.title = patch.title ?? item.title;
    item.allowHtml = patch.allowHtml ?? item.allowHtml;
    item.icon = patch.icon ?? item.icon;
    if (patch.class !== undefined) {
      item.class = this.mergeClasses(defaults.class, patch.class);
    }
    item.style = patch.style ?? item.style;
    item.data = patch.data ?? item.data;
    item.duration = patch.duration ?? item.duration;
    item.autoDismiss = item.duration > 0 ? patch.autoDismiss ?? item.autoDismiss : false;
    item.dismissible = patch.dismissible ?? item.dismissible;
    item.closeOnClick = patch.closeOnClick ?? item.closeOnClick;
    item.showCloseButton = patch.showCloseButton ?? item.showCloseButton;
    item.closeButtonLabel = patch.closeButtonLabel ?? item.closeButtonLabel;
    item.pauseOnHover = patch.pauseOnHover ?? item.pauseOnHover;
    item.pauseOnFocus = patch.pauseOnFocus ?? item.pauseOnFocus;
    item.showProgress = patch.showProgress ?? item.showProgress;
    item.actions = patch.actions ? patch.actions.map((action) => ({ ...action })) : item.actions;
    item.ariaLive = patch.ariaLive ?? item.ariaLive;
    item.role = patch.role ?? item.role;
    item.onOpen = patch.onOpen ?? item.onOpen;
    item.onClose = patch.onClose ?? item.onClose;
    item.onClick = patch.onClick ?? item.onClick;
    item.updatedAt = now;

    if (incrementCount) {
      item.count += 1;
    }

    item.dedupeKey = this.createDedupeKey(item.message, item.type, item.position);
    if (previousKey && previousKey !== item.dedupeKey) {
      this.dedupeIndex.delete(previousKey);
    }
    if (item.dedupeKey) {
      this.dedupeIndex.set(item.dedupeKey, item);
    }

    if (item.state === 'leaving') {
      item.state = 'visible';
      if (item.removalTimeoutId) {
        clearTimeout(item.removalTimeoutId);
        item.removalTimeoutId = null;
      }
    }

    this.restartTimer(item, reason);
  }

  private addOrQueue(item: NotificationItem): 'added' | 'queued' | 'discarded' {
    const maxItems = this.resolvePositionValue(this.config.maxItems, item.position, 5);
    const overflow = this.resolvePositionValue(this.config.overflow, item.position, 'discard-oldest');
    const currentCount = this.items.filter((entry) => entry.position === item.position && entry.state !== 'leaving').length;

    if (maxItems > 0 && currentCount >= maxItems) {
      if (overflow === 'queue') {
        return this.enqueue(item);
      }

      if (overflow === 'discard-newest') {
        return 'discarded';
      }
    }

    this.items = [...this.items, item];
    if (item.dedupeKey) {
      this.dedupeIndex.set(item.dedupeKey, item);
    }
    this.activateItem(item);

    if (maxItems > 0 && overflow !== 'queue') {
      this.trimActiveItems(item.position, maxItems, overflow);
    }
    return 'added';
  }

  private enqueue(item: NotificationItem): 'queued' | 'discarded' {
    const maxQueue = this.resolvePositionValue(this.config.maxQueue, item.position, 50);
    const queue = this.queues.get(item.position);
    if (!queue) return 'discarded';

    if (maxQueue <= 0) {
      return 'discarded';
    }

    if (maxQueue > 0 && queue.length >= maxQueue) {
      queue.shift();
    }

    queue.push(item);
    return 'queued';
  }

  private activateItem(item: NotificationItem): void {
    item.state = 'entering';
    item.startedAt = null;
    item.remaining = Math.max(0, item.duration);
    item.paused = false;

    scheduleMicrotask(() => {
      if (item.state === 'entering') {
        item.state = 'visible';
      }
    });

    this.startTimer(item);

    item.onOpen?.(item);
    this.config.onOpen?.(item);
  }

  private startTimer(item: NotificationItem): void {
    if (!item.autoDismiss || item.duration <= 0) return;
    this.clearDismissTimer(item);
    item.startedAt = Date.now();
    item.remaining = item.remaining || item.duration;
    item.dismissTimeoutId = window.setTimeout(() => {
      this.dismiss(item.id, 'timeout');
    }, item.remaining);
  }

  private restartTimer(item: NotificationItem, reason: NotificationCloseReason): void {
    if (item.autoDismiss && item.duration > 0) {
      item.remaining = item.duration;
      this.startTimer(item);
      return;
    }

    this.clearDismissTimer(item);

    if (reason === 'replace' && item.state === 'leaving') {
      item.state = 'visible';
    }
  }

  private pauseItem(item: NotificationItem): void {
    if (!item.autoDismiss || item.duration <= 0) return;
    if (item.paused) return;
    if (item.dismissTimeoutId) {
      const now = Date.now();
      const startedAt = item.startedAt ?? now;
      item.remaining = Math.max(0, item.remaining - (now - startedAt));
      this.clearDismissTimer(item);
    }

    item.paused = true;
  }

  private resumeItem(item: NotificationItem): void {
    if (!item.autoDismiss || item.duration <= 0) return;
    if (!item.paused) return;

    item.paused = false;

    if (item.remaining <= 0) {
      this.dismiss(item.id, 'timeout');
      return;
    }

    this.startTimer(item);
  }

  private clearDismissTimer(item: NotificationItem): void {
    if (item.dismissTimeoutId) {
      clearTimeout(item.dismissTimeoutId);
      item.dismissTimeoutId = null;
    }
  }

  private removeItem(item: NotificationItem, reason: NotificationCloseReason, skipQueue = false): void {
    if (item.dismissTimeoutId) {
      clearTimeout(item.dismissTimeoutId);
      item.dismissTimeoutId = null;
    }

    if (item.removalTimeoutId) {
      clearTimeout(item.removalTimeoutId);
      item.removalTimeoutId = null;
    }

    this.items = this.items.filter((entry) => entry.id !== item.id);
    this.finalizeRemoval(item, reason);

    if (!skipQueue) {
      this.activateNextFromQueue(item.position);
    }
  }

  private activateNextFromQueue(position: NotificationPosition): void {
    const queue = this.queues.get(position);
    if (!queue || queue.length === 0) return;

    const next = queue.shift();
    if (!next) return;

    this.items = [...this.items, next];
    this.activateItem(next);
  }

  private pickOldest(position: NotificationPosition): NotificationItem | null {
    const items = this.items.filter((entry) => entry.position === position);
    if (items.length === 0) return null;

    return items.reduce((oldest, next) => (next.createdAt < oldest.createdAt ? next : oldest), items[0]);
  }

  private enforceMaxItems(
    position: NotificationPosition,
    maxItems: number,
    overflow: NotificationOverflow
  ): void {
    const active = this.items.filter((entry) => entry.position === position && entry.state !== 'leaving');
    if (active.length <= maxItems) return;

    const sorted = [...active].sort((a, b) => a.createdAt - b.createdAt);
    const keep =
      overflow === 'discard-newest'
        ? sorted.slice(0, maxItems)
        : sorted.slice(active.length - maxItems);

    const keepIds = new Set(keep.map((item) => item.id));
    const removed = active.filter((item) => !keepIds.has(item.id));

    this.items = this.items.filter(
      (item) =>
        item.position !== position ||
        item.state === 'leaving' ||
        keepIds.has(item.id)
    );

    for (const item of removed) {
      this.finalizeRemoval(item, 'overflow');
    }
  }

  private trimActiveItems(
    position: NotificationPosition,
    maxItems: number,
    overflow: NotificationOverflow
  ): void {
    this.enforceMaxItems(position, maxItems, overflow);
  }

  private finalizeRemoval(item: NotificationItem, reason: NotificationCloseReason): void {
    if (item.dismissTimeoutId) {
      clearTimeout(item.dismissTimeoutId);
      item.dismissTimeoutId = null;
    }

    if (item.removalTimeoutId) {
      clearTimeout(item.removalTimeoutId);
      item.removalTimeoutId = null;
    }

    if (item.dedupeKey) {
      this.dedupeIndex.delete(item.dedupeKey);
    }

    item.onClose?.(item, reason);
    this.config.onClose?.(item, reason);
  }

  private removeFromQueue(id: string, reason: NotificationCloseReason): void {
    for (const queue of this.queues.values()) {
      const index = queue.findIndex((item) => item.id === id);
      if (index !== -1) {
        const [item] = queue.splice(index, 1);
        item.onClose?.(item, reason);
        this.config.onClose?.(item, reason);
        return;
      }
    }
  }

  private findById(id: string): NotificationItem | undefined {
    return this.items.find((item) => item.id === id);
  }

  private mergeClasses(...classes: Array<string | string[] | undefined>): string | undefined {
    const classList: string[] = [];

    for (const value of classes) {
      if (!value) continue;
      if (Array.isArray(value)) {
        classList.push(...value.filter(Boolean));
      } else if (typeof value === 'string') {
        classList.push(...value.split(' ').filter(Boolean));
      }
    }

    if (classList.length === 0) return undefined;
    return classList.join(' ');
  }

  private resolvePositionValue<T>(
    value: T | Partial<Record<NotificationPosition, T>> | undefined,
    position: NotificationPosition,
    fallback: T
  ): T {
    if (value === undefined) return fallback;
    if (typeof value !== 'object') return value as T;
    return (value as Partial<Record<NotificationPosition, T>>)[position] ?? fallback;
  }

  private createId(): string {
    return `notify_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }

  private createDedupeKey(
    message: NotificationMessage,
    type: NotificationType,
    position: NotificationPosition
  ): string {
    if (Array.isArray(message)) {
      return `${type}|${position}|${message.join('\n')}`;
    }

    if (typeof message === 'string') {
      return `${type}|${position}|${message}`;
    }

    return `${type}|${position}|${message.key}`;
  }
}
