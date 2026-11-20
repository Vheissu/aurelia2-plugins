import { createFixture } from '@aurelia/testing';
import { AureliaDatePickerConfiguration, IDatePickerService, isSameDay } from './../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-date-picker', () => {
  test('service parses ISO dates, formats values, and creates constrained month grids', async () => {
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaDatePickerConfiguration.configure({ locale: 'en-AU', firstDayOfWeek: 1 })]
    );

    await startPromise;

    const service = container.get(IDatePickerService);
    const parsed = service.parse('2026-04-25') as Date;
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(3);
    expect(parsed.getDate()).toBe(25);
    expect(service.formatIso(parsed)).toBe('2026-04-25');
    expect(service.parse('2026-02-29')).toBeNull();
    expect(service.parse(new Date(NaN))).toBeNull();
    expect(service.formatIso(service.parse('0004-02-29')!)).toBe('0004-02-29');

    const month = service.createMonth({
      displayDate: new Date(2026, 3, 1),
      selected: parsed,
      min: new Date(2026, 3, 10),
      max: new Date(2026, 3, 20),
    });

    expect(month.days.length).toBe(42);
    expect(month.weekdays[0]).toBe('Mon');
    expect(month.days.find((day) => day.iso === '2026-04-25')?.selected).toBe(true);
    expect(month.days.find((day) => day.iso === '2026-04-09')?.disabled).toBe(true);
    expect(month.days.find((day) => day.iso === '2026-04-15')?.disabled).toBe(false);

    await tearDown();
  });

  test('component opens, navigates months, selects a date, and emits detail', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<au-date-picker
        value.two-way="value"
        selected-date.two-way="selectedDate"
        date-picker-select.trigger="selected = $event.detail">
      </au-date-picker>`,
      class App {
        public value = '2026-04-15';
        public selectedDate: Date | null = null;
        public selected: any = null;
      },
      [AureliaDatePickerConfiguration.configure({ locale: 'en-US' })]
    );

    await startPromise;

    const input = appHost.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('04/15/2026');

    input.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();
    expect(appHost.textContent).toContain('April 2026');

    (appHost.querySelector('.next') as HTMLButtonElement).click();
    await flush();
    expect(appHost.textContent).toContain('May 2026');

    const mayTen = Array.from(appHost.querySelectorAll<HTMLButtonElement>('.au-dp-day'))
      .find((button) => button.textContent?.trim() === '10' && !button.classList.contains('outside')) as HTMLButtonElement;
    mayTen.click();
    await flush();

    expect(component.value).toBe('2026-05-10');
    expect(isSameDay(component.selectedDate as Date, new Date(2026, 4, 10))).toBe(true);
    expect(component.selected.value).toBe('2026-05-10');
    expect(appHost.querySelector('.au-dp-panel')).toBeNull();

    await tearDown();
  });

  test('component disables days outside min and max bounds', async () => {
    const { appHost, startPromise, tearDown } = createFixture(
      `<au-date-picker
        value.bind="'2026-04-15'"
        min.bind="'2026-04-10'"
        max.bind="'2026-04-20'">
      </au-date-picker>`,
      class App {},
      [AureliaDatePickerConfiguration]
    );

    await startPromise;

    (appHost.querySelector('input') as HTMLInputElement).dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();

    const aprilNine = Array.from(appHost.querySelectorAll<HTMLButtonElement>('.au-dp-day'))
      .find((button) => button.textContent?.trim() === '9' && !button.classList.contains('outside')) as HTMLButtonElement;
    const aprilFifteen = Array.from(appHost.querySelectorAll<HTMLButtonElement>('.au-dp-day'))
      .find((button) => button.textContent?.trim() === '15' && !button.classList.contains('outside')) as HTMLButtonElement;

    expect(aprilNine.disabled).toBe(true);
    expect(aprilFifteen.disabled).toBe(false);

    await tearDown();
  });

  test('clearing either two-way date binding clears the displayed selection', async () => {
    const fixture = await createFixture(
      '<au-date-picker value.two-way="value" selected-date.two-way="date"></au-date-picker>',
      class {
        value: string | null = '2026-04-15';
        date: Date | null = null;
      },
      [AureliaDatePickerConfiguration],
    ).started;
    const input = fixture.appHost.querySelector('input')!;
    expect(fixture.component.date?.getDate()).toBe(15);

    fixture.component.value = null;
    await flush();
    expect(fixture.component.date).toBeNull();
    expect(input.value).toBe('');

    fixture.component.date = new Date(2026, 3, 16);
    await flush();
    expect(fixture.component.value).toBe('2026-04-16');

    fixture.component.date = null;
    await flush();
    expect(fixture.component.value).toBeNull();
    expect(input.value).toBe('');
    await fixture.tearDown();
  });
});
