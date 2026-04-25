export type HotkeyTarget = 'document' | 'window' | 'element' | EventTarget;
export type HotkeyEventName = 'keydown' | 'keyup';
export type HotkeyCallback = (event: KeyboardEvent, combo: string) => void;

export interface HotkeyRegistration {
  keys: string | string[];
  callback: HotkeyCallback;
  target?: HotkeyTarget;
  event?: HotkeyEventName;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enabled?: () => boolean;
}

export interface HotkeyDispose {
  dispose(): void;
}

export interface HotkeyConfigurationOptions {
  target?: HotkeyTarget;
  event?: HotkeyEventName;
  preventDefault?: boolean;
}
