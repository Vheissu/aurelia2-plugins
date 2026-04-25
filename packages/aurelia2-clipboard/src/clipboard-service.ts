import { DI } from 'aurelia';
import type { ClipboardConfigurationOptions, ClipboardOptions, ClipboardResult } from './types';

export class ClipboardService {
  private options: Required<ClipboardConfigurationOptions> = {
    preferNative: true,
    trim: false,
  };

  public configure(options: ClipboardConfigurationOptions = {}): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  public isSupported(): boolean {
    return Boolean(this.getNativeClipboard()?.writeText || this.canUseFallback());
  }

  public canRead(): boolean {
    return Boolean(this.getNativeClipboard()?.readText);
  }

  public async copy(text: string, options: ClipboardOptions = {}): Promise<ClipboardResult> {
    const merged = { ...this.options, ...options };
    const value = merged.trim ? text.trim() : text;
    const nativeClipboard = this.getNativeClipboard();

    if (merged.preferNative && nativeClipboard?.writeText) {
      await nativeClipboard.writeText(value);
      return { text: value, native: true };
    }

    this.copyWithFallback(value);
    return { text: value, native: false };
  }

  public async read(): Promise<string> {
    const nativeClipboard = this.getNativeClipboard();
    if (!nativeClipboard?.readText) {
      throw new Error('Clipboard read is not supported in this environment.');
    }

    return nativeClipboard.readText();
  }

  private getNativeClipboard(): Clipboard | null {
    if (typeof navigator === 'undefined') return null;
    return navigator.clipboard ?? null;
  }

  private canUseFallback(): boolean {
    return typeof document !== 'undefined'
      && typeof document.createElement === 'function'
      && typeof document.execCommand === 'function';
  }

  private copyWithFallback(text: string): void {
    if (!this.canUseFallback()) {
      throw new Error('Clipboard write is not supported in this environment.');
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';

    document.body.appendChild(textarea);
    textarea.select();

    try {
      const copied = document.execCommand('copy');
      if (!copied) {
        throw new Error('document.execCommand("copy") returned false.');
      }
    } finally {
      textarea.remove();
    }
  }
}

export const IClipboardService = DI.createInterface<IClipboardService>('IClipboardService', x => x.singleton(ClipboardService));
export interface IClipboardService extends ClipboardService {}
