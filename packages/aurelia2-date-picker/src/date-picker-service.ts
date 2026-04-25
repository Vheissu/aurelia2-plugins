import { DI } from 'aurelia';
import type { DatePickerConfigurationOptions, DatePickerDay, DatePickerMonth, DatePickerValue } from './types';

export class DatePickerService {
  public options: Required<DatePickerConfigurationOptions> = {
    locale: 'en-US',
    firstDayOfWeek: 0,
    dateFormat: { year: 'numeric', month: '2-digit', day: '2-digit' },
  };

  public configure(options: DatePickerConfigurationOptions = {}): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  public parse(value: DatePickerValue): Date | null {
    if (!value) return null;
    if (value instanceof Date) return startOfDay(value);

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
  }

  public formatIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  public formatDisplay(date: Date | null, locale = this.options.locale): string {
    if (!date) return '';
    return new Intl.DateTimeFormat(locale, this.options.dateFormat).format(date);
  }

  public createMonth(options: {
    displayDate: Date;
    selected?: Date | null;
    min?: Date | null;
    max?: Date | null;
    locale?: string;
    firstDayOfWeek?: number;
  }): DatePickerMonth {
    const locale = options.locale ?? this.options.locale;
    const firstDayOfWeek = options.firstDayOfWeek ?? this.options.firstDayOfWeek;
    const display = new Date(options.displayDate.getFullYear(), options.displayDate.getMonth(), 1);
    const start = startOfGrid(display, firstDayOfWeek);
    const days: DatePickerDay[] = [];

    for (let index = 0; index < 42; index += 1) {
      const date = addDays(start, index);
      days.push({
        date,
        iso: this.formatIso(date),
        label: String(date.getDate()),
        outsideMonth: date.getMonth() !== display.getMonth(),
        today: isSameDay(date, new Date()),
        selected: Boolean(options.selected && isSameDay(date, options.selected)),
        disabled: isDisabled(date, options.min, options.max),
      });
    }

    return {
      year: display.getFullYear(),
      month: display.getMonth(),
      label: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(display),
      weekdays: createWeekdays(locale, firstDayOfWeek),
      days,
    };
  }
}

export const IDatePickerService = DI.createInterface<IDatePickerService>('IDatePickerService', x => x.singleton(DatePickerService));
export interface IDatePickerService extends DatePickerService {}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function startOfGrid(date: Date, firstDayOfWeek: number): Date {
  const start = new Date(date);
  const delta = (start.getDay() - firstDayOfWeek + 7) % 7;
  start.setDate(start.getDate() - delta);
  return start;
}

function isDisabled(date: Date, min?: Date | null, max?: Date | null): boolean {
  const day = startOfDay(date).getTime();
  if (min && day < startOfDay(min).getTime()) return true;
  if (max && day > startOfDay(max).getTime()) return true;
  return false;
}

function createWeekdays(locale: string, firstDayOfWeek: number): string[] {
  const base = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_value, index) => {
    const date = addDays(base, firstDayOfWeek + index);
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
  });
}
