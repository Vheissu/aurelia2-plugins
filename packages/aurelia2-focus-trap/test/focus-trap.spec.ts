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
      <input type="hidden" tabindex="0">
      <div hidden><button></button></div>
      <fieldset disabled><button></button></fieldset>
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

  test('only the newest trap handles Tab and Escape', async () => {
    const fixture = createFixture(
      `<button id="outside"></button>
      <div id="outer"><button id="outer-first"></button><button id="outer-last"></button></div>
      <div id="inner"><button id="inner-button"></button></div>`,
      class {},
      [AureliaFocusTrapConfiguration],
    );
    await fixture.startPromise;
    const service = fixture.container.get(IFocusTrapService);
    const find = <T extends HTMLElement>(id: string) => fixture.appHost.querySelector<T>('#' + id)!;
    const outer = service.create(find('outer'));
    let inner: ReturnType<typeof service.create> | undefined;
    try {
      await flush();
      inner = service.create(find('inner'));
      await flush();
      expect(document.activeElement).toBe(find('inner-button'));

      find('outside').focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
      expect(document.activeElement).toBe(find('inner-button'));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
      expect(document.activeElement).toBe(find('outer-first'));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }));
      expect(document.activeElement).toBe(find('outer-last'));
    } finally {
      inner?.dispose();
      outer.dispose();
      await fixture.tearDown();
    }
  });

  test('deactivating before initial focus prevents the queued refocus', async () => {
    const fixture = createFixture(
      '<button id="outside"></button><div id="dialog"></div>',
      class {},
      [AureliaFocusTrapConfiguration],
    );
    await fixture.startPromise;
    const outside = fixture.appHost.querySelector<HTMLButtonElement>('#outside')!;
    const dialog = fixture.appHost.querySelector<HTMLElement>('#dialog')!;
    outside.focus();
    const handle = fixture.container.get(IFocusTrapService).create(dialog);
    handle.deactivate();
    await flush();

    expect(document.activeElement).toBe(outside);
    expect(dialog.hasAttribute('tabindex')).toBe(false);
    await fixture.tearDown();
  });

  test('tearing down the attribute removes the document key handler', async () => {
    const onEscape = jest.fn();
    const fixture = createFixture(
      '<div focus-trap="escape.bind: onEscape"><button></button></div>',
      class { onEscape = onEscape; },
      [AureliaFocusTrapConfiguration],
    );
    await fixture.startPromise;
    await flush();
    await fixture.tearDown();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(onEscape).not.toHaveBeenCalled();
  });
});
