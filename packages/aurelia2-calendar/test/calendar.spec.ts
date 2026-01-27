import { createFixture } from '@aurelia/testing';
import { CustomElement } from '@aurelia/runtime-html';
import {
  AureliaCalendarConfiguration,
  AuCalendarCustomElement,
  CalendarItem,
} from '../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-calendar', () => {
  test('renders a stable month grid', async () => {
    const { appHost, startPromise, tearDown } = createFixture(
      '<au-calendar show-date.bind="showDate" locale="en-us"></au-calendar>',
      class App {
        showDate = new Date(2024, 0, 15);
      },
      [AureliaCalendarConfiguration]
    );

    await startPromise;

    const weeks = appHost.querySelectorAll('.cv-week');
    expect(weeks.length).toBe(5);

    await tearDown();
  });

  test('places multi-day items with offset and span classes', async () => {
    const items: CalendarItem[] = [
      {
        id: 'item-1',
        title: 'Conference',
        startDate: new Date(2024, 0, 2),
        endDate: new Date(2024, 0, 4),
      },
    ];

    const { appHost, startPromise, tearDown } = createFixture(
      '<au-calendar show-date.bind="showDate" items.bind="items" locale="en-us"></au-calendar>',
      class App {
        showDate = new Date(2024, 0, 15);
        items = items;
      },
      [AureliaCalendarConfiguration]
    );

    await startPromise;

    const placedItem = appHost.querySelector('.cv-item.offset2.span3');
    expect(placedItem).not.toBeNull();
    expect(placedItem?.textContent).toContain('Conference');

    await tearDown();
  });

  test('emits date click details including items for that date', async () => {
    const onDateClick = jest.fn();
    const items: CalendarItem[] = [
      {
        id: 'item-1',
        title: 'Conference',
        startDate: new Date(2024, 0, 2),
        endDate: new Date(2024, 0, 4),
      },
    ];

    const { appHost, startPromise, tearDown } = createFixture(
      '<au-calendar show-date.bind="showDate" items.bind="items" on-date-click.bind="onDateClick" locale="en-us"></au-calendar>',
      class App {
        showDate = new Date(2024, 0, 15);
        items = items;
        onDateClick = onDateClick;
      },
      [AureliaCalendarConfiguration]
    );

    await startPromise;

    const jan3 = appHost.querySelector('.d2024-01-03') as HTMLElement;
    jan3.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await flush();

    expect(onDateClick).toHaveBeenCalledTimes(1);
    const detail = onDateClick.mock.calls[0][0];
    expect(detail.date.getFullYear()).toBe(2024);
    expect(detail.date.getMonth()).toBe(0);
    expect(detail.date.getDate()).toBe(3);
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0].id).toBe('item-1');

    await tearDown();
  });

  test('emits item click details when clicking a calendar item', async () => {
    const onItemClick = jest.fn();
    const items: CalendarItem[] = [
      {
        id: 'item-1',
        title: 'Conference',
        startDate: new Date(2024, 0, 2),
        endDate: new Date(2024, 0, 4),
      },
    ];

    const { appHost, startPromise, tearDown } = createFixture(
      '<au-calendar show-date.bind="showDate" items.bind="items" on-item-click.bind="onItemClick" locale="en-us"></au-calendar>',
      class App {
        showDate = new Date(2024, 0, 15);
        items = items;
        onItemClick = onItemClick;
      },
      [AureliaCalendarConfiguration]
    );

    await startPromise;

    const itemEl = appHost.querySelector('.cv-item') as HTMLElement | null;
    expect(itemEl).not.toBeNull();
    itemEl?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await flush();

    expect(onItemClick).toHaveBeenCalledTimes(1);
    const detail = onItemClick.mock.calls[0][0];
    expect(detail.item.id).toBe('item-1');

    await tearDown();
  });

  test('navigates periods and calls onPeriodChange with concrete dates', async () => {
    const onPeriodChange = jest.fn();

    const { appHost, startPromise, tearDown } = createFixture(
      '<au-calendar show-date.bind="showDate" on-period-change.bind="onPeriodChange" locale="en-us"></au-calendar>',
      class App {
        showDate = new Date(2024, 0, 15);
        onPeriodChange = onPeriodChange;
      },
      [AureliaCalendarConfiguration]
    );

    await startPromise;

    // Initial period change happens during binding; reset to focus on navigation.
    onPeriodChange.mockClear();

    const calendarEl = appHost.querySelector('au-calendar') as HTMLElement;
    const calendarVm = CustomElement.for(calendarEl).viewModel as AuCalendarCustomElement;

    calendarVm.nextPeriod();

    await flush();

    expect(onPeriodChange.mock.calls.length).toBeGreaterThanOrEqual(1);
    const detail = onPeriodChange.mock.calls.at(-1)?.[0];
    if (!detail) {
      throw new Error('Expected onPeriodChange detail to be defined');
    }
    expect(detail.periodStart.getFullYear()).toBe(2024);
    expect(detail.periodStart.getMonth()).toBe(1);
    expect(detail.periodStart.getDate()).toBe(1);

    await tearDown();
  });
});
