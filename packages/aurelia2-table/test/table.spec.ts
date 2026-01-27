import { CustomAttribute, CustomElement } from 'aurelia';
import { createFixture } from '@aurelia/testing';
import { AureliaTableConfiguration } from '../src/index';
import type { AureliaTableCustomAttribute } from '../src/aurelia-table-attribute';
import type { AutPaginationCustomElement } from '../src/aurelia-table-pagination';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-table', () => {
  test('aut-select toggles when clicking nested content in a cell', async () => {
    const rows = [{ name: 'A' }, { name: 'B' }];
    const { appHost, startPromise, tearDown } = await createFixture(
      `<table aurelia-table data.bind="rows">
        <tbody>
          <tr repeat.for="row of rows" aut-select="row.bind: row">
            <td><span class="inner">\${row.name}</span></td>
          </tr>
        </tbody>
      </table>`,
      class App {
        rows = rows;
      },
      [AureliaTableConfiguration]
    );

    await startPromise;

    const span = appHost.querySelector('tbody tr:first-child span') as HTMLElement;
    span.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(rows[0].$isSelected).toBe(true);

    const rowEl = appHost.querySelector('tbody tr') as HTMLElement;
    expect(rowEl.classList.contains('aut-row-selected')).toBe(true);

    await tearDown();
  });

  test('aut-select reacts when row is set after binding', async () => {
    const { appHost, component, startPromise, tearDown } = await createFixture(
      `<table>
        <tbody>
          <tr aut-select="row.bind: row">
            <td>Row</td>
          </tr>
        </tbody>
      </table>`,
      class App {
        row: any;
      },
      [AureliaTableConfiguration]
    );

    await startPromise;

    const rowEl = appHost.querySelector('tr') as HTMLElement;
    expect(rowEl.classList.contains('aut-row-selected')).toBe(false);

    component.row = { name: 'Loaded', $isSelected: true };
    await flush();

    expect(rowEl.classList.contains('aut-row-selected')).toBe(true);

    await tearDown();
  });

  test('aut-sort updates table state even in server mode', async () => {
    const { appHost, startPromise, tearDown } = await createFixture(
      `<table aurelia-table="data-source.bind: dataSource; data.bind: rows">
        <thead>
          <tr>
            <th id="name-header" aut-sort="key.bind: 'name'"></th>
          </tr>
        </thead>
      </table>`,
      class App {
        dataSource = 'server';
        rows = [{ name: 'A' }];
      },
      [AureliaTableConfiguration]
    );

    await startPromise;

    const tableEl = appHost.querySelector('table') as HTMLElement;
    const tableAttr = CustomAttribute.for(tableEl, 'aurelia-table')?.viewModel as AureliaTableCustomAttribute;
    expect(tableAttr.sortKey).toBeUndefined();

    const header = appHost.querySelector('#name-header') as HTMLElement;
    header.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(tableAttr.sortKey).toBe('name');
    expect(tableAttr.sortOrder).toBe(1);

    await tearDown();
  });

  test('aut-pagination defaults totalItems to 0 when unset', async () => {
    const { appHost, startPromise, tearDown } = await createFixture(
      '<aut-pagination></aut-pagination>',
      class App {},
      [AureliaTableConfiguration]
    );

    await startPromise;

    const paginationEl = appHost.querySelector('aut-pagination') as HTMLElement;
    const paginationVm = CustomElement.for(paginationEl)?.viewModel as AutPaginationCustomElement;

    expect(Number.isNaN(paginationVm.totalPages)).toBe(false);
    expect(paginationVm.totalPages).toBe(1);

    await tearDown();
  });

  test('filters update displayData and reset currentPage when paginated', async () => {
    const { component, startPromise, tearDown } = await createFixture(
      `<table aurelia-table="data.bind: data; display-data.two-way: displayData; current-page.two-way: currentPage; page-size.bind: pageSize; total-items.two-way: totalItems; filters.bind: filters"></table>`,
      class App {
        data = [
          { name: 'Alpha' },
          { name: 'Beta' },
          { name: 'Gamma' },
          { name: 'Alphabet' },
        ];
        displayData: any[] = [];
        filters = [{ value: '', keys: ['name'] }];
        currentPage = 2;
        pageSize = 2;
        totalItems = 0;
      },
      [AureliaTableConfiguration]
    );

    await startPromise;
    await flush();

    expect(component.displayData.map((item) => item.name)).toEqual(['Gamma', 'Alphabet']);
    expect(component.currentPage).toBe(2);

    component.filters[0].value = 'Al';
    await flush();

    expect(component.currentPage).toBe(1);
    expect(component.totalItems).toBe(2);
    expect(component.displayData.map((item) => item.name)).toEqual(['Alpha', 'Alphabet']);

    await tearDown();
  });

  test('pagination updates displayData when currentPage changes', async () => {
    const { component, startPromise, tearDown } = await createFixture(
      `<table aurelia-table="data.bind: data; display-data.two-way: displayData; current-page.two-way: currentPage; page-size.bind: pageSize"></table>`,
      class App {
        data = [
          { name: 'Alpha' },
          { name: 'Beta' },
          { name: 'Gamma' },
          { name: 'Delta' },
          { name: 'Epsilon' },
        ];
        displayData: any[] = [];
        currentPage = 1;
        pageSize = 2;
      },
      [AureliaTableConfiguration]
    );

    await startPromise;
    await flush();

    expect(component.displayData.map((item) => item.name)).toEqual(['Alpha', 'Beta']);

    component.currentPage = 3;
    await flush();

    expect(component.displayData.map((item) => item.name)).toEqual(['Epsilon']);

    await tearDown();
  });
});
