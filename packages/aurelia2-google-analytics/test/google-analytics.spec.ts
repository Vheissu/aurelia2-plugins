import { DI, ILogger, Registration, customElement, IEventAggregator } from 'aurelia';
import { IRouter, route, RouterConfiguration } from '@aurelia/router';
import { createFixture } from '@aurelia/testing';
import { IGoogleAnalytics, GoogleAnalyticsConfiguration } from '../src';

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
  const container = DI.createContainer();
  const logger = createLogger();
  container.register(Registration.instance(ILogger, logger));
  return { analytics: container.get(IGoogleAnalytics), eventAggregator: container.get(IEventAggregator), logger };
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

    analytics.detach();
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
    analytics.detach();
  });

  test('tracks a real router navigation once after reconfiguration and stops after detach', async () => {
    @customElement({ name: 'analytics-page', template: 'Reports' })
    class Reports {}

    @route({ routes: [{ id: 'report-list', path: ['', 'reports'], component: Reports, title: 'Reports' }] })
    class App {}

    const track = jest.fn();
    const fixture = createFixture('<au-viewport></au-viewport>', App, [
      RouterConfiguration, GoogleAnalyticsConfiguration,
    ]);
    await fixture.startPromise;
    try {
      const analytics = fixture.container.get(IGoogleAnalytics);
      const options = { useNativeGaScript: false, pageTracking: { enabled: true, customFnTrack: track } };
      analytics.attach(options);
      analytics.attach(options);
      const router = fixture.container.get(IRouter);
      await router.load('reports?period=weekly');
      expect(track).toHaveBeenCalledTimes(1);
      expect(track).toHaveBeenCalledWith({ page: '/reports?period=weekly', title: document.title, anonymizeIp: false });

      analytics.attach({ ...options, pageTracking: { ...options.pageTracking, ignore: { routeNames: ['report-list'] } } });
      await router.load('reports?period=daily');
      expect(track).toHaveBeenCalledTimes(1);
      analytics.attach(options);
      analytics.detach();
      await router.load('reports?period=monthly');
      expect(track).toHaveBeenCalledTimes(1);
    } finally {
      await fixture.tearDown();
    }
  });

  test('detaches error tracking without replacing the application error handler', () => {
    const { analytics } = createAnalytics();
    const ga = jest.fn();
    Object.assign(window, { ga });
    const onError = jest.fn();
    window.onerror = onError;
    analytics.attach({ useNativeGaScript: false });
    window.dispatchEvent(new ErrorEvent('error', { message: 'first' }));
    analytics.detach();
    window.dispatchEvent(new ErrorEvent('error', { message: 'second' }));
    expect(onError).toHaveBeenCalledTimes(2);
    expect(ga).toHaveBeenCalledTimes(1);
    expect(ga).toHaveBeenCalledWith('send', 'exception', expect.objectContaining({ exDescription: expect.stringContaining('first') }));
  });
});
