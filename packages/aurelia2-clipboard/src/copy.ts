import { bindable, customAttribute, INode, resolve } from 'aurelia';
import { IClipboardService } from './clipboard-service';
import type { ClipboardCallback, ClipboardErrorCallback, ClipboardResult } from './types';

@customAttribute({ name: 'copy', defaultProperty: 'text' })
export class CopyCustomAttribute {
  @bindable public text: string | null = null;
  @bindable public selector: string | null = null;
  @bindable public event: keyof HTMLElementEventMap = 'click';
  @bindable public disabled = false;
  @bindable public preventDefault = true;
  @bindable public trim?: boolean;
  @bindable public success: ClipboardCallback | null = null;
  @bindable public error: ClipboardErrorCallback | null = null;

  private readonly element = resolve(INode) as HTMLElement;
  private readonly clipboard = resolve(IClipboardService);
  private listening?: keyof HTMLElementEventMap;
  private attachment = 0;

  public attached(): void {
    this.listening = this.event;
    this.element.addEventListener(this.listening, this.onTrigger);
  }

  public detaching(): void {
    this.attachment++;
    if (this.listening) this.element.removeEventListener(this.listening, this.onTrigger);
    this.listening = undefined;
  }

  public eventChanged(): void {
    if (!this.listening || this.listening === this.event) return;
    this.element.removeEventListener(this.listening, this.onTrigger);
    this.attached();
  }

  private onTrigger = (event: Event): void => {
    if (this.disabled) return;
    if (this.preventDefault) {
      event.preventDefault();
    }

    void this.copy(event);
  };

  private async copy(event: Event): Promise<void> {
    const attachment = this.attachment;
    let result: ClipboardResult;
    try {
      result = await this.clipboard.copy(
        this.resolveText(),
        this.trim === undefined ? undefined : { trim: this.trim },
      );
    } catch (error) {
      if (attachment !== this.attachment) return;
      this.error?.(error);
      this.dispatch('clipboard-error', error, event);
      return;
    }
    if (attachment !== this.attachment) return;
    this.success?.(result);
    this.dispatch('clipboard-copy', result, event);
  }

  private resolveText(): string {
    if (this.text !== null && this.text !== undefined) {
      return String(this.text);
    }

    if (this.selector) {
      const target = this.element.ownerDocument.querySelector(this.selector);
      if (!target) return '';

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return target.value;
      }

      return target.textContent ?? '';
    }

    return this.element instanceof HTMLInputElement || this.element instanceof HTMLTextAreaElement
      ? this.element.value
      : this.element.textContent ?? '';
  }

  private dispatch(name: string, detail: unknown, trigger: Event): void {
    this.element.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      detail: {
        result: detail,
        trigger,
      },
    }));
  }
}
