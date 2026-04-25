import { DI } from 'aurelia';
import type { HotkeyConfigurationOptions, HotkeyDispose, HotkeyRegistration, HotkeyTarget } from './types';

const modifierAliases = new Map([
  ['cmd', 'meta'],
  ['command', 'meta'],
  ['option', 'alt'],
  ['esc', 'escape'],
  ['return', 'enter'],
  ['spacebar', ' '],
  ['space', ' '],
  ['plus', '+'],
]);

export class HotkeyService {
  private options: Required<Pick<HotkeyConfigurationOptions, 'event' | 'preventDefault'>> & { target: HotkeyTarget } = {
    target: 'document',
    event: 'keydown',
    preventDefault: true,
  };

  public configure(options: HotkeyConfigurationOptions = {}): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  public register(registration: HotkeyRegistration): HotkeyDispose {
    const target = this.resolveTarget(registration.target ?? this.options.target);
    const eventName = registration.event ?? this.options.event;
    const combos = normalizeKeys(registration.keys);
    const listener = (event: Event): void => {
      const keyboardEvent = event as KeyboardEvent;
      const combo = combos.find((candidate) => hotkeyMatches(keyboardEvent, candidate));
      if (!combo || registration.enabled?.() === false) return;

      if (registration.preventDefault ?? this.options.preventDefault) {
        keyboardEvent.preventDefault();
      }
      if (registration.stopPropagation) {
        keyboardEvent.stopPropagation();
      }

      registration.callback(keyboardEvent, combo);
    };

    target.addEventListener(eventName, listener);

    return {
      dispose() {
        target.removeEventListener(eventName, listener);
      },
    };
  }

  public matches(event: KeyboardEvent, keys: string | string[]): boolean {
    return normalizeKeys(keys).some((combo) => hotkeyMatches(event, combo));
  }

  public resolveTarget(target: HotkeyTarget): EventTarget {
    if (target === 'window') return window;
    if (target === 'document') return document;
    if (target === 'element') {
      throw new Error('Hotkey target "element" must be resolved by the hotkey attribute.');
    }
    return target;
  }
}

export const IHotkeyService = DI.createInterface<IHotkeyService>('IHotkeyService', x => x.singleton(HotkeyService));
export interface IHotkeyService extends HotkeyService {}

export function normalizeKeys(keys: string | string[]): string[] {
  return (Array.isArray(keys) ? keys : keys.split(','))
    .map((combo) => combo.trim().toLowerCase())
    .filter(Boolean);
}

export function hotkeyMatches(event: KeyboardEvent, combo: string): boolean {
  const parts = combo.split('+').map((part) => normalizePart(part));
  const expected = {
    alt: parts.includes('alt'),
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    meta: parts.includes('meta'),
    shift: parts.includes('shift'),
  };
  const key = parts.find((part) => !['alt', 'ctrl', 'control', 'meta', 'shift'].includes(part));

  if (event.altKey !== expected.alt) return false;
  if (event.ctrlKey !== expected.ctrl) return false;
  if (event.metaKey !== expected.meta) return false;
  if (event.shiftKey !== expected.shift) return false;

  return !key || normalizePart(event.key) === key;
}

function normalizePart(part: string): string {
  const normalized = part.trim().toLowerCase();
  return modifierAliases.get(normalized) ?? normalized;
}
