import { createFixture } from '@aurelia/testing';
import { AureliaHotkeysConfiguration, IHotkeyService, hotkeyMatches, normalizeKeys } from './../src/index';

describe('aurelia2-hotkeys', () => {
  test('normalizes shortcut strings and matches keyboard events', () => {
    expect(normalizeKeys('meta+k, ctrl+k')).toEqual(['meta+k', 'ctrl+k']);
    expect(hotkeyMatches(new KeyboardEvent('keydown', { key: 'k', metaKey: true }), 'cmd+k')).toBe(true);
    expect(hotkeyMatches(new KeyboardEvent('keydown', { key: 'Escape' }), 'esc')).toBe(true);
    expect(hotkeyMatches(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }), 'meta+k')).toBe(false);
  });

  test('service registers and disposes document shortcuts', async () => {
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaHotkeysConfiguration.configure({ preventDefault: false })]
    );

    await startPromise;

    const hotkeys = container.get(IHotkeyService);
    const callback = jest.fn();
    const handle = hotkeys.register({ keys: ['ctrl+s', 'meta+s'], callback });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    expect(callback).toHaveBeenCalledWith(expect.any(KeyboardEvent), 'ctrl+s');

    handle.dispose();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    expect(callback).toHaveBeenCalledTimes(1);

    await tearDown();
  });

  test('hotkey attribute fires callback, event, and optional click', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<button
        id="palette"
        hotkey="keys.bind: shortcut; callback.bind: (event, combo) => onHotkey(event, combo); click.bind: true"
        click.trigger="clicked()"
        hotkey-trigger.trigger="onEvent($event.detail.combo)">
        Open
      </button>`,
      class App {
        public shortcut = 'ctrl+k';
        public callbackCombo: string | null = null;
        public eventCombo: string | null = null;
        public clicks = 0;

        public onHotkey(_event: KeyboardEvent, combo: string): void {
          this.callbackCombo = combo;
        }

        public onEvent(combo: string): void {
          this.eventCombo = combo;
        }

        public clicked(): void {
          this.clicks += 1;
        }
      },
      [AureliaHotkeysConfiguration]
    );

    await startPromise;

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(component.callbackCombo).toBe('ctrl+k');
    expect(component.eventCombo).toBe('ctrl+k');
    expect(component.clicks).toBe(1);
    expect(event.defaultPrevented).toBe(true);
    expect(appHost.querySelector('#palette')).not.toBeNull();

    await tearDown();
  });
});
