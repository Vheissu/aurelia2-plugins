# Aurelia 2 Table

A lightweight table helper for **Aurelia 2** that adds client-side filtering, sorting, pagination, and row selection. This package is **Aurelia 2 only** (no Aurelia 1 support).

## Install

```bash
npm install aurelia2-table
```

## Register

```ts
import Aurelia from 'aurelia';
import { AureliaTableConfiguration } from 'aurelia2-table';

Aurelia
  .register(AureliaTableConfiguration)
  .app(MyApp)
  .start();
```

## Client-side usage

```html
<template>
  <input value.bind="filters[0].value" placeholder="Filter by name" />

  <table
    aurelia-table="data.bind: rows; display-data.two-way: displayRows; current-page.two-way: currentPage; page-size.bind: pageSize; total-items.two-way: totalItems; filters.bind: filters"
  >
    <thead>
      <tr>
        <th aut-sort="key.bind: 'name'">Name</th>
        <th aut-sort="key.bind: 'role'">Role</th>
      </tr>
    </thead>
    <tbody>
      <tr repeat.for="row of displayRows" aut-select="row.bind: row">
        <td>\${row.name}</td>
        <td>\${row.role}</td>
      </tr>
    </tbody>
  </table>

  <aut-pagination
    current-page.two-way="currentPage"
    page-size.bind="pageSize"
    total-items.bind="totalItems"
  ></aut-pagination>
</template>
```

```ts
export class MyApp {
  rows = [
    { name: 'Ada', role: 'Engineer' },
    { name: 'Grace', role: 'Scientist' },
    { name: 'Linus', role: 'Maintainer' },
  ];

  displayRows: Array<{ name: string; role: string }> = [];
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;

  filters = [
    { value: '', keys: ['name', 'role'] }
  ];
}
```

## Server-side usage

When `data-source` is set to `server`, the table skips client-side filtering/sorting/pagination. You can use `TableSettings` to drive your fetch calls.

```ts
import { TableSettings } from 'aurelia2-table';

type Row = { id: number; name: string };

export class MyApp {
  settings = new TableSettings(async (query) => {
    const response = await fetch(`/api/users?start=${query.start}&pageSize=${query.pageSize}`);
    return response.json() as Promise<{ items: Row[]; totalItems: number; draw: number }>;
  });

  async attached() {
    await this.settings.loadItems();
  }
}
```

```html
<table
  aurelia-table="data-source.bind: 'server'; data.bind: settings.items"
>
  <thead>
    <tr>
      <th aut-sort="key.bind: 'name'">Name</th>
    </tr>
  </thead>
  <tbody>
    <tr repeat.for="row of settings.items">
      <td>\${row.name}</td>
    </tr>
  </tbody>
</table>

<aut-pagination
  current-page.two-way="settings.currentPage"
  page-size.two-way="settings.pageSize"
  total-items.bind="settings.totalItems"
></aut-pagination>
```

## Notes

- Multi-binding is supported via `aurelia-table="data.bind: rows; display-data.two-way: displayRows; ..."`. Use bindable attribute names (kebab-case) there.
- `aut-sort` adds CSS classes (`aut-desc`, `aut-sortable`, `aut-asc`) you can style.
- `aut-select` dispatches a `select` event with `detail.row` when a row becomes selected.
- `aut-pagination` dispatches `page-changed` with `detail.currentPage` whenever the page changes.
- `aurelia-table` exposes `api.revealItem(item)` to jump to the page containing a row (client-side only).
