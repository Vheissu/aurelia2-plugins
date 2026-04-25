# aurelia2-date-picker

Date picker UI for Aurelia 2 with a text input, month popover, min/max constraints, localization, two-way ISO value binding, and selected-date events.

## Install

```bash
npm install aurelia2-date-picker
```

## Register

```ts
import { AureliaDatePickerConfiguration } from 'aurelia2-date-picker';

Aurelia.register(
  AureliaDatePickerConfiguration.configure({
    locale: 'en-AU',
    firstDayOfWeek: 1,
  })
);
```

## Usage

```html
<au-date-picker
  value.two-way="startDate"
  min.bind="today"
  date-picker-select.trigger="dateSelected($event.detail)">
</au-date-picker>
```

`value` is an ISO `YYYY-MM-DD` string. `selected-date` can be two-way bound when a `Date` object is more convenient.

This package targets Aurelia 2 `>=2.0.0-rc.1`.
