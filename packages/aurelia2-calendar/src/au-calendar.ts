import { bindable, customElement } from 'aurelia';
import { CalendarMath } from './calendar-math';
import template from './au-calendar.template';
import {
  CalendarDateClickDetail,
  CalendarItem,
  CalendarItemClickDetail,
  CalendarPeriodChangeDetail,
  CalendarPeriodUom,
  DateInput,
  DateTimeFormatOption,
  NormalizedCalendarItem,
} from './types';

type DateClasses = Record<string, string | string[]>;

interface DayHeaderView {
  index: number;
  label: string;
  className: string;
}

interface DayView {
  date: Date;
  iso: string;
  monthDay: string;
  dayOfMonth: string;
  classList: string;
  ariaSelected: boolean;
  monthLabel: string;
}

interface WeekItemView {
  id: string;
  classList: string;
  style: string;
  top: string;
  title: string;
  tooltip?: string;
  url?: string;
  raw: NormalizedCalendarItem;
}

interface WeekView {
  start: Date;
  isoStart: string;
  weekNumber: number;
  days: DayView[];
  items: WeekItemView[];
}

interface CalendarHeaderProps {
  previousYear: Date;
  previousPeriod: Date;
  nextPeriod: Date;
  previousFullPeriod: Date;
  nextFullPeriod: Date;
  nextYear: Date;
  currentPeriod: Date;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  displayLocale: string;
  displayFirstDate: Date;
  displayLastDate: Date;
  monthNames: string[];
  fixedItems: NormalizedCalendarItem[];
}

const itemComparer = (a: NormalizedCalendarItem, b: NormalizedCalendarItem): number => {
  if (a.startDate < b.startDate) return -1;
  if (b.startDate < a.startDate) return 1;
  if (a.endDate > b.endDate) return -1;
  if (b.endDate > a.endDate) return 1;
  return a.id < b.id ? -1 : 1;
};

const normalizeDateClassList = (value: string | string[] | undefined): string[] => {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter((v) => !!v);
  return String(value)
    .split(/\s+/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
};

// Important: we use a non-noop coercer to avoid noop identity mismatches when
// different Aurelia entry points are optimized separately by Vite/Vitest.
// The identity coercer is safe and prevents values being coerced to undefined.
const identity = <T>(value: T): T => value;

@customElement({
  name: 'au-calendar',
  template,
  dependencies: [],
})
export class AuCalendarCustomElement {
  private host: HTMLElement | null = null;

  @bindable({ set: identity }) public showDate?: DateInput;
  @bindable({ set: identity }) public displayPeriodUom: CalendarPeriodUom = 'month';
  @bindable({ set: identity }) public displayPeriodCount = 1;
  @bindable({ set: identity }) public displayWeekNumbers = false;
  @bindable({ set: identity }) public locale?: string;
  @bindable({ set: identity }) public monthNameFormat: DateTimeFormatOption = 'long';
  @bindable({ set: identity }) public weekdayNameFormat: DateTimeFormatOption = 'short';
  @bindable({ set: identity }) public showTimes = false;
  @bindable({ set: identity }) public timeFormatOptions: Intl.DateTimeFormatOptions = {};
  @bindable({ set: identity }) public disablePast = false;
  @bindable({ set: identity }) public disableFuture = false;
  @bindable({ set: identity }) public enableDateSelection = false;
  @bindable({ set: identity }) public selectionStart?: DateInput;
  @bindable({ set: identity }) public selectionEnd?: DateInput;
  @bindable({ set: identity }) public startingDayOfWeek = 0;
  @bindable({ set: identity }) public items: CalendarItem[] = [];
  @bindable({ set: identity }) public dateClasses: DateClasses = {};
  @bindable({ set: identity }) public itemTop = '1.4em';
  @bindable({ set: identity }) public itemContentHeight = '1.4em';
  @bindable({ set: identity }) public itemBorderHeight = '2px';
  @bindable({ set: identity }) public monthNameOnFirst = true;

  @bindable({ set: identity }) public onDateClick?: (detail: CalendarDateClickDetail) => void;
  @bindable({ set: identity }) public onItemClick?: (detail: CalendarItemClickDetail) => void;
  @bindable({ set: identity }) public onPeriodChange?: (detail: CalendarPeriodChangeDetail) => void;

  public wrapperClassList = 'cv-wrapper';
  public periodLabel = '';
  public dayHeaders: DayHeaderView[] = [];
  public weeks: WeekView[] = [];
  public headerProps!: CalendarHeaderProps;

  private displayLocale = 'unk';
  private monthNames: string[] = [];
  private weekdayNames: string[] = [];
  private fixedItems: NormalizedCalendarItem[] = [];
  private periodStart: Date = CalendarMath.today();
  private periodEnd: Date = CalendarMath.today();
  private displayFirstDate: Date = CalendarMath.today();
  private displayLastDate: Date = CalendarMath.today();
  private defaultedShowDate: Date = CalendarMath.today();
  private lastPeriodKey = '';
  private lastClickedDate: Date | null = null;

  public binding(): void {
    this.ensureHost();
    this.recompute(true);
  }

  public showDateChanged(): void {
    this.recompute();
  }

  public displayPeriodUomChanged(): void {
    this.recompute();
  }

  public displayPeriodCountChanged(): void {
    this.recompute();
  }

  public displayWeekNumbersChanged(): void {
    this.recompute();
  }

  public localeChanged(): void {
    this.recompute();
  }

  public monthNameFormatChanged(): void {
    this.recompute();
  }

  public weekdayNameFormatChanged(): void {
    this.recompute();
  }

  public showTimesChanged(): void {
    this.recompute();
  }

  public timeFormatOptionsChanged(): void {
    this.recompute();
  }

  public disablePastChanged(): void {
    this.recompute();
  }

  public disableFutureChanged(): void {
    this.recompute();
  }

  public enableDateSelectionChanged(): void {
    this.recompute();
  }

  public selectionStartChanged(): void {
    this.recompute();
  }

  public selectionEndChanged(): void {
    this.recompute();
  }

  public startingDayOfWeekChanged(): void {
    this.recompute();
  }

  public itemsChanged(): void {
    this.recompute();
  }

  public dateClassesChanged(): void {
    this.recompute();
  }

  public itemTopChanged(): void {
    this.recompute();
  }

  public itemContentHeightChanged(): void {
    this.recompute();
  }

  public itemBorderHeightChanged(): void {
    this.recompute();
  }

  public monthNameOnFirstChanged(): void {
    this.recompute();
  }

  public previousPeriod(): void {
    this.navigateBy(-1);
  }

  public nextPeriod(): void {
    this.navigateBy(1);
  }

  public previousFullPeriod(): void {
    this.navigateBy(-this.displayPeriodCount);
  }

  public nextFullPeriod(): void {
    this.navigateBy(this.displayPeriodCount);
  }

  public previousYear(): void {
    const count = this.displayPeriodUom === 'year' ? -1 : -12;
    this.navigateBy(count);
  }

  public nextYear(): void {
    const count = this.displayPeriodUom === 'year' ? 1 : 12;
    this.navigateBy(count);
  }

  public goToToday(): void {
    this.showDate = CalendarMath.today();
    this.recompute(true);
  }

  public goToDate(date: DateInput): void {
    this.showDate = CalendarMath.dateOnly(date);
    this.recompute(true);
  }

  public getColumnDOWClass(index: number): string {
    return `dow${(this.startingDayOfWeek + index) % 7}`;
  }

  public onClickDay(day: DayView, event: Event): void {
    const date = day.date;
    if (this.disablePast && CalendarMath.isInPast(date)) return;
    if (this.disableFuture && CalendarMath.isInFuture(date)) return;

    // Track the last clicked date for simple single-date highlighting.
    this.lastClickedDate = CalendarMath.dateOnly(date);
    this.recompute();

    const items = this.findAndSortItemsInDateRange(date, date);
    const detail: CalendarDateClickDetail = { date, items, event };

    this.onDateClick?.(detail);
    this.dispatch('calendar-date-click', detail);
  }

  public onClickItem(item: WeekItemView, event: Event): void {
    event.stopPropagation();
    const detail: CalendarItemClickDetail = { item: item.raw, event };
    this.onItemClick?.(detail);
    this.dispatch('calendar-item-click', detail);
  }

  private recompute(forceEmit = false): void {
    this.displayLocale = this.locale || CalendarMath.getDefaultBrowserLocale();

    const defaultedShowDate = this.showDate ? CalendarMath.dateOnly(this.showDate) : CalendarMath.today();
    this.defaultedShowDate = defaultedShowDate;

    this.periodStart = CalendarMath.beginningOfPeriod(defaultedShowDate, this.displayPeriodUom, this.startingDayOfWeek);
    this.periodEnd = CalendarMath.addDays(
      CalendarMath.incrementPeriod(this.periodStart, this.displayPeriodUom, this.displayPeriodCount),
      -1
    );

    this.displayFirstDate = CalendarMath.beginningOfWeek(this.periodStart, this.startingDayOfWeek);
    this.displayLastDate = CalendarMath.endOfWeek(this.periodEnd, this.startingDayOfWeek);

    const numWeeks = Math.floor((CalendarMath.dayDiff(this.displayFirstDate, this.displayLastDate) + 1) / 7);
    const weekStarts = Array.from({ length: numWeeks }, (_, i) => CalendarMath.addDays(this.displayFirstDate, i * 7));

    this.monthNames = CalendarMath.getFormattedMonthNames(this.displayLocale, this.monthNameFormat);
    this.weekdayNames = CalendarMath.getFormattedWeekdayNames(this.displayLocale, this.weekdayNameFormat, this.startingDayOfWeek);
    this.fixedItems = (this.items ?? []).map((item) => CalendarMath.normalizeItem(item)).sort(itemComparer);

    const startWeekNumber = this.computePeriodStartWeekNumber();

    this.dayHeaders = this.weekdayNames.map((label, index) => ({
      index,
      label,
      className: this.getColumnDOWClass(index),
    }));

    this.weeks = weekStarts.map((start, index) => this.buildWeekView(start, startWeekNumber + index));
    this.periodLabel = CalendarMath.formattedPeriod(this.periodStart, this.periodEnd, this.displayPeriodUom, this.monthNames);

    this.headerProps = {
      previousYear: this.getIncrementedPeriod(this.displayPeriodUom === 'year' ? -1 : -12),
      previousPeriod: this.getIncrementedPeriod(-1),
      nextPeriod: this.getIncrementedPeriod(1),
      previousFullPeriod: this.getIncrementedPeriod(-this.displayPeriodCount),
      nextFullPeriod: this.getIncrementedPeriod(this.displayPeriodCount),
      nextYear: this.getIncrementedPeriod(this.displayPeriodUom === 'year' ? 1 : 12),
      currentPeriod: CalendarMath.beginningOfPeriod(CalendarMath.today(), this.displayPeriodUom, this.startingDayOfWeek),
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      periodLabel: this.periodLabel,
      displayLocale: this.displayLocale,
      displayFirstDate: this.displayFirstDate,
      displayLastDate: this.displayLastDate,
      monthNames: this.monthNames,
      fixedItems: this.fixedItems,
    };

    this.updateWrapperClasses();
    this.emitPeriodChange(forceEmit);
  }

  private buildWeekView(weekStart: Date, weekNumber: number): WeekView {
    const days = CalendarMath.daysOfWeek(weekStart).map((day, dayIndex) => this.buildDayView(day, dayIndex));
    const items = this.getWeekItems(weekStart).map((item) => this.toWeekItemView(item));
    return {
      start: weekStart,
      isoStart: CalendarMath.isoYearMonthDay(weekStart),
      weekNumber,
      days,
      items,
    };
  }

  private buildDayView(day: Date, dayIndex: number): DayView {
    const iso = CalendarMath.isoYearMonthDay(day);
    const customClasses = normalizeDateClassList(this.dateClasses?.[iso]);
    const isSelected = this.dayIsSelected(day);
    const isLastClicked = this.lastClickedDate != null && CalendarMath.isSameDate(day, this.lastClickedDate);

    const classes = [
      'cv-day',
      this.getColumnDOWClass(dayIndex),
      `d${iso}`,
      `d${CalendarMath.isoMonthDay(day)}`,
      `d${CalendarMath.paddedDay(day)}`,
      `instance${CalendarMath.instanceOfMonth(day)}`,
    ];

    if (CalendarMath.isSameDate(day, CalendarMath.today())) classes.push('today');
    if (!CalendarMath.isSameMonth(day, this.defaultedShowDate)) classes.push('outsideOfMonth');
    if (CalendarMath.isInPast(day)) classes.push('past');
    if (CalendarMath.isInFuture(day)) classes.push('future');
    if (CalendarMath.isLastDayOfMonth(day)) classes.push('last');
    if (CalendarMath.isLastInstanceOfMonth(day)) classes.push('lastInstance');
    if (this.dayHasItems(day)) classes.push('hasItems');
    if (this.selectionStart && CalendarMath.isSameDate(day, this.selectionStart)) classes.push('selectionStart');
    if (this.selectionEnd && CalendarMath.isSameDate(day, this.selectionEnd)) classes.push('selectionEnd');
    if (isLastClicked) classes.push('selectedDay');

    classes.push(...customClasses);

    return {
      date: day,
      iso,
      monthDay: CalendarMath.isoMonthDay(day),
      dayOfMonth: CalendarMath.paddedDay(day),
      classList: classes.join(' '),
      ariaSelected: isSelected,
      monthLabel: this.fomName(day),
    };
  }

  private computePeriodStartWeekNumber(): number {
    const jan1 = new Date(this.periodStart.getFullYear(), 0, 1);
    const firstThursday = CalendarMath.addDays(jan1, (11 - jan1.getDay()) % 7);
    const startOfFirstWeek = CalendarMath.beginningOfPeriod(firstThursday, 'week', this.startingDayOfWeek);
    const periodWeekStarts = CalendarMath.beginningOfWeek(this.periodStart, this.startingDayOfWeek);
    return 1 + Math.floor(CalendarMath.dayDiff(startOfFirstWeek, periodWeekStarts) / 7);
  }

  private getIncrementedPeriod(count: number): Date {
    return CalendarMath.incrementPeriod(this.periodStart, this.displayPeriodUom, count);
  }

  private navigateBy(count: number): void {
    const nextDate = CalendarMath.incrementPeriod(this.periodStart, this.displayPeriodUom, count);
    this.showDate = CalendarMath.dateOnly(nextDate);
    this.recompute(true);
  }

  private dayHasItems(day: Date): boolean {
    return this.fixedItems.some((item) => item.endDate >= day && CalendarMath.dateOnly(item.startDate) <= day);
  }

  private dayIsSelected(day: Date): boolean {
    if (this.lastClickedDate && CalendarMath.isSameDate(day, this.lastClickedDate)) {
      return true;
    }
    if (!this.selectionStart || !this.selectionEnd) return false;
    const start = CalendarMath.dateOnly(this.selectionStart);
    const end = CalendarMath.dateOnly(this.selectionEnd);
    if (day < start) return false;
    if (day > end) return false;
    return true;
  }

  private fomName(day: Date): string {
    const showMonthNameOnFirst = this.monthNameOnFirst && (this.displayPeriodUom !== 'month' || this.displayPeriodCount > 1);
    if (!showMonthNameOnFirst) return '';
    return day.getDate() === 1 ? this.monthNames[day.getMonth()] : '';
  }

  private findAndSortItemsInDateRange(startDate: Date, endDate: Date): NormalizedCalendarItem[] {
    return this.fixedItems
      .filter((item) => item.endDate >= startDate && CalendarMath.dateOnly(item.startDate) <= endDate)
      .sort(itemComparer);
  }

  private findAndSortItemsInWeek(weekStart: Date): NormalizedCalendarItem[] {
    return this.findAndSortItemsInDateRange(weekStart, CalendarMath.addDays(weekStart, 6));
  }

  private getWeekItems(weekStart: Date): NormalizedCalendarItem[] {
    const items = this.findAndSortItemsInWeek(weekStart);
    const results: NormalizedCalendarItem[] = [];
    const itemRows: boolean[][] = [[], [], [], [], [], [], []];

    for (const item of items) {
      const ep: NormalizedCalendarItem = {
        ...item,
        classes: [...item.classes],
        itemRow: 0,
      };

      const continued = ep.startDate < weekStart;
      const startOffset = continued ? 0 : CalendarMath.dayDiff(weekStart, ep.startDate);
      const span = Math.max(
        1,
        Math.min(7 - startOffset, CalendarMath.dayDiff(CalendarMath.addDays(weekStart, startOffset), ep.endDate) + 1)
      );

      if (continued) ep.classes.push('continued');
      if (CalendarMath.dayDiff(weekStart, ep.endDate) > 6) ep.classes.push('toBeContinued');
      if (CalendarMath.isInPast(ep.endDate)) ep.classes.push('past');
      if (ep.originalItem.url) ep.classes.push('hasUrl');

      for (let d = 0; d < 7; d++) {
        if (d === startOffset) {
          let row = 0;
          while (itemRows[d][row]) row++;
          ep.itemRow = row;
          itemRows[d][row] = true;
        } else if (d < startOffset + span) {
          itemRows[d][ep.itemRow!] = true;
        }
      }

      ep.classes.push(`offset${startOffset}`);
      ep.classes.push(`span${span}`);
      results.push(ep);
    }

    return results;
  }

  private getItemTitle(item: NormalizedCalendarItem): string {
    if (!this.showTimes) return item.title;
    const startTime = CalendarMath.formattedTime(item.startDate, this.displayLocale, this.timeFormatOptions);
    const endTime = CalendarMath.isSameDateTime(item.startDate, item.endDate)
      ? ''
      : CalendarMath.formattedTime(item.endDate, this.displayLocale, this.timeFormatOptions);
    const timeRange = [startTime, endTime].filter((value) => value.length > 0).join(' - ');
    return timeRange.length > 0 ? `${timeRange} ${item.title}` : item.title;
  }

  private getItemTop(item: NormalizedCalendarItem): string {
    const r = item.itemRow ?? 0;
    const h = this.itemContentHeight;
    const b = this.itemBorderHeight;
    return `calc(${this.itemTop} + ${r} * ${h} + ${r} * ${b})`;
  }

  private toWeekItemView(item: NormalizedCalendarItem): WeekItemView {
    const top = this.getItemTop(item);
    const baseStyle = item.originalItem.style ? `${item.originalItem.style}` : '';
    const style = `top:${top};${baseStyle}`;
    return {
      id: item.id,
      classList: ['cv-item', ...item.classes].join(' '),
      style,
      top,
      title: this.getItemTitle(item),
      tooltip: item.tooltip,
      url: item.url,
      raw: item,
    };
  }

  private updateWrapperClasses(): void {
    const classes = [
      'cv-wrapper',
      `locale-${CalendarMath.languageCode(this.displayLocale)}`,
      `locale-${this.displayLocale}`,
      `y${this.periodStart.getFullYear()}`,
      `m${CalendarMath.paddedMonth(this.periodStart)}`,
      `period-${this.displayPeriodUom}`,
      `periodCount-${this.displayPeriodCount}`,
    ];

    if (CalendarMath.isPastMonth(this.periodStart)) classes.push('past');
    if (CalendarMath.isFutureMonth(this.periodStart)) classes.push('future');
    if (!CalendarMath.supportsIntl()) classes.push('noIntl');

    this.wrapperClassList = classes.join(' ');
  }

  private emitPeriodChange(forceEmit: boolean): void {
    const key = `${this.periodStart.toISOString()}|${this.periodEnd.toISOString()}`;
    if (!forceEmit && key === this.lastPeriodKey) return;
    this.lastPeriodKey = key;

    const detail: CalendarPeriodChangeDetail = {
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      displayFirstDate: this.displayFirstDate,
      displayLastDate: this.displayLastDate,
    };

    this.onPeriodChange?.(detail);
    this.dispatch('calendar-period-change', detail);
  }

  private ensureHost(): void {
    if (this.host) return;
    const controller = (this as unknown as { $controller?: { host?: HTMLElement } }).$controller;
    if (controller?.host) {
      this.host = controller.host;
    }
  }

  private dispatch(name: string, detail: unknown): void {
    this.ensureHost();
    if (!this.host) return;
    this.host.dispatchEvent(
      new CustomEvent(name, {
        detail,
        bubbles: true,
        cancelable: false,
        composed: true,
      })
    );
  }
}
