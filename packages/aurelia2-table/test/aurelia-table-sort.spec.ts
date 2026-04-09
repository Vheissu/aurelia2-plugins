import { describe, expect, test } from '@jest/globals';

import { AureliaTableCustomAttribute } from '../src/aurelia-table-attribute';
import { AutSortCustomAttribute } from '../src/aurelia-table-sort';

describe('aurelia2-table sort', () => {
  test('aut-sort initializes after key arrives and sorts on click', () => {
    const tableViewModel = new AureliaTableCustomAttribute();
    tableViewModel.isAttached = true;
    tableViewModel.data = [
      { name: 'Charlie' },
      { name: 'Alice' },
      { name: 'Bob' }
    ] as any;

    const header = document.createElement('th');
    const sortViewModel = new AutSortCustomAttribute();

    sortViewModel.created({
      host: header,
      parent: {
        viewModel: tableViewModel,
        parent: null
      }
    } as any);

    sortViewModel.attached();

    expect(tableViewModel.sortKey).toBeUndefined();
    expect(header.classList.contains('aut-sort')).toBe(false);

    sortViewModel.key = 'name';
    sortViewModel.keyChanged();

    expect(header.classList.contains('aut-sort')).toBe(true);

    header.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(tableViewModel.sortKey).toBe('name');
    expect(tableViewModel.sortOrder).toBe(1);
    expect(tableViewModel.displayData.map((row: any) => row.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(header.classList.contains('aut-asc')).toBe(true);
  });

  test('sortChanged sorts local data ascending', () => {
    const tableViewModel = new AureliaTableCustomAttribute();
    tableViewModel.isAttached = true;
    tableViewModel.data = [
      { name: 'Charlie' },
      { name: 'Alice' },
      { name: 'Bob' }
    ] as any;

    tableViewModel.sortChanged('name', undefined, 1);

    expect(tableViewModel.displayData.map((row: any) => row.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });
});