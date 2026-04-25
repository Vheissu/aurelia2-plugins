export interface IntersectionChange {
  target: Element;
  entry: IntersectionObserverEntry;
  visible: boolean;
  ratio: number;
}

export type IntersectionCallback = (change: IntersectionChange) => void;

export type IntersectionObserverFactory = (
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
) => IntersectionObserver;

export interface IntersectionConfigurationOptions extends IntersectionObserverInit {
  observerFactory?: IntersectionObserverFactory;
}

export interface IntersectionDispose {
  dispose(): void;
}
