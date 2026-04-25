import { bindable, customAttribute, INode, resolve } from 'aurelia';
import { IHotkeyService, hotkeyMatches, normalizeKeys } from './hotkey-service';
import type { HotkeyCallback, HotkeyDispose, HotkeyEventName, HotkeyTarget } from './types';

@customAttribute({ name: 'hotkey', defaultProperty: 'keys' })
export class HotkeyCustomAttribute {
  @bindable public keys: string | string[] = '';
  @bindable public callback: HotkeyCallback | null = null;
  @bindable public target: HotkeyTarget = 'document';
  @bindable public event: HotkeyEventName = 'keydown';
  @bindable public preventDefault = true;
  @bindable public stopPropagation = false;
  @bindable public disabled = false;
  @bindable public click = false;

  private readonly element = resolve(INode) as HTMLElement;
  private readonly hotkeys = resolve(IHotkeyService);
  private disposable: HotkeyDispose | null = null;
  private isAttached = false;

  public attached(): void {
    this.isAttached = true;
    this.restart();
  }

  public detached(): void {
    this.isAttached = false;
    this.stop();
  }

  public keysChanged(): void {
    this.restart();
  }

  public targetChanged(): void {
    this.restart();
  }

  public eventChanged(): void {
    this.restart();
  }

  public disabledChanged(): void {
    this.restart();
  }

  private restart(): void {
    if (!this.isAttached) return;
    this.stop();
    if (this.disabled || normalizeKeys(this.keys).length === 0) return;

    this.disposable = this.hotkeys.register({
      keys: this.keys,
      target: this.target === 'element' ? this.element : this.target,
      event: this.event,
      preventDefault: this.preventDefault,
      stopPropagation: this.stopPropagation,
      callback: this.handleHotkey,
    });
  }

  private stop(): void {
    this.disposable?.dispose();
    this.disposable = null;
  }

  private handleHotkey = (event: KeyboardEvent, combo: string): void => {
    if (!hotkeyMatches(event, combo)) return;

    if (this.click) {
      this.element.click();
    }

    this.callback?.(event, combo);
    this.element.dispatchEvent(new CustomEvent('hotkey-trigger', {
      bubbles: true,
      detail: {
        event,
        combo,
      },
    }));
  };
}
