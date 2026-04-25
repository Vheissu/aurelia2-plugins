# aurelia2-autocomplete

Autocomplete and combobox UI for Aurelia 2. It supports local filtering, async search, keyboard navigation, single or multiple selection, chips, and selection events.

## Install

```bash
npm install aurelia2-autocomplete
```

## Register

```ts
import { AureliaAutocompleteConfiguration } from 'aurelia2-autocomplete';

Aurelia.register(AureliaAutocompleteConfiguration);
```

## Usage

```html
<au-autocomplete
  options.bind="people"
  selected.two-way="assignee"
  query.two-way="assigneeSearch"
  autocomplete-select.trigger="trackSelection($event.detail)">
</au-autocomplete>
```

```ts
people = [
  { value: 1, label: 'Ada Lovelace', description: 'Engineering' },
  { value: 2, label: 'Grace Hopper', keywords: ['compiler'] },
];
```

For remote search, bind a `search` function that returns options.

This package targets Aurelia 2 `>=2.0.0-rc.1`.
