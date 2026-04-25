export interface ResizeChange {
  target: Element;
  entry: ResizeObserverEntry | null;
  width: number;
  height: number;
}

export type ResizeCallback = (change: ResizeChange) => void;

export type ResizeObserverFactory = (
  callback: ResizeObserverCallback
) => ResizeObserver;

export interface ResizeConfigurationOptions {
  box?: ResizeObserverBoxOptions;
  observerFactory?: ResizeObserverFactory;
}

export interface ResizeDispose {
  dispose(): void;
}
