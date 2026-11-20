import { describe, expect, jest, test } from '@jest/globals';
import { tasksSettled } from '@aurelia/runtime';
import { createFixture } from '@aurelia/testing';
import { batch } from 'aurelia';

import { AureliaTableConfiguration, TableSettings } from '../src/index';

describe('aurelia2-table', () => {
  test('filters nested values, resets pagination, and skips missing properties', async () => {
    const fixture = await createFixture(
      `<table aurelia-table="data.bind: rows; display-data.two-way: displayRows; filters.bind: filters;
          current-page.two-way: currentPage; page-size.bind: 2; total-items.two-way: totalItems"></table>`,
      {
        rows: [
          { name: 'Alpha', profile: { name: 'Alpha' } },
          { name: 'Beta', profile: null },
          { name: 'Gamma', profile: { name: 'Gamma' } },
          { name: 'Alphabet', profile: { name: 'Alphabet' } },
        ],
        displayRows: [] as Array<{ name: string }>,
        filters: [{ value: '', keys: ['profile.name'] }],
        currentPage: 2,
        totalItems: 0,
      },
      [AureliaTableConfiguration],
    ).started;
    const { component } = fixture;

    expect(component.displayRows.map((row) => row.name)).toEqual(['Gamma', 'Alphabet']);
    expect(component.totalItems).toBe(4);

    component.filters[0].value = 'Al';
    await tasksSettled();

    expect(component.currentPage).toBe(1);
    expect(component.totalItems).toBe(2);
    expect(component.displayRows.map((row) => row.name)).toEqual(['Alpha', 'Alphabet']);
    await fixture.tearDown();
  });

  test('distinguishes filter values that concatenate to the same string', async () => {
    const rows = [
      { name: 'Ab', role: 'Chief' },
      { name: 'A', role: 'BC' },
    ];
    const fixture = await createFixture(
      '<table aurelia-table="data.bind: rows; display-data.two-way: displayRows; filters.bind: filters"></table>',
      {
        rows,
        displayRows: [] as typeof rows,
        filters: [{ value: 'ab', keys: ['name'] }, { value: 'c', keys: ['role'] }],
      },
      [AureliaTableConfiguration],
    ).started;
    const { component } = fixture;
    expect(component.displayRows).toEqual([rows[0]]);

    batch(() => {
      component.filters[0].value = 'a';
      component.filters[1].value = 'bc';
    });
    await tasksSettled();

    expect(component.displayRows).toEqual([rows[1]]);
    await fixture.tearDown();
  });

  test('exposes the reveal API and jumps to the page containing an item', async () => {
    const rows = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map((name) => ({ name }));
    const fixture = await createFixture(
      `<table aurelia-table="data.bind: rows; display-data.two-way: displayRows; api.two-way: tableApi;
          current-page.two-way: currentPage; page-size.bind: 2"></table>`,
      {
        rows,
        displayRows: [] as Array<{ name: string }>,
        currentPage: 1,
        tableApi: undefined as { revealItem(item: { name: string }): boolean } | undefined,
      },
      [AureliaTableConfiguration],
    ).started;
    const { component } = fixture;

    expect(component.tableApi?.revealItem(rows[4])).toBe(true);
    expect(component.currentPage).toBe(3);
    expect(component.displayRows).toEqual([rows[4]]);
    expect(component.tableApi?.revealItem({ name: 'Missing' })).toBe(false);
    await fixture.tearDown();
  });

  test('updates row selection from nested clicks and cleans up the click handler', async () => {
    const rows = [
      { name: 'Alpha', $isSelected: false },
      { name: 'Beta', $isSelected: true },
    ];
    const fixture = await createFixture(
      `<table if.bind="showTable" aurelia-table="data.bind: rows">
        <tbody>
          <tr repeat.for="row of rows" aut-select="row.bind: row" select.trigger="onSelect($event.detail)">
            <td><span textcontent.bind="row.name"></span></td>
          </tr>
        </tbody>
      </table>`,
      { showTable: true, rows, onSelect: jest.fn() },
      [AureliaTableConfiguration],
    ).started;
    const [firstRow, secondRow] = fixture.getAllBy('tr');
    const inner = firstRow.querySelector('span')!;

    expect(secondRow.classList.contains('aut-row-selected')).toBe(true);
    inner.click();
    await tasksSettled();

    expect(rows.map((row) => row.$isSelected)).toEqual([true, false]);
    expect(firstRow.classList.contains('aut-row-selected')).toBe(true);
    expect(secondRow.classList.contains('aut-row-selected')).toBe(false);
    expect(fixture.component.onSelect).toHaveBeenCalledTimes(1);
    expect(fixture.component.onSelect).toHaveBeenCalledWith({ row: rows[0] });

    fixture.component.showTable = false;
    await tasksSettled();
    inner.click();
    expect(rows[0].$isSelected).toBe(true);
    await fixture.tearDown();
  });

  test('defaults invalid pagination inputs and emits changes from the component host', async () => {
    const fixture = await createFixture(
      `<aut-pagination current-page.two-way="currentPage" page-size.bind="pageSize"
        total-items.bind="totalItems" page-changed.trigger="onPageChanged($event.detail)">
      </aut-pagination>`,
      { currentPage: 0, pageSize: 0, totalItems: undefined as number | undefined, onPageChanged: jest.fn() },
      [AureliaTableConfiguration],
    ).started;
    const { component } = fixture;

    expect(component.currentPage).toBe(1);
    expect(fixture.getBy('nav')!.style.display).toBe('none');
    component.totalItems = 12;
    await tasksSettled();
    expect(fixture.getBy('nav')!.style.display).toBe('');

    fixture.getBy('a[aria-label="Next"]')!.click();
    expect(component.currentPage).toBe(2);
    expect(component.onPageChanged).toHaveBeenLastCalledWith({ currentPage: 2 });
    await fixture.tearDown();
  });

  test('renders the pages around the active tier', async () => {
    const fixture = await createFixture(
      `<aut-pagination current-page.bind="6" page-size.bind="5"
        total-items.bind="50" pagination-size.bind="3" direction-links.bind="false"></aut-pagination>`,
      {},
      [AureliaTableConfiguration],
    ).started;

    expect(fixture.getAllBy('a.page-link').map((link) => link.textContent)).toEqual([
      '...', '4', '5', '6', '...',
    ]);
    await fixture.tearDown();
  });

  test('applies only the newest server response when requests finish out of order', async () => {
    const pending: Array<(result: { items: string[]; totalItems: number }) => void> = [];
    const settings = new TableSettings(() => new Promise((resolve) => pending.push(resolve)));

    const first = settings.loadItems();
    const second = settings.loadItems();

    pending[1]({ items: ['Recent'], totalItems: 1 });
    await second;
    pending[0]({ items: ['Stale'], totalItems: 10 });
    await first;

    expect(settings.items).toEqual(['Recent']);
    expect(settings.totalItems).toBe(1);
  });
});
