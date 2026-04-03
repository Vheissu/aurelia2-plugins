import { describe, expect, jest, test } from '@jest/globals';
import { createFixture } from '@aurelia/testing';

import { AureliaTableCustomAttribute } from '../src/aurelia-table-attribute';
import { AutPaginationCustomElement } from '../src/aurelia-table-pagination';
import { AutSelectCustomAttribute } from '../src/aurelia-table-select';
import { AutSortCustomAttribute } from '../src/aurelia-table-sort';
import { AureliaTableConfiguration } from '../src/index';

function createController(host: HTMLElement, viewModel?: unknown, parent: any = null) {
  return { host, viewModel, parent };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-table', () => {
  test('applies filters and pagination to displayData and resets currentPage on filter change', () => {
    const table = new AureliaTableCustomAttribute();
    table.isAttached = true;
    table.data = [
      { name: 'Alpha' },
      { name: 'Beta' },
      { name: 'Gamma' },
      { name: 'Alphabet' },
    ];
    table.displayData = [];
    table.filters = [{ value: '', keys: ['name'] }];
    table.currentPage = 2;
    table.pageSize = 2;

    table.applyPlugins();

    expect(table.displayData.map((item) => item.name)).toEqual(['Gamma', 'Alphabet']);
    expect(table.totalItems).toBe(4);

    table.filters[0].value = 'Al';
    table.filterChanged();

    expect(table.currentPage).toBe(1);
    expect(table.totalItems).toBe(2);
    expect(table.displayData.map((item) => item.name)).toEqual(['Alpha', 'Alphabet']);
  });

  test('revealItem switches to the page containing the requested row', () => {
    const table = new AureliaTableCustomAttribute();
    const rows = [
      { name: 'Alpha' },
      { name: 'Beta' },
      { name: 'Gamma' },
      { name: 'Delta' },
      { name: 'Epsilon' },
    ];

    table.isAttached = true;
    table.data = rows;
    table.currentPage = 1;
    table.pageSize = 2;
    table.applyPlugins();

    expect(table.revealItem(rows[4])).toBe(true);
    expect(table.currentPage).toBe(3);
    expect(table.revealItem({ name: 'Missing' })).toBe(false);
  });

  test('aut-select toggles selection from nested cell clicks and deselects sibling rows in single mode', () => {
    const rowElement = document.createElement('tr');
    const cell = document.createElement('td');
    const inner = document.createElement('span');
    cell.append(inner);
    rowElement.append(cell);

    const selectedRows = [{ name: 'Alpha' }, { name: 'Beta', $isSelected: true }];
    const table = new AureliaTableCustomAttribute();
    table.data = selectedRows;

    const select = new AutSelectCustomAttribute();
    const selectSpy = jest.fn();
    rowElement.addEventListener('select', selectSpy as EventListener);

    select.row = selectedRows[0];
    select.mode = 'single';
    select.created(createController(rowElement, select, createController(document.createElement('table'), table)));
    select.attached();

    inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    select.isSelectedChanged();

    expect(select.row.$isSelected).toBe(true);
    expect(selectedRows[1].$isSelected).toBe(false);
    expect(rowElement.classList.contains('aut-row-selected')).toBe(true);
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  test('aut-select updates its CSS class when a row is assigned after created', () => {
    const rowElement = document.createElement('tr');
    rowElement.append(document.createElement('td'));

    const select = new AutSelectCustomAttribute();
    select.created(createController(rowElement, select));
    select.row = { name: 'Loaded', $isSelected: true };

    select.rowChanged();

    expect(rowElement.classList.contains('aut-row-selected')).toBe(true);
  });

  test('aut-sort updates table sort state in server mode when the header is clicked', () => {
    const header = document.createElement('th');
    const table = new AureliaTableCustomAttribute();
    table.dataSource = 'server';
    table.data = [{ name: 'Alpha' }];

    const sort = new AutSortCustomAttribute();
    sort.key = 'name';
    sort.created(createController(header, sort, createController(document.createElement('table'), table)));
    sort.attached();

    header.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(table.sortKey).toBe('name');
    expect(table.sortOrder).toBe(1);
    expect(header.classList.contains('aut-asc')).toBe(true);

    header.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(table.sortOrder).toBe(-1);
    expect(header.classList.contains('aut-desc')).toBe(true);
  });

  test('aut-pagination defaults invalid inputs and dispatches page-changed from its host element', () => {
    const host = document.createElement('aut-pagination');
    const pagination = new AutPaginationCustomElement();
    const eventSpy = jest.fn();

    host.addEventListener('page-changed', eventSpy as EventListener);

    pagination.created(createController(host, pagination));
    pagination.currentPage = 0;
    pagination.pageSize = 0;
    pagination.totalItems = undefined;
    pagination.bind();

    expect(pagination.currentPage).toBe(1);
    expect(pagination.pageSize).toBe(5);
    expect(pagination.totalItems).toBe(0);
    expect(pagination.totalPages).toBe(1);

    pagination.pageSize = 5;
    pagination.totalItems = 12;
    pagination.currentPage = 2;
    pagination.currentPageChanged();

    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect((eventSpy.mock.calls[0][0] as CustomEvent).detail).toEqual({ currentPage: 2 });
  });

  test('aut-pagination limits visible pages around the active tier', () => {
    const pagination = new AutPaginationCustomElement();
    pagination.created(createController(document.createElement('aut-pagination'), pagination));
    pagination.currentPage = 6;
    pagination.pageSize = 5;
    pagination.totalItems = 50;
    pagination.paginationSize = 3;

    pagination.bind();

    expect(pagination.totalPages).toBe(10);
    expect(pagination.displayPages).toEqual([
      { title: '...', value: 3 },
      { title: '4', value: 4 },
      { title: '5', value: 5 },
      { title: '6', value: 6 },
      { title: '...', value: 7 },
    ]);
  });

  test('aut-pagination renders its pagination shell in an Aurelia fixture', async () => {
    const { appHost, startPromise, tearDown } = createFixture(
      '<aut-pagination current-page.bind="currentPage" page-size.bind="pageSize" total-items.bind="totalItems"></aut-pagination>',
      class App {
        currentPage = 1;
        pageSize = 5;
        totalItems = 12;
      },
      [AureliaTableConfiguration]
    );

    await startPromise;
    await flush();

    const paginationEl = appHost.querySelector('aut-pagination');
    expect(paginationEl).not.toBeNull();

    const nav = paginationEl!.querySelector('nav');
    expect(nav).not.toBeNull();

    const pageLinks = Array.from(paginationEl!.querySelectorAll('a.page-link'));
    expect(pageLinks.length).toBeGreaterThanOrEqual(2);

    await tearDown();
  });
});
