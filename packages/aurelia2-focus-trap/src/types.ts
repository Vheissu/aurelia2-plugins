export interface FocusTrapOptions {
  active?: boolean;
  initialFocus?: string | HTMLElement | null;
  returnFocus?: boolean;
  escapeDeactivates?: boolean;
  onEscape?: (event: KeyboardEvent) => void;
}

export interface FocusTrapHandle {
  activate(): void;
  deactivate(): void;
  dispose(): void;
}

export interface FocusTrapConfigurationOptions {
  returnFocus?: boolean;
  escapeDeactivates?: boolean;
}
