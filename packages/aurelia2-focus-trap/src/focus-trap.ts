import { bindable, customAttribute, INode, resolve } from 'aurelia';
import { IFocusTrapService } from './focus-trap-service';
import type { FocusTrapHandle } from './types';

@customAttribute({ name: 'focus-trap', defaultProperty: 'active' })
export class FocusTrapCustomAttribute {
  @bindable public active = true;
  @bindable public initialFocus: string | HTMLElement | null = null;
  @bindable public returnFocus = true;
  @bindable public escapeDeactivates = true;
  @bindable public escape: ((event: KeyboardEvent) => void) | null = null;

  private readonly element = resolve(INode) as HTMLElement;
  private readonly traps = resolve(IFocusTrapService);
  private handle: FocusTrapHandle | null = null;
  private isAttached = false;

  public attached(): void {
    this.isAttached = true;
    this.sync();
  }

  public detached(): void {
    this.isAttached = false;
    this.handle?.dispose();
    this.handle = null;
  }

  public activeChanged(): void {
    this.sync();
  }

  public initialFocusChanged(): void {
    this.recreate();
  }

  public returnFocusChanged(): void {
    this.recreate();
  }

  public escapeDeactivatesChanged(): void {
    this.recreate();
  }

  private sync(): void {
    if (!this.isAttached) return;

    if (!this.handle) {
      this.handle = this.traps.create(this.element, {
        active: this.active,
        initialFocus: this.initialFocus,
        returnFocus: this.returnFocus,
        escapeDeactivates: this.escapeDeactivates,
        onEscape: this.handleEscape,
      });
      return;
    }

    if (this.active) {
      this.handle.activate();
    } else {
      this.handle.deactivate();
    }
  }

  private recreate(): void {
    if (!this.isAttached) return;
    this.handle?.dispose();
    this.handle = null;
    this.sync();
  }

  private handleEscape = (event: KeyboardEvent): void => {
    this.escape?.(event);
    this.element.dispatchEvent(new CustomEvent('focus-trap-escape', {
      bubbles: true,
      detail: event,
    }));
  };
}
