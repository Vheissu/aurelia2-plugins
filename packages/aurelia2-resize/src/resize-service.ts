import { DI } from 'aurelia';
import type { ResizeCallback, ResizeChange, ResizeConfigurationOptions, ResizeDispose, ResizeObserverFactory } from './types';

export class ResizeService {
  private box: ResizeObserverBoxOptions | undefined = undefined;
  private observerFactory: ResizeObserverFactory | null = null;

  public configure(options: ResizeConfigurationOptions = {}): void {
    this.box = options.box;
    this.observerFactory = options.observerFactory ?? null;
  }

  public isSupported(): boolean {
    return Boolean(this.observerFactory || typeof ResizeObserver !== 'undefined');
  }

  public observe(element: Element, callback: ResizeCallback, box = this.box): ResizeDispose {
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
        callback(createChange(entry));
      }
    });

    observer.observe(element, box ? { box } : undefined);

    return {
      dispose() {
        observer.unobserve(element);
        observer.disconnect();
      },
    };
  }

  private createObserver(callback: ResizeObserverCallback): ResizeObserver {
    if (this.observerFactory) {
      return this.observerFactory(callback);
    }

    return new ResizeObserver(callback);
  }
}

export const IResizeService = DI.createInterface<IResizeService>('IResizeService', x => x.singleton(ResizeService));
export interface IResizeService extends ResizeService {}

function createChange(entry: ResizeObserverEntry): ResizeChange {
  const boxSize = Array.isArray(entry.contentBoxSize) ? entry.contentBoxSize[0] : entry.contentBoxSize;
  const width = boxSize?.inlineSize ?? entry.contentRect.width;
  const height = boxSize?.blockSize ?? entry.contentRect.height;

  return {
    target: entry.target,
    entry,
    width,
    height,
  };
}

function createFallbackChange(target: Element): ResizeChange {
  const rect = target.getBoundingClientRect();
  return {
    target,
    entry: null,
    width: rect.width,
    height: rect.height,
  };
}
