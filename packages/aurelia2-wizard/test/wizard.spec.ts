import { createFixture } from '@aurelia/testing';
import { AureliaWizardConfiguration, IWizardService } from './../src/index';
import type { WizardStep } from './../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const steps: WizardStep[] = [
  { id: 'profile', title: 'Profile', description: 'Your details', content: 'Tell us who you are.' },
  { id: 'team', title: 'Team', optional: true, content: 'Invite teammates.' },
  { id: 'billing', title: 'Billing', content: 'Add billing.' },
];

describe('aurelia2-wizard', () => {
  test('service creates state, gates linear navigation, and tracks completion', async () => {
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaWizardConfiguration]
    );

    await startPromise;

    const wizard = container.get(IWizardService);
    const state = wizard.createState(steps, 0, []);

    expect(state.activeStep?.id).toBe('profile');
    expect(wizard.canEnter(state, 2, true)).toBe(false);
    expect(wizard.canEnter(wizard.createState(steps, 0, ['profile']), 2, true)).toBe(true);
    expect(wizard.markCompleted(state)).toEqual(['profile']);
    expect(wizard.nextIndex(state)).toBe(1);

    const disabledState = wizard.createState([
      steps[0],
      { ...steps[1], disabled: true },
      steps[2],
    ]);
    expect(wizard.nextIndex(disabledState)).toBe(2);

    await tearDown();
  });

  test('component renders steps, advances, completes, and emits events', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<au-wizard
        steps.bind="steps"
        index.two-way="index"
        completed.two-way="completed"
        wizard-next.trigger="nextEvent = $event.detail"
        wizard-complete.trigger="completeEvent = $event.detail">
      </au-wizard>`,
      class App {
        public steps = steps.slice(0, 2);
        public index = 0;
        public completed: string[] = [];
        public nextEvent: any = null;
        public completeEvent: any = null;
      },
      [AureliaWizardConfiguration]
    );

    await startPromise;

    expect(appHost.textContent).toContain('Tell us who you are.');

    (appHost.querySelector('.au-wizard-button.primary') as HTMLButtonElement).click();
    await flush();

    expect(component.index).toBe(1);
    expect(component.completed).toEqual(['profile']);
    expect(component.nextEvent.step.id).toBe('team');
    expect(appHost.textContent).toContain('Invite teammates.');

    (appHost.querySelector('.au-wizard-button.primary') as HTMLButtonElement).click();
    await flush();

    expect(component.completeEvent.step.id).toBe('team');
    expect(component.completed).toEqual(['profile', 'team']);

    await tearDown();
  });

  test('linear component prevents jumping ahead until required steps are completed', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<au-wizard steps.bind="steps" index.two-way="index"></au-wizard>`,
      class App {
        public steps = steps;
        public index = 0;
      },
      [AureliaWizardConfiguration]
    );

    await startPromise;

    const buttons = Array.from(appHost.querySelectorAll<HTMLButtonElement>('.au-wizard-step'));
    expect(buttons[2].disabled).toBe(true);

    buttons[2].click();
    await flush();
    expect(component.index).toBe(0);

    (appHost.querySelector('.au-wizard-button.primary') as HTMLButtonElement).click();
    await flush();

    expect(component.index).toBe(1);
    const updatedButtons = Array.from(appHost.querySelectorAll<HTMLButtonElement>('.au-wizard-step'));
    expect(updatedButtons[2].disabled).toBe(false);

    await tearDown();
  });
});
