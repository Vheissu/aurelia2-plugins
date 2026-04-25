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
  @bindable public trim = false;
  @bindable public success: ClipboardCallback | null = null;
  @bindable public error: ClipboardErrorCallback | null = null;

  private readonly element = resolve(INode) as HTMLElement;
  private readonly clipboard = resolve(IClipboardService);

  public attached(): void {
    this.element.addEventListener(this.event, this.onTrigger as EventListener);
  }

  public detached(): void {
    this.element.removeEventListener(this.event, this.onTrigger as EventListener);
  }

  public eventChanged(newValue: keyof HTMLElementEventMap, oldValue: keyof HTMLElementEventMap): void {
    if (!oldValue || oldValue === newValue) return;
    this.element.removeEventListener(oldValue, this.onTrigger as EventListener);
    this.element.addEventListener(newValue, this.onTrigger as EventListener);
  }

  private onTrigger = (event: Event): void => {
    if (this.disabled) return;
    if (this.preventDefault) {
      event.preventDefault();
    }

    void this.copy(event);
  };

  private async copy(event: Event): Promise<void> {
    try {
      const result = await this.clipboard.copy(this.resolveText(), { trim: this.trim });
      this.success?.(result);
      this.dispatch('clipboard-copy', result, event);
    } catch (error) {
      this.error?.(error);
      this.dispatch('clipboard-error', error, event);
    }
  }

  private resolveText(): string {
    if (this.text !== null && this.text !== undefined) {
      return String(this.text);
    }

    if (this.selector) {
      const target = document.querySelector(this.selector);
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
