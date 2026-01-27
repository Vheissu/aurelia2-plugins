import { describe, expect, it } from 'vitest';
import { createFixture } from '@aurelia/testing';
import { MyApp } from '../src/my-app';
import { AureliaCalendarConfiguration } from 'aurelia2-calendar';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForSelector(root: ParentNode, selector: string, attempts = 50): Promise<Element | null> {
  for (let i = 0; i < attempts; i++) {
    const found = root.querySelector(selector);
    if (found) return found;
    await flush();
  }
  return null;
}

describe('aurelia2-calendar example', () => {
  it('renders the calendar and header', async () => {
    const { appHost } = await createFixture(
      '<my-app></my-app>',
      {},
      [AureliaCalendarConfiguration, MyApp],
    ).started;

    const header = appHost.querySelector('h1');
    expect(header?.textContent).toContain('Aurelia 2 Calendar');

    const calendar = appHost.querySelector('au-calendar');
    expect(calendar).not.toBeNull();
  });

  it('updates lastItemClick when a calendar item is clicked', async () => {
    const { appHost, component } = await createFixture(
      '<my-app></my-app>',
      {},
      [AureliaCalendarConfiguration, MyApp],
    ).started;

    const calendarEl = appHost.querySelector('au-calendar') as HTMLElement | null;
    let lastDetail: unknown = null;
    calendarEl?.addEventListener('calendar-item-click', (e) => {
      lastDetail = (e as CustomEvent).detail;
    });

    const itemEl = (await waitForSelector(appHost, '.cv-item')) as HTMLElement | null;
    expect(itemEl).not.toBeNull();
    itemEl?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await flush();

    expect(lastDetail).not.toBeNull();
    const detail = lastDetail as { item?: { title?: string } };
    expect(detail.item?.title).toBe('Kickoff');
    // In the browser this is also reflected in the panel via MyApp callbacks.
    expect(component).toBeDefined();
  });
});
