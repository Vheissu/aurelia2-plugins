import { createFixture } from '@aurelia/testing';
import { AureliaTourConfiguration, ITourService } from './../src/index';
import type { TourStep } from './../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-tour', () => {
  test('service starts, navigates, and completes tours', async () => {
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaTourConfiguration]
    );

    await startPromise;

    const service = container.get(ITourService);
    const states = [];
    const subscription = service.subscribe((state) => states.push(state));
    const steps: TourStep[] = [
      { id: 'one', title: 'One', content: 'First' },
      { id: 'two', title: 'Two', content: 'Second' },
    ];

    service.start(steps);
    expect(service.getState().current?.id).toBe('one');

    service.next();
    expect(service.getState().current?.id).toBe('two');

    service.next();
    expect(service.getState().active).toBe(false);
    expect(states.length).toBeGreaterThan(3);

    subscription.dispose();
    await tearDown();
  });

  test('component renders active step, highlights target, and advances', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<button id="search">Search</button>
      <au-tour
        active.two-way="active"
        steps.bind="steps"
        tour-next.trigger="nextEvent = $event.detail"
        tour-complete.trigger="completeEvent = $event.detail">
      </au-tour>`,
      class App {
        public active = true;
        public nextEvent = null;
        public completeEvent = null;
        public steps: TourStep[] = [
          { id: 'search', title: 'Find anything', content: 'Use global search.', target: '#search' },
          { id: 'invite', title: 'Invite people', content: 'Bring in teammates.' },
        ];
      },
      [AureliaTourConfiguration]
    );

    await startPromise;
    await flush();

    expect(appHost.textContent).toContain('Find anything');
    expect((appHost.querySelector('#search') as HTMLElement).getAttribute('data-au-tour-active')).toBe('true');

    const next = appHost.querySelector('.au-tour-button.primary') as HTMLButtonElement;
    next.click();
    await flush();

    expect(component.nextEvent.step.id).toBe('invite');
    expect(appHost.textContent).toContain('Invite people');
    expect((appHost.querySelector('#search') as HTMLElement).hasAttribute('data-au-tour-active')).toBe(false);

    (appHost.querySelector('.au-tour-button.primary') as HTMLButtonElement).click();
    await flush();

    expect(component.active).toBe(false);
    expect(component.completeEvent.step.id).toBe('invite');

    await tearDown();
  });
});
