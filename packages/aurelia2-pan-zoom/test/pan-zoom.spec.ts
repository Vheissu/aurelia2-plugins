import { createFixture } from '@aurelia/testing';
import { runTasks } from 'aurelia';
import { AureliaPanZoomConfiguration, constrain, zoomAt } from '../src/index';
const bounds = {
  width: 400,
  height: 300,
  contentWidth: 1000,
  contentHeight: 1000,
  minScale: 0.1,
  maxScale: 4,
};
const pointer = (el: Element, type: string, values: Record<string, number> = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, button: 0, clientX: 100, clientY: 100, ...values });
  el.dispatchEvent(event);
  return event;
};
async function setup() {
  const f = createFixture(
    '<au-pan-zoom transform.two-way="transform" component.ref="view"><span>Canvas content</span></au-pan-zoom>',
    { transform: { x: 0, y: 0, scale: 1 }, view: undefined as any },
    [AureliaPanZoomConfiguration],
  );
  await f.startPromise;
  const viewport = f.component.view.viewport as HTMLElement;
  jest.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 400,
    height: 300,
    right: 400,
    bottom: 300,
    toJSON() {},
  });
  f.component.view.refresh();
  runTasks();
  return { f, viewport };
}
describe('pan and zoom', () => {
  it('constrains scale/translation and centers content smaller than the viewport', () => {
    expect(constrain({ x: 100, y: -2000, scale: 1 }, bounds)).toEqual({ x: 0, y: -700, scale: 1 });
    expect(constrain({ x: 0, y: 0, scale: 0.1 }, bounds)).toEqual({ x: 150, y: 100, scale: 0.1 });
    expect(constrain({ x: 0, y: 0, scale: 10 }, bounds).scale).toBe(4);
    expect(() => constrain({ x: NaN, y: 0, scale: 1 }, bounds)).toThrow();
    expect(() => constrain({ x: 0, y: 0, scale: 1 }, { ...bounds, minScale: 10 })).toThrow();
  });
  it('zooms around the same world coordinate', () => {
    const old = { x: -100, y: -80, scale: 1 };
    const point = { x: 200, y: 150 };
    const next = zoomAt(old, 2, point, bounds);
    expect((point.x - next.x) / next.scale).toBe((point.x - old.x) / old.scale);
    expect((point.y - next.y) / next.scale).toBe((point.y - old.y) / old.scale);
  });
  it('projects content and pans with captured pointer motion', async () => {
    const { f, viewport } = await setup();
    expect(viewport.textContent).toContain('Canvas content');
    const capture = jest.fn();
    viewport.setPointerCapture = capture;
    pointer(viewport, 'pointerdown');
    pointer(viewport, 'pointermove', { clientX: 50, clientY: 60 });
    runTasks();
    expect(capture).toHaveBeenCalledWith(1);
    expect(f.component.transform).toEqual({ x: -50, y: -40, scale: 1 });
    pointer(viewport, 'pointerup');
    pointer(viewport, 'pointermove', { clientX: 0 });
    expect(f.component.transform.x).toBe(-50);
    await f.tearDown();
  });
  it('pinches with two pointers and rebases to a one-pointer pan', async () => {
    const { f, viewport } = await setup();
    pointer(viewport, 'pointerdown', { pointerId: 1, clientX: 100 });
    pointer(viewport, 'pointerdown', { pointerId: 2, clientX: 200 });
    pointer(viewport, 'pointermove', { pointerId: 2, clientX: 300 });
    runTasks();
    expect(f.component.transform.scale).toBe(2);
    pointer(viewport, 'pointerup', { pointerId: 2 });
    const x = f.component.transform.x;
    pointer(viewport, 'pointermove', { pointerId: 1, clientX: 90 });
    runTasks();
    expect(f.component.transform.x).toBe(x - 10);
    await f.tearDown();
  });
  it('only consumes control-wheel zoom, supports keyboard navigation and fit', async () => {
    const { f, viewport } = await setup();
    const scroll = new WheelEvent('wheel', { deltaY: -100, cancelable: true });
    viewport.dispatchEvent(scroll);
    expect(scroll.defaultPrevented).toBe(false);
    const zoom = new WheelEvent('wheel', {
      ctrlKey: true,
      deltaY: -100,
      clientX: 200,
      clientY: 150,
      cancelable: true,
    });
    viewport.dispatchEvent(zoom);
    runTasks();
    expect(zoom.defaultPrevented).toBe(true);
    expect(f.component.transform.scale).toBeGreaterThan(1);
    viewport.dispatchEvent(
      new KeyboardEvent('keydown', { key: '0', bubbles: true, cancelable: true }),
    );
    runTasks();
    expect(f.component.transform.scale).toBe(0.3);
    expect(
      f.component.view.screenToWorld({ x: f.component.transform.x, y: f.component.transform.y }),
    ).toEqual({ x: 0, y: 0 });
    await f.tearDown();
  });
  it('leaves interactive descendants alone and disables gestures', async () => {
    const { f, viewport } = await setup();
    const input = document.createElement('input');
    viewport.append(input);
    const start = { ...f.component.transform };
    pointer(input, 'pointerdown');
    pointer(viewport, 'pointermove', { clientX: 50 });
    expect(f.component.transform).toEqual(start);
    f.component.view.disabled = true;
    runTasks();
    pointer(viewport, 'pointerdown');
    pointer(viewport, 'pointermove', { clientX: 40 });
    expect(f.component.transform).toEqual(start);
    await f.tearDown();
  });
  it('disconnects resize observation and native wheel listeners on teardown', async () => {
    const disconnect = jest.fn();
    const observe = jest.fn();
    const old = window.ResizeObserver;
    window.ResizeObserver = class {
      observe = observe;
      disconnect = disconnect;
      unobserve() {}
    } as any;
    try {
      const { f, viewport } = await setup();
      expect(observe).toHaveBeenCalled();
      await f.tearDown();
      expect(disconnect).toHaveBeenCalledTimes(1);
      const event = new WheelEvent('wheel', { ctrlKey: true, deltaY: 30, cancelable: true });
      viewport.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    } finally {
      window.ResizeObserver = old;
    }
  });
});

it('reacts to external transforms, changed bounds, keyboard zoom and resize notifications', async () => {
  const { f, viewport } = await setup();
  f.component.transform = { x: -200, y: -100, scale: 2 };
  runTasks();
  expect(viewport.querySelector('div')!.style.transform).toContain('scale(2)');
  f.component.view.maxScale = 1.5;
  runTasks();
  expect(f.component.transform.scale).toBe(1.5);
  f.component.view.contentWidth = 200;
  f.component.view.contentHeight = 100;
  runTasks();
  expect(f.component.transform.x).toBe(50);
  expect(f.component.transform.y).toBe(75);
  f.component.view.contentWidth = 1000;
  f.component.view.contentHeight = 1000;
  runTasks();
  viewport.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
  );
  runTasks();
  expect(f.component.transform.x).toBe(-40);
  viewport.dispatchEvent(
    new KeyboardEvent('keydown', { key: '-', bubbles: true, cancelable: true }),
  );
  runTasks();
  expect(f.component.transform.scale).toBeCloseTo(1.2);
  viewport.dispatchEvent(
    new KeyboardEvent('keydown', { key: '=', bubbles: true, cancelable: true }),
  );
  runTasks();
  expect(f.component.transform.scale).toBe(1.5);
  await f.tearDown();
});

it('normalizes static boolean attributes', async () => {
  const f = createFixture(
    '<au-pan-zoom disabled component.ref="view"></au-pan-zoom>',
    { view: undefined as any },
    [AureliaPanZoomConfiguration],
  );
  await f.startPromise;
  try {
    expect(f.component.view.disabled).toBe(true);
  } finally {
    await f.tearDown();
  }
});

it('uses local CSS pixels inside a scaled ancestor and handles in-place transform updates', async () => {
  const { f, viewport } = await setup();
  Object.defineProperties(viewport, {
    clientWidth: { value: 400, configurable: true },
    offsetWidth: { value: 400, configurable: true },
    clientHeight: { value: 300, configurable: true },
    offsetHeight: { value: 300, configurable: true },
  });
  jest
    .spyOn(viewport, 'getBoundingClientRect')
    .mockReturnValue({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
  f.component.view.refresh();
  try {
    pointer(viewport, 'pointerdown', { clientX: 200 });
    pointer(viewport, 'pointermove', { clientX: 100 });
    runTasks();
    expect(f.component.transform.x).toBe(-50);
    pointer(viewport, 'pointerup');
    f.component.transform.x = 100;
    runTasks();
    expect(f.component.transform.x).toBe(0);
  } finally {
    await f.tearDown();
  }
});
it('preserves the pinch anchor when zooming away from a constrained edge', async () => {
  const { f, viewport } = await setup();
  try {
    pointer(viewport, 'pointerdown', { pointerId: 1, clientX: 0 });
    pointer(viewport, 'pointerdown', { pointerId: 2, clientX: 100 });
    pointer(viewport, 'pointermove', { pointerId: 2, clientX: 80 });
    runTasks();
    expect(f.component.transform.scale).toBeCloseTo(0.8);
    expect(f.component.transform.x).toBe(0);
  } finally {
    await f.tearDown();
  }
});
it('does not intercept plaintext or inherited editable content and ignores a third pointer', async () => {
  const { f, viewport } = await setup();
  const editable = document.createElement('div');
  editable.setAttribute('contenteditable', '');
  viewport.append(editable);
  try {
    expect(pointer(editable, 'pointerdown').defaultPrevented).toBe(false);
    editable.setAttribute('contenteditable', 'plaintext-only');
    expect(pointer(editable, 'pointerdown').defaultPrevented).toBe(false);
    pointer(viewport, 'pointerdown', { pointerId: 1, clientX: 100 });
    pointer(viewport, 'pointerdown', { pointerId: 2, clientX: 200 });
    pointer(viewport, 'pointerdown', { pointerId: 3, clientX: 300 });
    pointer(viewport, 'pointermove', { pointerId: 2, clientX: 300 });
    runTasks();
    expect(f.component.transform.scale).toBe(2);
  } finally {
    await f.tearDown();
  }
});

it('does not duplicate native wheel listeners after restarting the view', async () => {
  const { f, viewport } = await setup();
  try {
    await f.au.stop();
    await f.au.start();
    f.component.view.refresh();
    const old = f.component.view.transform.scale;
    viewport.dispatchEvent(
      new WheelEvent('wheel', {
        ctrlKey: true,
        deltaY: -30,
        clientX: 200,
        clientY: 150,
        cancelable: true,
      }),
    );
    runTasks();
    expect(f.component.view.transform.scale).toBeCloseTo(old * Math.exp(0.1));
  } finally {
    await f.tearDown();
  }
});

it('converts pointer events and world coordinates consistently', async () => {
  const { f } = await setup();
  f.component.transform = { x: -200, y: -100, scale: 2 };
  runTasks();
  try {
    const canvas = f.component.view;
    expect(canvas.clientToWorld({ clientX: 100, clientY: 100 })).toEqual({ x: 150, y: 100 });
    for (const point of [
      { x: 0, y: 0 },
      { x: 150, y: 20 },
      { x: -10, y: 400 },
    ])
      expect(canvas.screenToWorld(canvas.worldToScreen(point))).toEqual(point);
    expect(() => zoomAt({ x: 0, y: 0, scale: 0 }, 2, { x: 0, y: 0 }, bounds)).toThrow(
      'Invalid zoom',
    );
  } finally {
    await f.tearDown();
  }
});
