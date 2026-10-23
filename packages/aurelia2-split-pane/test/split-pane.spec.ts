import { createFixture } from '@aurelia/testing';
import { runTasks } from 'aurelia';
import { AureliaSplitPaneConfiguration, paneLimits } from '../src/index';
const pointer = (el: Element, type: string, values: Record<string, number> = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, button: 0, clientX: 200, clientY: 150, ...values });
  el.dispatchEvent(event);
  return event;
};
async function setup(orientation = 'horizontal') {
  const f = createFixture(
    '<au-split-pane ratio.two-way="ratio" orientation.bind="orientation" component.ref="view"><p au-slot="first">Editor</p><p au-slot="second">Preview</p></au-split-pane>',
    { ratio: 0.5, orientation, view: undefined as any },
    [AureliaSplitPaneConfiguration],
  );
  await f.startPromise;
  const view = f.component.view;
  jest
    .spyOn(view.layout, 'getBoundingClientRect')
    .mockReturnValue({ width: 408, height: 308, left: 0, top: 0 });
  view.refresh();
  runTasks();
  return { f, view, separator: view.separator as HTMLElement };
}
describe('split panes', () => {
  it('derives limits and distributes undersized containers proportionally', () => {
    expect(paneLimits(400, 80, 60)).toEqual({ min: 80, max: 340 });
    expect(paneLimits(100, 100, 300)).toEqual({ min: 25, max: 25 });
    expect(paneLimits(0, 0, 0)).toEqual({ min: 0, max: 0 });
    expect(() => paneLimits(100, -1, 0)).toThrow();
    expect(() => paneLimits(NaN, 1, 1)).toThrow();
  });
  it('projects panes and exposes correct separator accessibility values', async () => {
    const { f, separator, view } = await setup();
    expect(f.appHost.textContent).toContain('Editor');
    expect(f.appHost.textContent).toContain('Preview');
    expect(view.firstSize).toBe(200);
    runTasks();
    expect(view.layout.firstElementChild.style.flexBasis).toBe('200px');
    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(separator.getAttribute('aria-valuenow')).toBe('50');
    expect(separator.getAttribute('aria-valuemin')).toBe('20');
    expect(separator.getAttribute('aria-valuemax')).toBe('80');
    await f.tearDown();
  });
  it('resizes with keyboard steps and clamps Home/End to configured limits', async () => {
    const { f, separator, view } = await setup();
    const change = jest.fn();
    f.appHost.addEventListener('pane-resize-end', change);
    separator.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    runTasks();
    expect(view.firstSize).toBe(210);
    expect(f.component.ratio).toBe(0.525);
    separator.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
    );
    expect(view.firstSize).toBe(320);
    separator.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }),
    );
    expect(view.firstSize).toBe(80);
    expect(change).toHaveBeenCalledTimes(3);
    await f.tearDown();
  });
  it('supports vertical layouts and ignores the wrong arrow axis', async () => {
    const { f, separator, view } = await setup('vertical');
    expect(separator.getAttribute('aria-orientation')).toBe('horizontal');
    expect(view.layout.style.flexDirection).toBe('column');
    expect(view.firstSize).toBe(150);
    separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(view.firstSize).toBe(150);
    separator.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(view.firstSize).toBeCloseTo(220);
    await f.tearDown();
  });
  it('tracks one pointer, cancels to its starting ratio and emits a completed gesture once', async () => {
    const { f, separator, view } = await setup();
    const ended = jest.fn();
    f.appHost.addEventListener('pane-resize-end', ended);
    pointer(separator, 'pointerdown');
    pointer(separator, 'pointermove', { pointerId: 2, clientX: 300 });
    expect(view.firstSize).toBe(200);
    pointer(separator, 'pointermove', { clientX: 250 });
    expect(view.firstSize).toBe(250);
    pointer(separator, 'pointercancel');
    expect(view.firstSize).toBe(200);
    pointer(separator, 'pointerdown');
    pointer(separator, 'pointermove', { clientX: 260 });
    pointer(separator, 'pointerup');
    pointer(separator, 'lostpointercapture');
    expect(view.firstSize).toBe(260);
    expect(ended).toHaveBeenCalledTimes(1);
    await f.tearDown();
  });
  it('honours RTL direction and disabled interaction', async () => {
    const { f, separator, view } = await setup();
    view.layout.style.direction = 'rtl';
    separator.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    expect(view.firstSize).toBe(190);
    view.disabled = true;
    runTasks();
    pointer(separator, 'pointerdown');
    pointer(separator, 'pointermove', { clientX: 300 });
    expect(view.firstSize).toBe(190);
    expect(separator.tabIndex).toBe(-1);
    await f.tearDown();
  });
  it('disconnects resize observers and releases active pointer capture', async () => {
    const old = window.ResizeObserver;
    const disconnect = jest.fn();
    window.ResizeObserver = class {
      observe() {}
      disconnect = disconnect;
      unobserve() {}
    } as any;
    try {
      const { f, separator } = await setup();
      separator.hasPointerCapture = () => true;
      separator.setPointerCapture = jest.fn();
      separator.releasePointerCapture = jest.fn();
      pointer(separator, 'pointerdown');
      await f.tearDown();
      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(separator.releasePointerCapture).toHaveBeenCalledWith(1);
    } finally {
      window.ResizeObserver = old;
    }
  });
});

it('reconstrains external ratios and changed minimums, preserving ratios while hidden', async () => {
  const { f, view } = await setup();
  f.component.ratio = 0.1;
  runTasks();
  expect(f.component.ratio).toBe(0.2);
  view.minFirst = 120;
  runTasks();
  expect(view.firstSize).toBe(120);
  view.minSecond = 300;
  runTasks();
  expect(view.firstSize).toBeCloseTo((400 * 120) / 420);
  const ratio = f.component.ratio;
  jest.spyOn(view.layout, 'getBoundingClientRect').mockReturnValue({ width: 0, height: 0 });
  view.refresh();
  expect(f.component.ratio).toBe(ratio);
  view.step = 5;
  runTasks();
  f.component.orientation = 'vertical';
  runTasks();
  expect(view.separator.getAttribute('aria-orientation')).toBe('horizontal');
  await f.tearDown();
});

it('normalizes static boolean attributes', async () => {
  const f = createFixture(
    '<au-split-pane disabled component.ref="view"></au-split-pane>',
    { view: undefined as any },
    [AureliaSplitPaneConfiguration],
  );
  await f.startPromise;
  try {
    expect(f.component.view.disabled).toBe(true);
    expect(f.component.view.separator.tabIndex).toBe(-1);
  } finally {
    await f.tearDown();
  }
});

it('keeps dragging stable across layout resizes and scaled ancestors', async () => {
  const { f, view, separator } = await setup();
  Object.defineProperties(view.layout, {
    clientWidth: { value: 408, configurable: true },
    offsetWidth: { value: 408, configurable: true },
  });
  jest
    .spyOn(view.layout, 'getBoundingClientRect')
    .mockReturnValue({ width: 816, height: 308, left: 0, top: 0 });
  view.refresh();
  try {
    pointer(separator, 'pointerdown', { clientX: 400 });
    pointer(separator, 'pointermove', { clientX: 500 });
    runTasks();
    expect(view.firstSize).toBe(250);
    Object.defineProperties(view.layout, {
      clientWidth: { value: 808, configurable: true },
      offsetWidth: { value: 808, configurable: true },
    });
    jest
      .spyOn(view.layout, 'getBoundingClientRect')
      .mockReturnValue({ width: 1616, height: 308, left: 0, top: 0 });
    view.refresh();
    const before = view.firstSize;
    pointer(separator, 'pointermove', { clientX: 520 });
    runTasks();
    expect(view.firstSize).toBeCloseTo(before + 10);
  } finally {
    await f.tearDown();
  }
});
