# aurelia2-calendar

A flexible, customizable calendar component for Aurelia 2 applications. Supports month, week, and year views with item rendering, date selection, and full slot-based customization.

## Installation

```bash
npm install aurelia2-calendar
```

## Registration

```typescript
import Aurelia from 'aurelia';
import { AureliaCalendarConfiguration } from 'aurelia2-calendar';

Aurelia
  .register(AureliaCalendarConfiguration)
  .app(MyApp)
  .start();
```

## Basic Usage

```html
<au-calendar
  items.bind="events"
  show-date.bind="currentDate"
  display-period-uom="month"
  on-date-click.bind="(detail) => handleDateClick(detail)"
  on-item-click.bind="(detail) => handleItemClick(detail)"
></au-calendar>
```

## Bindable Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `showDate` | `Date` | `new Date()` | The reference date for the displayed period |
| `displayPeriodUom` | `'week' \| 'month' \| 'year'` | `'month'` | The period to display |
| `displayPeriodCount` | `number` | `1` | Number of periods to display |
| `displayWeekNumbers` | `boolean` | `false` | Show ISO week numbers |
| `locale` | `string \| undefined` | `undefined` | BCP 47 locale string |
| `monthNameFormat` | `'long' \| 'short' \| 'narrow'` | `'long'` | Month name format |
| `weekdayNameFormat` | `'long' \| 'short' \| 'narrow'` | `'short'` | Weekday header format |
| `showTimes` | `boolean` | `false` | Show item start/end times |
| `timeFormatOptions` | `object` | `{}` | `Intl.DateTimeFormat` options for times |
| `disablePast` | `boolean` | `false` | Disable interaction with past dates |
| `disableFuture` | `boolean` | `false` | Disable interaction with future dates |
| `enableDateSelection` | `boolean` | `false` | Enable date range selection |
| `selectionStart` | `Date \| null` | `null` | Start of selected date range |
| `selectionEnd` | `Date \| null` | `null` | End of selected date range |
| `startingDayOfWeek` | `number` | `0` | First day of week (0 = Sunday) |
| `items` | `CalendarItem[]` | `[]` | Calendar items to display |
| `dateClasses` | `Record<string, string \| string[]>` | `{}` | CSS classes keyed by ISO date |
| `itemTop` | `string` | `'1.4em'` | CSS top offset for items |
| `itemContentHeight` | `string` | `'1.4em'` | CSS height for item content |
| `itemBorderHeight` | `string` | `'2px'` | CSS border height for items |
| `monthNameOnFirst` | `boolean` | `true` | Only show month name on the 1st |

## Events

The component emits DOM `CustomEvent`s and supports callback bindables:

| Event | Callback Prop | Detail Type | Description |
|---|---|---|---|
| `calendar-date-click` | `onDateClick` | `CalendarDateClickDetail` | A date cell is clicked |
| `calendar-item-click` | `onItemClick` | `CalendarItemClickDetail` | A calendar item is clicked |
| `calendar-period-change` | `onPeriodChange` | `CalendarPeriodChangeDetail` | Displayed period changes |

```typescript
// Listening via callback bindable
handleDateClick(detail: CalendarDateClickDetail) {
  console.log('Clicked date:', detail.date);
  console.log('Items on that date:', detail.items);
}

// Listening via DOM event
<au-calendar calendar-date-click.trigger="onDateClicked($event)"></au-calendar>
```

## Calendar Item Interface

```typescript
interface CalendarItem {
  id: string;
  startDate: Date | string | number;
  title: string;
  tooltip?: string;
  endDate?: Date | string | number;
  url?: string;
  classes?: string[] | string | null;
  style?: string;
}
```

## Slots

The component provides `<au-slot>` slots for customization:

- **`header`** -- Override the navigation header
- **`day-header`** -- Override weekday column headers
- **`week-number`** -- Override week number display
- **`day-content`** -- Override day cell content
- **`item`** -- Override how items are rendered

## Utility: CalendarMath

A collection of pure date math functions is exported for use in your own code:

```typescript
import { CalendarMath } from 'aurelia2-calendar';

CalendarMath.addDays(date, 7);
CalendarMath.beginningOfWeek(date, 0);
CalendarMath.isSameMonth(date1, date2);
CalendarMath.getFormattedMonthNames('en-US', 'long');
```

## License

MIT
