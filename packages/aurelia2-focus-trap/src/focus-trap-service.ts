import { DI } from 'aurelia';
import type { FocusTrapConfigurationOptions, FocusTrapHandle, FocusTrapOptions } from './types';

const selector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export class FocusTrapService {
  private options: Required<FocusTrapConfigurationOptions> = {
    returnFocus: true,
    escapeDeactivates: true,
  };

  public configure(options: FocusTrapConfigurationOptions = {}): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  public create(element: HTMLElement, options: FocusTrapOptions = {}): FocusTrapHandle {
    let active = false;
    let previousFocus: HTMLElement | null = null;

    const getFocusable = (): HTMLElement[] => findFocusable(element);
    const focusInitial = (): void => {
      const initial = resolveInitialFocus(element, options.initialFocus);
      const target = initial ?? getFocusable()[0] ?? element;
      if (!target.hasAttribute('tabindex') && target === element) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus();
    };

    const onKeydown = (event: KeyboardEvent): void => {
      if (!active) return;

      if (event.key === 'Escape' && (options.escapeDeactivates ?? this.options.escapeDeactivates)) {
        options.onEscape?.(event);
        handle.deactivate();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        element.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handle: FocusTrapHandle = {
      activate: () => {
        if (active) return;
        active = true;
        previousFocus = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
        document.addEventListener('keydown', onKeydown);
        queueMicrotask(focusInitial);
      },
      deactivate: () => {
        if (!active) return;
        active = false;
        document.removeEventListener('keydown', onKeydown);
        if ((options.returnFocus ?? this.options.returnFocus) && previousFocus?.isConnected) {
          previousFocus.focus();
        }
      },
      dispose: () => {
        handle.deactivate();
      },
    };

    if (options.active !== false) {
      handle.activate();
    }

    return handle;
  }
}

export const IFocusTrapService = DI.createInterface<IFocusTrapService>('IFocusTrapService', x => x.singleton(FocusTrapService));
export interface IFocusTrapService extends FocusTrapService {}

export function findFocusable(element: HTMLElement): HTMLElement[] {
  return Array.from(element.querySelectorAll<HTMLElement>(selector))
    .filter((entry) => {
      if (entry.hasAttribute('disabled')) return false;
      if (entry.getAttribute('aria-hidden') === 'true') return false;
      return entry.tabIndex >= 0;
    });
}

function resolveInitialFocus(element: HTMLElement, initial: string | HTMLElement | null | undefined): HTMLElement | null {
  if (!initial) return null;
  if (initial instanceof HTMLElement) return initial;
  return element.querySelector<HTMLElement>(initial);
}
