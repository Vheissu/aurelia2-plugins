import { createFixture, onFixtureCreated } from '@aurelia/testing';
import FroalaEditorLib from 'froala-editor';
import { FroalaConfiguration } from '../src/index';
import { FroalaEditor } from '../src/froala-editor';

type MockFroalaInstance = {
  config: Record<string, unknown>;
  destroy: jest.Mock;
  events: {
    on: jest.Mock;
  };
  html: {
    get: jest.Mock<string, []>;
    set: jest.Mock<void, [string]>;
  };
  registeredEvents: Record<string, (...args: unknown[]) => unknown>;
};

const fixtures: any[] = [];
const mockFroalaInstances: MockFroalaInstance[] = [];

jest.mock('froala-editor', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((_element: HTMLElement, config: Record<string, unknown>) => {
    let currentHtml = '';
    const registeredEvents: Record<string, (...args: unknown[]) => unknown> = {};

    const instance: MockFroalaInstance = {
      config,
      destroy: jest.fn(),
      events: {
        on: jest.fn((name: string, callback: (...args: unknown[]) => unknown) => {
          registeredEvents[name] = callback;
        }),
      },
      html: {
        get: jest.fn(() => currentHtml),
        set: jest.fn((value: string) => {
          currentHtml = value;
        }),
      },
      registeredEvents,
    };

    mockFroalaInstances.push(instance);
    return instance;
  }),
}));

onFixtureCreated((fixture) => {
  fixtures.push(fixture);
});

const flush = async (times = 1) => {
  for (let index = 0; index < times; index++) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

function getShadowOrHost(element: HTMLElement | null): ParentNode {
  if (element == null) {
    throw new Error('Expected froala-editor host to exist');
  }

  return element.shadowRoot ?? element;
}

describe('FroalaEditor', () => {
  beforeEach(() => {
    mockFroalaInstances.length = 0;
    jest.clearAllMocks();
  });

  afterEach(async () => {
    for (const fixture of fixtures.splice(0)) {
      await fixture.stop(true);
    }
  });

  test('renders the default div branch and initializes the editor with merged config', async () => {
    const fixture = createFixture(
      '<froala-editor component.ref="froalaVm" value.two-way="content" config.bind="config" event-handlers.bind="handlers"></froala-editor>',
      class App {
        content = '<p>Initial content</p>';
        config = { toolbarInline: true };
        froalaVm!: FroalaEditor;
        initializedCalls = 0;
        handlers = {
          initialized(this: App) {
            this.initializedCalls++;
          },
        };
      },
      [
        FroalaConfiguration.configure({
          callback: (config) => {
            config.options({
              iframe: false,
              placeholderText: 'Type here',
            });
          },
        }),
      ]
    );
    const { appHost, component, startPromise, tearDown } = fixture;

    await startPromise;
    await flush(2);

    const host = appHost.querySelector('froala-editor') as HTMLElement;
    const root = getShadowOrHost(host);
    expect(root.querySelector('div')).not.toBeNull();
    expect(root.querySelector('textarea')).toBeNull();

    const instance = mockFroalaInstances[0];
    expect(FroalaEditorLib).toHaveBeenCalledWith(
      host,
      expect.objectContaining({
        placeholderText: 'Type here',
        toolbarInline: true,
        events: expect.objectContaining({
          contentChanged: expect.any(Function),
          blur: expect.any(Function),
        }),
      })
    );
    expect(component.initializedCalls).toBe(1);
    expect(instance.html.set).toHaveBeenCalledWith('<p>Initial content</p>');

    component.content = '<p>Updated from app</p>';
    await flush(2);

    expect(instance.html.set).toHaveBeenCalledWith('<p>Updated from app</p>');
    component.froalaVm.detached();
    expect(instance.destroy).toHaveBeenCalledTimes(1);

    await tearDown();
    fixtures.splice(fixtures.indexOf(fixture), 1);
  });

  test('renders the iframe branch and syncs editor events back to the app', async () => {
    const fixture = createFixture(
      '<froala-editor value.two-way="content" config.bind="config" event-handlers.bind="handlers"></froala-editor>',
      class App {
        content = '<p>Start</p>';
        config = { iframe: true };
        initializedCalls = 0;
        focusArgs: unknown[] = [];
        handlers = {
          initialized(this: App) {
            this.initializedCalls++;
          },
          focus(this: App, ...args: unknown[]) {
            this.focusArgs = args;
          },
        };
      },
      [FroalaConfiguration]
    );
    const { appHost, component, startPromise, tearDown } = fixture;

    await startPromise;
    await flush(2);

    const host = appHost.querySelector('froala-editor') as HTMLElement;
    const root = getShadowOrHost(host);
    expect(root.querySelector('textarea')).not.toBeNull();
    expect(root.querySelector('div')).toBeNull();

    const instance = mockFroalaInstances[0];
    expect(component.initializedCalls).toBe(1);

    const config = instance.config as {
      events: {
        contentChanged: (this: { html: { get(): string } }) => void;
      };
    };

    config.events.contentChanged.call({
      html: {
        get: () => '<p>Changed by editor</p>',
      },
    });
    await flush();

    expect(component.content).toBe('<p>Changed by editor</p>');

    instance.registeredEvents.focus('editor', 42);
    expect(component.focusArgs).toEqual(['editor', 42]);

    await tearDown();
    fixtures.splice(fixtures.indexOf(fixture), 1);
  });
});
