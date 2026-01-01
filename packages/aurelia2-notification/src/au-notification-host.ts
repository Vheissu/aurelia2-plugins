import { bindable, customElement, IDisposable, observable, watch } from 'aurelia';
import { inject } from '@aurelia/kernel';
import { INotificationConfig } from './config';
import type { NotificationConfig } from './config';
import { INotificationService, NotificationService } from './notification-service';
import { INotificationTranslator } from './notification-translator';
import type { NotificationAction, NotificationItem, NotificationMessage, NotificationPosition } from './types';
import template from './au-notification-host.html';

@customElement({
  name: 'au-notification-host',
  template,
})
@inject(INotificationService, INotificationConfig, INotificationTranslator)
export class AuNotificationHostCustomElement {
  @bindable public position: NotificationPosition | null = null;
  @bindable public hostClass = '';
  @bindable public containerClass = '';

  public translationVersion = 0;
  @observable public itemsByPosition: Record<NotificationPosition, NotificationItem[]> = {} as Record<
    NotificationPosition,
    NotificationItem[]
  >;
  public positions: NotificationPosition[] = [];

  private translationSubscription?: IDisposable;

  public constructor(
    public readonly notifications: NotificationService,
    public readonly config: NotificationConfig,
    private readonly translator: INotificationTranslator
  ) {}

  public binding(): void {
    this.positions = this.position
      ? [this.position]
      : this.notifications.getPositions();

    this.updateItemsByPosition();

    if (this.translator.subscribe) {
      this.translationSubscription = this.translator.subscribe(() => {
        this.translationVersion += 1;
      });
    }
  }

  public positionChanged(): void {
    this.positions = this.position
      ? [this.position]
      : this.notifications.getPositions();
    this.updateItemsByPosition();
  }

  public detached(): void {
    this.translationSubscription?.dispose();
  }

  public hostClasses(): string {
    return this.mergeClasses(
      'au-notification-host',
      this.config.classes.host,
      this.hostClass
    );
  }

  public hostStyle(): string {
    return `--au-notification-enter-duration: ${this.config.animations.enter}ms; --au-notification-exit-duration: ${this.config.animations.exit}ms;`;
  }

  public containerClasses(position: NotificationPosition): string {
    return this.mergeClasses(
      `au-notification-container au-notification-container--${position}`,
      this.config.classes.container,
      this.containerClass
    );
  }

  public itemClasses(item: NotificationItem): string {
    const stateClass = `au-notification--${item.state}`;
    const typeClass = `au-notification--${item.type}`;
    const pausedClass = item.paused ? 'au-notification--paused' : '';

    return this.mergeClasses(
      'au-notification',
      typeClass,
      stateClass,
      pausedClass,
      this.config.classes.item,
      item.class
    );
  }

  public itemTitle(item: NotificationItem): string {
    return this.translateText(item.title);
  }

  public messageLines(item: NotificationItem): string[] {
    const _ = this.translationVersion;
    const translated = this.notifications.translate(item.message);
    if (Array.isArray(translated)) {
      return translated;
    }

    return String(translated).split('\n');
  }

  @watch((x: AuNotificationHostCustomElement) => x.notifications.items)
  private handleItemsChanged(): void {
    this.updateItemsByPosition();
  }

  public messageHtml(item: NotificationItem): string {
    return this.messageLines(item).join('<br />');
  }

  public actionLabel(action: NotificationAction): string {
    return this.translateText(action.label);
  }

  public actionAriaLabel(action: NotificationAction): string {
    if (action.ariaLabel) {
      return this.translateText(action.ariaLabel);
    }

    return this.actionLabel(action);
  }

  public closeLabel(item: NotificationItem): string {
    return this.translateText(item.closeButtonLabel);
  }

  public handleClick(item: NotificationItem, event: Event): void {
    item.onClick?.(item, event);
    if (item.closeOnClick && item.dismissible) {
      this.notifications.dismiss(item.id, 'manual');
    }
  }

  public handleDismiss(item: NotificationItem, event?: Event): void {
    event?.stopPropagation();
    if (!item.dismissible) return;
    this.notifications.dismiss(item.id, 'manual');
  }

  public handleAction(item: NotificationItem, action: NotificationAction, event: Event): void {
    event.stopPropagation();
    action.callback?.(item, action);
    if (action.dismiss !== false) {
      this.notifications.dismiss(item.id, 'action');
    }
  }

  public handleMouseEnter(item: NotificationItem): void {
    if (item.pauseOnHover) {
      this.notifications.pause(item.id);
    }
  }

  public handleMouseLeave(item: NotificationItem): void {
    if (item.pauseOnHover) {
      this.notifications.resume(item.id);
    }
  }

  public handleFocusIn(item: NotificationItem): void {
    if (item.pauseOnFocus) {
      this.notifications.pause(item.id);
    }
  }

  public handleFocusOut(item: NotificationItem): void {
    if (item.pauseOnFocus) {
      this.notifications.resume(item.id);
    }
  }

  public progressStyle(item: NotificationItem): string {
    return `--au-notification-duration: ${item.duration}ms;`;
  }

  public shouldShowProgress(item: NotificationItem): boolean {
    return item.showProgress && item.autoDismiss && item.duration > 0;
  }

  private updateItemsByPosition(): void {
    const positions = this.positions.length
      ? this.positions
      : this.notifications.getPositions();
    const next = {} as Record<NotificationPosition, NotificationItem[]>;
    for (const position of positions) {
      next[position] = this.notifications.getItemsForPosition(position);
    }
    this.itemsByPosition = next;
  }

  private translateText(message?: NotificationMessage): string {
    if (!message) return '';
    const _ = this.translationVersion;
    const translated = this.notifications.translate(message);
    if (Array.isArray(translated)) {
      return translated.join(' ');
    }

    return String(translated);
  }

  private mergeClasses(...values: Array<string | undefined>): string {
    return values
      .filter((value) => Boolean(value))
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .join(' ');
  }
}
