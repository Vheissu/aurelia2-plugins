import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { Configure } from '../src/configure';
import { TurnstileCustomElement } from '../src/turnstile-custom-element';
import { TurnstileConfiguration } from '../src/index';

type TurnstileRenderOptions = {
    callback: (token: string) => void;
};

type TurnstileVerifiedEvent = CustomEvent<{ token: string }>;

describe('aurelia2-turnstile', () => {
    let consoleSpy: ReturnType<typeof jest.spyOn>;
    let originalTurnstile: any;

    beforeEach(() => {
        consoleSpy = jest.spyOn(console, 'error').mockImplementation((..._args: unknown[]) => undefined);
        originalTurnstile = (window as any).turnstile;
        delete (window as any).turnstile;
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        if (originalTurnstile !== undefined) {
            (window as any).turnstile = originalTurnstile;
        } else {
            delete (window as any).turnstile;
        }

        document.querySelectorAll('script[src*="turnstile"]').forEach(el => el.remove());
    });

    describe('Configure', () => {
        test('has sensible defaults', () => {
            const config = new Configure();
            const opts = config.getOptions();

            expect(opts.sitekey).toBe('');
            expect(opts.theme).toBe('auto');
            expect(opts.scriptUrl).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js');
        });

        test('options() merges values', () => {
            const config = new Configure();
            config.options({ sitekey: 'my-key', theme: 'dark' });

            expect(config.get('sitekey')).toBe('my-key');
            expect(config.get('theme')).toBe('dark');
            expect(config.get('scriptUrl')).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js');
        });

        test('set() updates a single value', () => {
            const config = new Configure();
            config.set('sitekey', 'updated-key');

            expect(config.get('sitekey')).toBe('updated-key');
        });
    });

    describe('TurnstileCustomElement', () => {
        function createComponent(configOverrides: Partial<ReturnType<Configure['getOptions']>> = {}) {
            const config = new Configure();
            config.options(configOverrides);

            const element = document.createElement('turnstile');
            const sut = new TurnstileCustomElement(element, config);

            // Simulate the ref binding that Aurelia would do
            (sut as any).container = document.createElement('div');

            return { sut, config, element };
        }

        test('logs error when no sitekey is provided', () => {
            const { sut } = createComponent();

            sut.attached();

            expect(consoleSpy).toHaveBeenCalledWith(
                'Turnstile sitekey is required. Provide it via bindable or configuration.'
            );
        });

        test('uses sitekey from configuration when not set via bindable', () => {
            const renderMock = jest.fn().mockReturnValue('widget-1');
            (window as any).turnstile = { render: renderMock };

            const { sut } = createComponent({ sitekey: 'config-key' });

            sut.attached();

            expect(renderMock).toHaveBeenCalledWith(
                expect.any(HTMLElement),
                expect.objectContaining({ sitekey: 'config-key' })
            );
        });

        test('bindable sitekey takes precedence over configuration', () => {
            const renderMock = jest.fn().mockReturnValue('widget-1');
            (window as any).turnstile = { render: renderMock };

            const { sut } = createComponent({ sitekey: 'config-key' });
            sut.sitekey = 'bindable-key';

            sut.attached();

            expect(renderMock).toHaveBeenCalledWith(
                expect.any(HTMLElement),
                expect.objectContaining({ sitekey: 'bindable-key' })
            );
        });

        test('renders turnstile widget when API is available', () => {
            const renderMock = jest.fn().mockReturnValue('widget-1');
            (window as any).turnstile = { render: renderMock };

            const callback = jest.fn();
            const { sut } = createComponent({ sitekey: 'test-key' });
            sut.callback = callback;
            sut.theme = 'dark';

            sut.attached();

            expect(renderMock).toHaveBeenCalledWith(
                expect.any(HTMLElement),
                expect.objectContaining({
                    sitekey: 'test-key',
                    theme: 'dark',
                    callback: expect.any(Function),
                })
            );
        });

        test('dispatches turnstile-verified event with token', () => {
            let capturedCallback: (token: string) => void;
            const renderMock = jest.fn<(element: HTMLElement, opts: TurnstileRenderOptions) => string>().mockImplementation((_el, opts) => {
                capturedCallback = opts.callback;
                return 'widget-1';
            });
            (window as any).turnstile = { render: renderMock };

            const { sut, element } = createComponent({ sitekey: 'test-key' });
            const eventSpy = jest.fn<(event: TurnstileVerifiedEvent) => void>();
            element.addEventListener('turnstile-verified', ((event: Event) => {
                eventSpy(event as TurnstileVerifiedEvent);
            }) as EventListener);

            sut.attached();
            capturedCallback!('test-token-123');

            expect(eventSpy).toHaveBeenCalledTimes(1);
            expect(eventSpy.mock.calls[0][0].detail).toEqual({ token: 'test-token-123' });
        });

        test('calls callback bindable and dispatches event together', () => {
            let capturedCallback: (token: string) => void;
            const renderMock = jest.fn<(element: HTMLElement, opts: TurnstileRenderOptions) => string>().mockImplementation((_el, opts) => {
                capturedCallback = opts.callback;
                return 'widget-1';
            });
            (window as any).turnstile = { render: renderMock };

            const callbackSpy = jest.fn();
            const { sut, element } = createComponent({ sitekey: 'test-key' });
            sut.callback = callbackSpy;
            const eventSpy = jest.fn<(event: TurnstileVerifiedEvent) => void>();
            element.addEventListener('turnstile-verified', ((event: Event) => {
                eventSpy(event as TurnstileVerifiedEvent);
            }) as EventListener);

            sut.attached();
            capturedCallback!('my-token');

            expect(callbackSpy).toHaveBeenCalledWith('my-token');
            expect(eventSpy).toHaveBeenCalledTimes(1);
            expect(eventSpy.mock.calls[0][0].detail).toEqual({ token: 'my-token' });
            expect(eventSpy.mock.calls[0][0].composed).toBe(true);
        });

        test('uses theme from configuration when not set via bindable', () => {
            const renderMock = jest.fn().mockReturnValue('widget-1');
            (window as any).turnstile = { render: renderMock };

            const { sut } = createComponent({ sitekey: 'test-key', theme: 'auto' });

            sut.attached();

            expect(renderMock).toHaveBeenCalledWith(
                expect.any(HTMLElement),
                expect.objectContaining({ theme: 'auto' })
            );
        });

        test('does not append duplicate script tags', () => {
            const existingScript = document.createElement('script');
            existingScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
            document.head.appendChild(existingScript);

            const renderMock = jest.fn().mockReturnValue('widget-1');
            (window as any).turnstile = { render: renderMock };

            const { sut } = createComponent({ sitekey: 'test-key' });

            sut.attached();

            const scripts = document.querySelectorAll(
                'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
            );
            expect(scripts.length).toBe(1);
        });

        test('appends script tag when turnstile API is not loaded', () => {
            const { sut } = createComponent({ sitekey: 'test-key' });

            sut.attached();

            const scripts = document.querySelectorAll(
                'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
            );
            expect(scripts.length).toBe(1);
        });

        test('uses custom scriptUrl from bindable', () => {
            const { sut } = createComponent({ sitekey: 'test-key' });
            sut.scriptUrl = 'https://custom-cdn.example.com/turnstile.js';

            sut.attached();

            const scripts = document.querySelectorAll(
                'script[src="https://custom-cdn.example.com/turnstile.js"]'
            );
            expect(scripts.length).toBe(1);
        });

        test('detached removes the widget', () => {
            const removeMock = jest.fn();
            const renderMock = jest.fn().mockReturnValue('widget-1');
            (window as any).turnstile = { render: renderMock, remove: removeMock };

            const { sut } = createComponent({ sitekey: 'test-key' });

            sut.attached();
            sut.detached();

            expect(removeMock).toHaveBeenCalledWith('widget-1');
        });

        test('detached does nothing when widget was not rendered', () => {
            const { sut } = createComponent();

            // Should not throw
            sut.detached();
        });
    });

    describe('TurnstileConfiguration', () => {
        test('register() returns a container', () => {
            const registrations: any[] = [];
            const mockConfig = new Configure();
            const mockContainer = {
                get: jest.fn().mockReturnValue(mockConfig),
                register: jest.fn().mockReturnThis(),
            };

            TurnstileConfiguration.register(mockContainer as any);

            expect(mockContainer.get).toHaveBeenCalled();
            expect(mockContainer.register).toHaveBeenCalled();
        });

        test('configure() returns a new configuration with options', () => {
            const configured = TurnstileConfiguration.configure({
                sitekey: 'my-key',
                theme: 'dark',
            });

            const mockConfig = new Configure();
            const mockContainer = {
                get: jest.fn().mockReturnValue(mockConfig),
                register: jest.fn().mockReturnThis(),
            };

            configured.register(mockContainer as any);

            expect(mockConfig.get('sitekey')).toBe('my-key');
            expect(mockConfig.get('theme')).toBe('dark');
        });

        test('customize() allows callback-style configuration', () => {
            const customized = TurnstileConfiguration.customize((config) => {
                config.set('sitekey', 'callback-key');
            });

            const mockConfig = new Configure();
            const mockContainer = {
                get: jest.fn().mockReturnValue(mockConfig),
                register: jest.fn().mockReturnThis(),
            };

            customized.register(mockContainer as any);

            expect(mockConfig.get('sitekey')).toBe('callback-key');
        });
    });
});
