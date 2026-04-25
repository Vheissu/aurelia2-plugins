import { DI } from 'aurelia';
import type {
  IntersectionCallback,
  IntersectionConfigurationOptions,
  IntersectionDispose,
  IntersectionObserverFactory,
} from './types';

export class IntersectionService {
  private options: IntersectionConfigurationOptions = {};
  private observerFactory: IntersectionObserverFactory | null = null;

  public configure(options: IntersectionConfigurationOptions = {}): void {
    const { observerFactory, ...observerOptions } = options;
    this.observerFactory = observerFactory ?? null;
    this.options = observerOptions;
  }

  public isSupported(): boolean {
    return Boolean(this.observerFactory || typeof IntersectionObserver !== 'undefined');
  }

  public observe(
    element: Element,
    callback: IntersectionCallback,
    options: IntersectionObserverInit = {}
  ): IntersectionDispose {
    const observerOptions = this.mergeOptions(options);

    if (!this.isSupported()) {
      let disposed = false;
      queueMicrotask(() => {
        if (!disposed) {
          callback(createFallbackChange(element));
        }
      });
      return {
        dispose() {
          disposed = true;
        },
      };
    }

    const observer = this.createObserver((entries) => {
      for (const entry of entries) {
        const visible = entry.isIntersecting || entry.intersectionRatio > 0;
        callback({
          target: entry.target,
          entry,
          visible,
          ratio: entry.intersectionRatio,
        });
      }
    }, observerOptions);

    observer.observe(element);

    return {
      dispose() {
        observer.unobserve(element);
        observer.disconnect();
      },
    };
  }

  private createObserver(callback: IntersectionObserverCallback, options?: IntersectionObserverInit): IntersectionObserver {
    if (this.observerFactory) {
      return this.observerFactory(callback, options);
    }

    return new IntersectionObserver(callback, options);
  }

  private mergeOptions(options: IntersectionObserverInit): IntersectionObserverInit {
    return {
      root: options.root ?? this.options.root ?? null,
      rootMargin: options.rootMargin ?? this.options.rootMargin,
      threshold: options.threshold ?? this.options.threshold,
    };
  }
}

export const IIntersectionService = DI.createInterface<IIntersectionService>('IIntersectionService', x => x.singleton(IntersectionService));
export interface IIntersectionService extends IntersectionService {}

function createFallbackChange(target: Element) {
  const rect = target.getBoundingClientRect();
  const entry = {
    boundingClientRect: rect,
    intersectionRatio: 1,
    intersectionRect: rect,
    isIntersecting: true,
    rootBounds: null,
    target,
    time: Date.now(),
  } as IntersectionObserverEntry;

  return {
    target,
    entry,
    visible: true,
    ratio: 1,
  };
}
