import { createFixture } from '@aurelia/testing';
import { AureliaClipboardConfiguration, IClipboardService } from './../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function setNativeClipboard(clipboard: Partial<Clipboard> | null): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  });
}

describe('aurelia2-clipboard', () => {
  let originalExecCommand: typeof document.execCommand | undefined;

  beforeEach(() => {
    originalExecCommand = document.execCommand;
  });

  afterEach(() => {
    setNativeClipboard(null);
    document.execCommand = originalExecCommand as typeof document.execCommand;
  });

  test('copies text through the native clipboard API', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setNativeClipboard({ writeText });

    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaClipboardConfiguration.configure({ trim: true })]
    );

    await startPromise;

    const clipboard = container.get(IClipboardService);
    const result = await clipboard.copy('  hello  ');

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(result).toEqual({ text: 'hello', native: true });

    await tearDown();
  });

  test('falls back to document.execCommand when native clipboard is unavailable', async () => {
    setNativeClipboard(null);
    document.execCommand = jest.fn().mockReturnValue(true) as typeof document.execCommand;

    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaClipboardConfiguration.configure({ preferNative: false })]
    );

    await startPromise;

    const clipboard = container.get(IClipboardService);
    const result = await clipboard.copy('fallback');

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(result).toEqual({ text: 'fallback', native: false });
    expect(document.querySelector('textarea')).toBeNull();

    await tearDown();
  });

  test('copy attribute copies bound text and emits success event', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setNativeClipboard({ writeText });

    const { appHost, component, startPromise, tearDown } = createFixture(
      `<button
        copy="text.bind: inviteUrl; success.bind: copied"
        clipboard-copy.trigger="onCopied($event.detail.result)">
        Copy
      </button>`,
      class App {
        public inviteUrl = 'https://example.com/invite';
        public copied = jest.fn();
        public eventResult: unknown = null;

        public onCopied(result: unknown): void {
          this.eventResult = result;
        }
      },
      [AureliaClipboardConfiguration]
    );

    await startPromise;

    (appHost.querySelector('button') as HTMLButtonElement).click();
    await flush();

    expect(writeText).toHaveBeenCalledWith('https://example.com/invite');
    expect(component.copied).toHaveBeenCalledWith({
      text: 'https://example.com/invite',
      native: true,
    });
    expect(component.eventResult).toEqual({
      text: 'https://example.com/invite',
      native: true,
    });

    await tearDown();
  });

  test('copy attribute can resolve text from a selector', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setNativeClipboard({ writeText });

    const { appHost, startPromise, tearDown } = createFixture(
      `<input id="coupon" value.bind="coupon">
      <button copy="selector: #coupon">Copy coupon</button>`,
      class App {
        public coupon = 'SAVE20';
      },
      [AureliaClipboardConfiguration]
    );

    await startPromise;

    (appHost.querySelector('button') as HTMLButtonElement).click();
    await flush();

    expect(writeText).toHaveBeenCalledWith('SAVE20');

    await tearDown();
  });
});
