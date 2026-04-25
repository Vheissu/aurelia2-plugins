import { createFixture } from '@aurelia/testing';
import { AureliaFocusTrapConfiguration, IFocusTrapService, findFocusable } from './../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-focus-trap', () => {
  test('findFocusable returns tabbable controls', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <button id="a"></button>
      <button id="b" disabled></button>
      <a id="c" href="#"></a>
      <div id="d" tabindex="-1"></div>
    `;

    expect(findFocusable(host).map((element) => element.id)).toEqual(['a', 'c']);
  });

  test('service cycles focus and returns focus on escape', async () => {
    const outside = document.body.appendChild(document.createElement('button'));
    outside.id = 'outside';
    outside.focus();

    const { container, appHost, startPromise, tearDown } = createFixture(
      `<div id="dialog">
        <button id="first"></button>
        <button id="last"></button>
      </div>`,
      class {},
      [AureliaFocusTrapConfiguration]
    );

    await startPromise;

    const service = container.get(IFocusTrapService);
    const dialog = appHost.querySelector('#dialog') as HTMLElement;
    const first = appHost.querySelector('#first') as HTMLButtonElement;
    const last = appHost.querySelector('#last') as HTMLButtonElement;
    const handle = service.create(dialog, { initialFocus: '#first' });

    await flush();
    expect(document.activeElement).toBe(first);

    last.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(first);

    first.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(last);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(outside);

    handle.dispose();
    outside.remove();
    await tearDown();
  });

  test('focus-trap attribute focuses initial control and emits escape event', async () => {
    const outside = document.body.appendChild(document.createElement('button'));
    outside.id = 'outside-attribute';
    outside.focus();

    const { appHost, component, startPromise, tearDown } = createFixture(
      `<div
        id="dialog"
        focus-trap="active.bind: open; initial-focus: #confirm"
        focus-trap-escape.trigger="onEscape()">
        <button id="cancel"></button>
        <button id="confirm"></button>
      </div>`,
      class App {
        public open = true;
        public escaped = false;

        public onEscape(): void {
          this.escaped = true;
        }
      },
      [AureliaFocusTrapConfiguration]
    );

    await startPromise;
    await flush();

    const confirm = appHost.querySelector('#confirm') as HTMLButtonElement;
    expect(document.activeElement).toBe(confirm);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(component.escaped).toBe(true);
    expect(document.activeElement).toBe(outside);

    outside.remove();
    await tearDown();
  });
});
