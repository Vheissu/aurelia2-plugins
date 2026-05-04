import { safeJson } from './html.js';
import type { SsrPrebootConfig } from './types.js';

export interface AureliaSsrPreboot {
  replay?: () => void;
  cleanup?: () => void;
  state?: unknown;
}

declare global {
  interface Window {
    __AURELIA_SSR_PREBOOT__?: AureliaSsrPreboot;
  }
}

const defaultPrebootConfig: Required<SsrPrebootConfig> = {
  enabled: true,
  maxEvents: 80,
  replayAfterMs: 250,
  captureClick: true,
  captureSubmit: true,
  captureInput: true,
  captureFocus: true,
  captureKeydown: false,
  preventDefaultFor: ['submit'],
  selectors: ['data-ssr-key', 'id', 'name', 'aria-label'],
};

export function createPrebootScript(options: SsrPrebootConfig = {}): string {
  const config = {
    ...defaultPrebootConfig,
    ...options,
    preventDefaultFor: options.preventDefaultFor ?? defaultPrebootConfig.preventDefaultFor,
    selectors: options.selectors ?? defaultPrebootConfig.selectors,
  };

  if (!config.enabled) {
    return '';
  }

  return `(() => {
  if (window.__AURELIA_SSR_PREBOOT__) {
    return;
  }

  const config = ${safeJson(config)};
  const state = {
    events: [],
    values: new Map(),
    focused: null,
    startedAt: Date.now(),
    replayed: false
  };
  const cssEscape = window.CSS && CSS.escape
    ? CSS.escape.bind(CSS)
    : value => String(value).replace(/["\\\\]/g, '\\\\$&');

  function selectorFor(element) {
    if (!element || element.nodeType !== 1) {
      return null;
    }

    for (const key of config.selectors) {
      if (key === 'id' && element.id) {
        return '#' + cssEscape(element.id);
      }

      if (element.hasAttribute && element.hasAttribute(key)) {
        return element.tagName.toLowerCase() + '[' + key + '="' + cssEscape(element.getAttribute(key)) + '"]';
      }
    }

    const parts = [];
    let current = element;
    while (current && current.nodeType === 1 && current !== document.body) {
      let part = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(child => child.tagName === current.tagName);
        if (siblings.length > 1) {
          part += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
        }
      }
      parts.unshift(part);
      current = parent;
    }
    return parts.length ? parts.join(' > ') : null;
  }

  function isField(element) {
    return element instanceof HTMLInputElement
      || element instanceof HTMLTextAreaElement
      || element instanceof HTMLSelectElement;
  }

  function captureValue(event) {
    if (!config.captureInput || !isField(event.target)) {
      return;
    }

    if (event.target instanceof HTMLInputElement && event.target.type === 'file') {
      return;
    }

    const selector = selectorFor(event.target);
    if (!selector) {
      return;
    }

    state.values.set(selector, {
      selector,
      tagName: event.target.tagName,
      type: event.target.type || null,
      value: event.target.value,
      checked: 'checked' in event.target ? event.target.checked : null,
      selectionStart: 'selectionStart' in event.target ? event.target.selectionStart : null,
      selectionEnd: 'selectionEnd' in event.target ? event.target.selectionEnd : null,
      capturedAt: Date.now()
    });
  }

  function captureFocus(event) {
    if (!config.captureFocus) {
      return;
    }

    const selector = selectorFor(event.target);
    if (selector) {
      state.focused = selector;
    }
  }

  function captureEvent(event) {
    const shouldCaptureClick = config.captureClick && event.type === 'click';
    const shouldCaptureSubmit = config.captureSubmit && event.type === 'submit';
    const shouldCaptureKeydown = config.captureKeydown && event.type === 'keydown';
    if (!shouldCaptureClick && !shouldCaptureSubmit && !shouldCaptureKeydown) {
      return;
    }

    const selector = selectorFor(event.target);
    if (!selector || state.events.length >= config.maxEvents) {
      return;
    }

    const record = {
      type: event.type,
      selector,
      button: 'button' in event ? event.button : null,
      key: 'key' in event ? event.key : null,
      capturedAt: Date.now(),
      prevented: false
    };

    if (config.preventDefaultFor.includes(event.type) && event.cancelable) {
      event.preventDefault();
      record.prevented = true;
    }

    state.events.push(record);
  }

  function applyValues() {
    for (const record of state.values.values()) {
      const element = document.querySelector(record.selector);
      if (!element || !isField(element)) {
        continue;
      }

      if ('checked' in element && typeof record.checked === 'boolean') {
        element.checked = record.checked;
      }
      element.value = record.value;

      try {
        if (typeof record.selectionStart === 'number' && typeof record.selectionEnd === 'number' && 'setSelectionRange' in element) {
          element.setSelectionRange(record.selectionStart, record.selectionEnd);
        }
      } catch {
        // Some input types do not allow selection ranges.
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function replayPreventedEvents() {
    for (const record of state.events) {
      if (!record.prevented) {
        continue;
      }

      const element = document.querySelector(record.selector);
      if (!element) {
        continue;
      }

      if (record.type === 'submit' && element instanceof HTMLFormElement) {
        element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      } else if (record.type === 'click') {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: record.button || 0 }));
      }
    }
  }

  function restoreFocus() {
    if (!state.focused) {
      return;
    }

    const element = document.querySelector(state.focused);
    if (element && typeof element.focus === 'function') {
      element.focus();
    }
  }

  function replay() {
    if (state.replayed) {
      return;
    }

    state.replayed = true;
    window.setTimeout(() => {
      applyValues();
      restoreFocus();
      replayPreventedEvents();
      cleanup();
      window.dispatchEvent(new CustomEvent('aurelia:ssr-preboot-replayed', {
        detail: {
          values: state.values.size,
          events: state.events.length,
          focused: state.focused
        }
      }));
    }, config.replayAfterMs);
  }

  function cleanup() {
    document.removeEventListener('input', captureValue, true);
    document.removeEventListener('change', captureValue, true);
    document.removeEventListener('click', captureEvent, true);
    document.removeEventListener('submit', captureEvent, true);
    document.removeEventListener('keydown', captureEvent, true);
    document.removeEventListener('focusin', captureFocus, true);
  }

  document.addEventListener('input', captureValue, true);
  document.addEventListener('change', captureValue, true);
  document.addEventListener('click', captureEvent, true);
  document.addEventListener('submit', captureEvent, true);
  document.addEventListener('keydown', captureEvent, true);
  document.addEventListener('focusin', captureFocus, true);

  window.__AURELIA_SSR_PREBOOT__ = {
    replay,
    cleanup,
    state
  };
})();`;
}

export function injectPrebootScript(document: Document, options: SsrPrebootConfig = {}, nonce?: string): HTMLScriptElement | null {
  if (options.enabled === false) {
    return null;
  }

  const existing = document.head.querySelector<HTMLScriptElement>('script[data-aurelia-ssr-preboot]');
  if (existing) {
    return existing;
  }

  const script = document.createElement('script');
  script.setAttribute('data-aurelia-ssr-preboot', '');
  if (nonce) {
    script.setAttribute('nonce', nonce);
  }
  script.textContent = createPrebootScript(options);

  const clientEntry = document.head.querySelector('script[type="module"]');
  if (clientEntry) {
    document.head.insertBefore(script, clientEntry);
  } else {
    document.head.append(script);
  }

  return script;
}
