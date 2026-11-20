import { DI } from 'aurelia';
import type { FocusTrapConfigurationOptions, FocusTrapHandle, FocusTrapOptions } from './types';

const selector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

const activeTraps = new WeakMap<Document, symbol[]>();

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
    const document = element.ownerDocument;
    let activation: symbol | undefined;
    let addedTabIndex = false;
    let previousFocus: HTMLElement | null = null;

    const getFocusable = (): HTMLElement[] => findFocusable(element);
    const focusContainer = (): void => {
      if (!element.hasAttribute('tabindex')) {
        element.setAttribute('tabindex', '-1');
        addedTabIndex = true;
      }
      element.focus();
    };

    const onKeydown = (event: KeyboardEvent): void => {
      if (!activation || activeTraps.get(document)?.at(-1) !== activation || event.defaultPrevented) return;

      if (event.key === 'Escape' && (options.escapeDeactivates ?? this.options.escapeDeactivates)) {
        options.onEscape?.(event);
        handle.deactivate();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        focusContainer();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      const outside = !element.contains(current) || current === element;

      if (event.shiftKey && (current === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    const handle: FocusTrapHandle = {
      activate: () => {
        if (activation) return;
        const current = activation = Symbol();
        const stack = activeTraps.get(document) ?? [];
        stack.push(current);
        activeTraps.set(document, stack);
        previousFocus = document.activeElement as HTMLElement | null;
        document.addEventListener('keydown', onKeydown);
        queueMicrotask(() => {
          if (activation !== current || stack.at(-1) !== current) return;
          const initial = resolveInitialFocus(element, options.initialFocus);
          const target = initial ?? getFocusable()[0];
          if (target && target !== element) target.focus();
          else focusContainer();
        });
      },
      deactivate: () => {
        if (!activation) return;
        const stack = activeTraps.get(document)!;
        const wasTop = stack.at(-1) === activation;
        stack.splice(stack.indexOf(activation), 1);
        if (stack.length === 0) activeTraps.delete(document);
        activation = undefined;
        document.removeEventListener('keydown', onKeydown);
        if (addedTabIndex && element.getAttribute('tabindex') === '-1') {
          element.removeAttribute('tabindex');
        }
        addedTabIndex = false;
        if (wasTop && (options.returnFocus ?? this.options.returnFocus) && previousFocus?.isConnected) {
          previousFocus.focus?.();
        }
        previousFocus = null;
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
      if (entry.matches(':disabled, input[type="hidden"]')) return false;
      if (entry.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
      return entry.tabIndex >= 0;
    });
}

function resolveInitialFocus(element: HTMLElement, initial: string | HTMLElement | null | undefined): HTMLElement | null {
  if (!initial) return null;
  if (typeof initial === 'string') return element.querySelector<HTMLElement>(initial);
  return element.contains(initial) ? initial : null;
}
