import type { SsrDomEnvironment, SsrDomEnvironmentOptions, SsrDomGlobalOptions } from './types.js';

type GlobalRecord = typeof globalThis & Record<string, unknown>;
type WindowRecord = Window & Record<string, unknown>;
type DescriptorMap = Map<string, PropertyDescriptor | undefined>;

export const defaultDomGlobalKeys = [
  'window',
  'document',
  'location',
  'navigator',
  'history',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'HTMLSelectElement',
  'HTMLFormElement',
  'customElements',
  'Node',
  'Element',
  'Text',
  'Comment',
  'DocumentFragment',
  'MutationObserver',
  'CSSStyleSheet',
  'ShadowRoot',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'InputEvent',
  'FocusEvent',
  'FormData',
  'File',
  'Blob',
  'URL',
  'URLSearchParams',
  'getComputedStyle',
  'crypto',
  'localStorage',
  'sessionStorage',
] as const;

const observerGlobalKeys = [
  'ResizeObserver',
  'IntersectionObserver',
] as const;

const animationFrameGlobalKeys = [
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const;

export function installDomGlobals(window: Window, options: SsrDomGlobalOptions = {}): () => void {
  const keys = buildGlobalKeyList(options);
  installMissingBrowserShims(window, options);

  const previous: DescriptorMap = new Map();
  const globalRecord = globalThis as GlobalRecord;
  const windowRecord = window as WindowRecord;

  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    if (descriptor?.configurable === false) {
      continue;
    }

    previous.set(key, descriptor);

    if (key in windowRecord) {
      Object.defineProperty(globalRecord, key, {
        configurable: true,
        value: windowRecord[key],
        writable: true,
      });
    }
  }

  return () => restoreDomGlobals(previous);
}

export function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear(): void {
      values.clear();
    },
    getItem(key: string): string | null {
      return values.has(key) ? values.get(key)! : null;
    },
    key(index: number): string | null {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      values.delete(key);
    },
    setItem(key: string, value: string): void {
      values.set(key, String(value));
    },
  };
}

export async function createJSDOMEnvironment(options: SsrDomEnvironmentOptions = {}): Promise<SsrDomEnvironment> {
  const jsdomModule = await import('jsdom');
  const JSDOM = jsdomModule.JSDOM as unknown as new (html?: string, options?: Record<string, unknown>) => {
    window: Window;
    serialize: () => string;
  };

  return createJSDOMEnvironmentFromConstructor(JSDOM, options);
}

export function createJSDOMEnvironmentFromConstructor(
  JSDOM: new (html?: string, options?: Record<string, unknown>) => { window: Window; serialize?: () => string },
  options: SsrDomEnvironmentOptions = {},
): SsrDomEnvironment {
  const dom = new JSDOM(
    options.html ?? '<!doctype html><html><head><base href="/"></head><body></body></html>',
    {
      pretendToBeVisual: options.pretendToBeVisual ?? true,
      url: options.url ?? 'http://localhost/',
    },
  );

  return {
    window: dom.window,
    document: dom.window.document,
    close: () => dom.window.close(),
    serialize: dom.serialize ? () => dom.serialize!() : undefined,
  };
}

function buildGlobalKeyList(options: SsrDomGlobalOptions): string[] {
  const keys = new Set<string>(options.keys ?? defaultDomGlobalKeys);

  if (options.includeObservers ?? true) {
    observerGlobalKeys.forEach(key => keys.add(key));
  }

  if (options.includeAnimationFrame ?? true) {
    animationFrameGlobalKeys.forEach(key => keys.add(key));
  }

  if (options.includeMatchMedia ?? true) {
    keys.add('matchMedia');
  }

  if (options.includeStorage ?? true) {
    keys.add('localStorage');
    keys.add('sessionStorage');
  }

  return Array.from(keys);
}

function restoreDomGlobals(previous: DescriptorMap): void {
  const globalRecord = globalThis as GlobalRecord;

  for (const [key, descriptor] of Array.from(previous.entries()).reverse()) {
    if (descriptor) {
      Object.defineProperty(globalRecord, key, descriptor);
    } else {
      delete globalRecord[key];
    }
  }
}

function installMissingBrowserShims(window: Window, options: SsrDomGlobalOptions): void {
  const record = window as WindowRecord;

  if ((options.includeStorage ?? true) && !safeGet(record, 'localStorage')) {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createMemoryStorage(),
    });
  }

  if ((options.includeStorage ?? true) && !safeGet(record, 'sessionStorage')) {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: createMemoryStorage(),
    });
  }

  if ((options.includeAnimationFrame ?? true) && !record.requestAnimationFrame) {
    record.requestAnimationFrame = (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(Date.now()), 16);
    };
  }

  if ((options.includeAnimationFrame ?? true) && !record.cancelAnimationFrame) {
    record.cancelAnimationFrame = (handle: number) => {
      window.clearTimeout(handle);
    };
  }

  if ((options.includeMatchMedia ?? true) && !record.matchMedia) {
    record.matchMedia = (query: string): MediaQueryList => {
      return createMatchMediaList(query);
    };
  }

  if ((options.includeObservers ?? true) && !record.ResizeObserver) {
    record.ResizeObserver = class NoopResizeObserver {
      public observe(): void {}
      public unobserve(): void {}
      public disconnect(): void {}
    };
  }

  if ((options.includeObservers ?? true) && !record.IntersectionObserver) {
    record.IntersectionObserver = class NoopIntersectionObserver {
      public readonly root = null;
      public readonly rootMargin = '0px';
      public readonly thresholds = [0];
      public observe(): void {}
      public unobserve(): void {}
      public disconnect(): void {}
      public takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    };
  }
}

function safeGet(record: WindowRecord, key: string): unknown {
  try {
    return record[key];
  } catch {
    return undefined;
  }
}

function createMatchMediaList(query: string): MediaQueryList {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const list = {
    matches: false,
    media: query,
    onchange: null,
    addListener(listener: (event: MediaQueryListEvent) => void): void {
      listeners.add(listener);
    },
    removeListener(listener: (event: MediaQueryListEvent) => void): void {
      listeners.delete(listener);
    },
    addEventListener(_type: string, listener: EventListenerOrEventListenerObject): void {
      if (typeof listener === 'function') {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      }
    },
    removeEventListener(_type: string, listener: EventListenerOrEventListenerObject): void {
      if (typeof listener === 'function') {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      }
    },
    dispatchEvent(event: Event): boolean {
      for (const listener of listeners) {
        listener(event as MediaQueryListEvent);
      }
      return true;
    },
  };

  return list as MediaQueryList;
}
