import { Popup } from '../src/popup';
import { createUnitContainer } from './helpers';

interface FakePopupWindow {
  closed: boolean;
  location: { href: string };
  focus: jest.Mock<void, []>;
  close: jest.Mock<void, []>;
}

describe('OAuth popup transport', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function create(openResult?: FakePopupWindow | null, timeout = 300) {
    const popupWindow = openResult === undefined ? createPopupWindow() : openResult;
    const browserWindow = {
      location: { origin: 'https://app.example', href: 'https://app.example/' },
      screenX: 100,
      screenY: 50,
      outerWidth: 1_200,
      outerHeight: 800,
      open: jest.fn(() => popupWindow),
    } as unknown as Window;
    const setup = createUnitContainer(
      { popupTimeout: timeout },
      [],
      browserWindow,
    );
    return {
      ...setup,
      browserWindow,
      popupWindow,
      popup: setup.container.invoke(Popup),
    };
  }

  test('opens a centred window with explicit, serializable features', () => {
    const { browserWindow, popupWindow, popup } = create();

    popup.open(
      'https://issuer.example/authorize',
      'oidc',
      { width: 600, height: 500, resizable: true },
      'https://app.example/auth/callback',
    );

    expect(browserWindow.open).toHaveBeenCalledWith(
      'https://issuer.example/authorize',
      'oidc',
      expect.stringContaining('width=600'),
    );
    const features = (browserWindow.open as jest.Mock).mock.calls[0][2] as string;
    expect(features).toContain('height=500');
    expect(features).toContain('left=400');
    expect(features).toContain('top=200');
    expect(features).toContain('resizable=true');
    expect(popupWindow?.focus).toHaveBeenCalledTimes(1);
  });

  test('ignores lookalike callback paths and resolves only the exact callback URL', async () => {
    jest.useFakeTimers({ now: 0 });
    const { popupWindow, popup } = create(undefined, 1_000);
    popup.open(
      'https://issuer.example/authorize?client_id=test',
      'oidc',
      {},
      'https://app.example/auth/callback',
    );
    const result = popup.pollPopup();

    await jest.advanceTimersByTimeAsync(100);
    if (!popupWindow) throw new Error('Expected a popup window.');
    popupWindow.location.href = 'https://app.example/auth/callback-evil?code=stolen';
    await jest.advanceTimersByTimeAsync(100);
    expect(popupWindow.close).not.toHaveBeenCalled();

    popupWindow.location.href = 'https://app.example/auth/callback?code=good&state=state-1';
    await jest.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toBe(
      'https://app.example/auth/callback?code=good&state=state-1',
    );
    expect(popupWindow.close).toHaveBeenCalledTimes(1);
    expect(popup.popupWindow).toBeNull();
  });

  test('rejects cancellation and closes its polling interval', async () => {
    jest.useFakeTimers({ now: 0 });
    const popupWindow = createPopupWindow();
    const { popup } = create(popupWindow);
    popup.open('https://issuer.example/authorize', 'oidc');
    const result = popup.pollPopup();
    const rejection = expect(result).rejects.toMatchObject({ code: 'oauth-cancelled' });
    popupWindow.closed = true;

    await jest.advanceTimersByTimeAsync(100);

    await rejection;
    expect(jest.getTimerCount()).toBe(0);
    expect(popup.popupWindow).toBeNull();
  });

  test('uses the configured timeout and reports blocked popups distinctly', async () => {
    jest.useFakeTimers({ now: 0 });
    const timed = create(undefined, 250);
    timed.popup.open('https://issuer.example/authorize', 'oidc');
    const result = timed.popup.pollPopup();
    const rejection = expect(result).rejects.toMatchObject({ code: 'oauth-popup-timeout' });

    await jest.advanceTimersByTimeAsync(300);
    await rejection;
    expect(jest.getTimerCount()).toBe(0);

    const blocked = create(null);
    expect(() => blocked.popup.open('https://issuer.example/authorize', 'oidc'))
      .toThrow(expect.objectContaining({ code: 'oauth-popup-blocked' }));
  });
});

function createPopupWindow(): FakePopupWindow {
  const popup: FakePopupWindow = {
    closed: false,
    location: { href: 'https://issuer.example/authorize' },
    focus: jest.fn(),
    close: jest.fn(() => { popup.closed = true; }),
  };
  return popup;
}
