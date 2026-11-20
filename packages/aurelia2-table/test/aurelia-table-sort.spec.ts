import { describe, expect, test } from '@jest/globals';
import { tasksSettled } from '@aurelia/runtime';
import { createFixture } from '@aurelia/testing';
import { CustomAttribute } from 'aurelia';

import { AureliaTableConfiguration, AureliaTableCustomAttribute } from '../src/index';

describe('aurelia2-table sort', () => {
  test('initializes after the key arrives, sorts, and removes listeners on teardown', async () => {
    const fixture = await createFixture(
      `<table aurelia-table="data.bind: rows; display-data.two-way: displayRows">
        <thead><tr><th aut-sort="key.bind: key">Name</th></tr></thead>
      </table>`,
      {
        rows: ['Charlie', 'Alice', 'Bob'].map((name) => ({ name })),
        displayRows: [] as Array<{ name: string }>,
        key: '',
      },
      [AureliaTableConfiguration],
    ).started;
    const { component } = fixture;
    const header = fixture.getBy('th')!;
    const table = CustomAttribute.for(fixture.getBy('table')!, 'aurelia-table')!
      .viewModel as AureliaTableCustomAttribute;

    expect(header.classList.contains('aut-sort')).toBe(false);
    component.key = 'name';
    await tasksSettled();
    expect(header.classList.contains('aut-sort')).toBe(true);

    header.click();
    expect(component.displayRows.map((row) => row.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(header.classList.contains('aut-asc')).toBe(true);

    await fixture.tearDown();
    expect(table.sortChangedListeners).toHaveLength(0);
    header.click();
    expect(header.classList.contains('aut-asc')).toBe(true);
  });

  test('changes sort state without sorting the data in server mode', async () => {
    const fixture = await createFixture(
      `<table aurelia-table="data-source: server; data.bind: rows; display-data.two-way: displayRows">
        <thead><tr><th aut-sort="key: name">Name</th></tr></thead>
      </table>`,
      {
        rows: [{ name: 'Alpha' }],
        displayRows: [] as Array<{ name: string }>,
      },
      [AureliaTableConfiguration],
    ).started;
    const header = fixture.getBy('th')!;
    const table = CustomAttribute.for(fixture.getBy('table')!, 'aurelia-table')!
      .viewModel as AureliaTableCustomAttribute;

    header.click();
    expect(table.sortKey).toBe('name');
    expect(table.sortOrder).toBe(1);
    expect(fixture.component.displayRows).toEqual([]);
    expect(header.classList.contains('aut-asc')).toBe(true);

    header.click();
    expect(table.sortOrder).toBe(-1);
    expect(header.classList.contains('aut-desc')).toBe(true);
    await fixture.tearDown();
  });
});
