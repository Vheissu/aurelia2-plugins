import { EventAggregator } from '@aurelia/kernel';
import { createFixture } from '@aurelia/testing';
import { Analytics } from '../src/google-analytics';

type LoggerStub = {
  scopeTo: jest.Mock;
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

function createLogger(): LoggerStub {
  return {
    scopeTo: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function createAnalytics() {
  const eventAggregator = new EventAggregator();
  const logger = createLogger();
  const analytics = new Analytics(eventAggregator as never, logger as never);

  return { analytics, eventAggregator, logger };
}

function detachClickTracker(analytics: Analytics) {
  const handler = (analytics as Analytics & { _clickDelegateHandler?: EventListener })._clickDelegateHandler;
  if (handler) {
    document.body.removeEventListener('click', handler);
  }
}

describe('Analytics', () => {
  let originalGa: unknown;
  let originalOnError: OnErrorEventHandler;

  beforeEach(() => {
    originalGa = (window as Window & { ga?: unknown }).ga;
    originalOnError = window.onerror;
    delete (window as Window & { ga?: unknown }).ga;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    window.onerror = originalOnError;
    if (originalGa === undefined) {
      delete (window as Window & { ga?: unknown }).ga;
    } else {
      (window as Window & { ga?: unknown }).ga = originalGa;
    }
    document.body.innerHTML = '';
  });

  test('initializes the GA bootstrap function and queues the create call', () => {
    const { analytics } = createAnalytics();

    analytics.init('UA-12345');

    const script = document.body.querySelector('script');
    expect(script).not.toBeNull();
    expect(typeof (window as Window & { ga?: unknown }).ga).toBe('function');
    const queue = (window as Window & { ga: { q?: ArrayLike<string>[] } }).ga.q ?? [];
    expect(Array.from(queue[0] ?? [])).toEqual(['create', 'UA-12345', 'auto']);
  });

  test('tracks delegated anchor clicks from staged HTML using analytics data attributes', async () => {
    const { analytics } = createAnalytics();
    const gaSpy = jest.fn();
    (window as Window & { ga?: unknown }).ga = gaSpy;

    const { appHost, startPromise, tearDown } = createFixture(
      `<a
        id="tracked-link"
        href="#docs"
        data-analytics-category="Docs"
        data-analytics-action="Open"
        data-analytics-label="Guide"
        data-analytics-value="1">
        <span id="tracked-label">Read the guide</span>
      </a>`,
      class {},
      []
    );

    await startPromise;

    analytics.attach({
      useNativeGaScript: false,
      clickTracking: {
        enabled: true,
        filter: (element) => element instanceof HTMLElement && element.matches('a, button'),
        customFnTrack: false,
      },
    });

    const label = appHost.querySelector('#tracked-label') as HTMLElement;
    label.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(gaSpy).toHaveBeenCalledWith(
      'send',
      'event',
      'Docs',
      'Open',
      'Guide',
      '1'
    );

    detachClickTracker(analytics);
    await tearDown();
  });

  test('tracks router navigation through the event aggregator and honors ignore rules', () => {
    const { analytics, eventAggregator } = createAnalytics();
    const gaSpy = jest.fn();
    (window as Window & { ga?: unknown }).ga = gaSpy;

    analytics.attach({
      useNativeGaScript: false,
      pageTracking: {
        enabled: true,
        ignore: {
          fragments: ['ignore-me'],
          routes: ['admin'],
          routeNames: ['hidden-page'],
        },
        getTitle: (payload) => payload.navigation.title,
        getUrl: (payload) => `/${payload.navigation.fragment}`,
        customFnTrack: false,
      },
    });

    eventAggregator.publish('au:router:navigation-end', {
      navigation: {
        fragment: 'ignore-me/segment',
        instruction: 'dashboard',
        title: 'Ignored',
        scope: {
          router: {
            activeComponents: [{ component: { name: 'dashboard-page' } }],
          },
        },
      },
    });

    expect(gaSpy).not.toHaveBeenCalled();

    eventAggregator.publish('au:router:navigation-end', {
      navigation: {
        fragment: 'reports',
        instruction: 'reports',
        title: 'Reports',
        scope: {
          router: {
            activeComponents: [{ component: { name: 'reports-page' } }],
          },
        },
      },
    });

    expect(gaSpy).toHaveBeenNthCalledWith(1, 'set', {
      page: '/reports',
      title: 'Reports',
      anonymizeIp: false,
    });
    expect(gaSpy).toHaveBeenNthCalledWith(2, 'send', 'pageview');
  });
});
