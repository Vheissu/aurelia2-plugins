import { CalendarItem, DateInput, DateTimeFormatOption, NormalizedCalendarItem } from './types';

const supportsIntl = (): boolean => typeof Intl !== 'undefined';

const toLocalDate = (value: DateInput): Date => {
  if (value instanceof Date) {
    return new Date(value);
  }
  if (typeof value === 'string') {
    return fromIsoStringToLocalDate(value);
  }
  return new Date(value);
};

const dateOnly = (value: DateInput): Date => {
  const d = toLocalDate(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const today = (): Date => dateOnly(new Date());

const addDays = (d: Date, days: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());

const beginningOfWeek = (d: Date, startDow: number): Date => addDays(d, (startDow - d.getDay() - 7) % -7);

const endOfWeek = (d: Date, startDow: number): Date => addDays(beginningOfWeek(d, startDow), 7);

const beginningOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1);

const beginningOfPeriod = (d: Date, periodUom: string, startDow: number): Date => {
  switch (periodUom) {
    case 'year':
      return new Date(d.getFullYear(), 0, 1);
    case 'month':
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case 'week':
      return beginningOfWeek(d, startDow);
    default:
      return new Date(d);
  }
};

const incrementPeriod = (d: Date, uom: string, count: number): Date =>
  new Date(
    d.getFullYear() + (uom === 'year' ? count : 0),
    d.getMonth() + (uom === 'month' ? count : 0),
    d.getDate() + (uom === 'week' ? count * 7 : 0),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds()
  );

const dayDiff = (d1: Date, d2: Date): number => {
  const endDate = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  const startDate = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  return (endDate - startDate) / 86400000;
};

const isSameDate = (d1?: DateInput, d2?: DateInput): boolean =>
  d1 != null && d2 != null && dayDiff(dateOnly(d1), dateOnly(d2)) === 0;

const isSameDateTime = (d1?: DateInput, d2?: DateInput): boolean => {
  if (d1 == null || d2 == null) return false;
  return toLocalDate(d1).getTime() === toLocalDate(d2).getTime();
};

const isSameMonth = (d1?: DateInput, d2?: DateInput): boolean => {
  if (d1 == null || d2 == null) return false;
  const a = toLocalDate(d1);
  const b = toLocalDate(d2);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
};

const isPastMonth = (d: Date): boolean => beginningOfMonth(d) < beginningOfMonth(today());

const isFutureMonth = (d: Date): boolean => beginningOfMonth(d) > beginningOfMonth(today());

const isInFuture = (d: Date): boolean => dateOnly(d) > today();

const isInPast = (d: Date): boolean => dateOnly(d) < today();

const isLastInstanceOfMonth = (d: Date): boolean => d.getMonth() !== addDays(d, 7).getMonth();

const isLastDayOfMonth = (d: Date): boolean => d.getMonth() !== addDays(d, 1).getMonth();

const paddedMonth = (d: Date): string => (`0${String(d.getMonth() + 1)}`).slice(-2);

const paddedDay = (d: Date): string => (`0${String(d.getDate())}`).slice(-2);

const isoYearMonth = (d: Date): string => `${d.getFullYear()}-${paddedMonth(d)}`;

const isoYearMonthDay = (d: Date): string => `${isoYearMonth(d)}-${paddedDay(d)}`;

const isoMonthDay = (d: Date): string => `${paddedMonth(d)}-${paddedDay(d)}`;

const instanceOfMonth = (d: Date): number => Math.ceil(d.getDate() / 7);

const languageCode = (locale: string): string => locale.substring(0, 2);

const getFormattedMonthNames = (locale: string, format: DateTimeFormatOption): string[] => {
  if (!supportsIntl()) return Array.from({ length: 12 }, () => '');
  const formatter = new Intl.DateTimeFormat(locale, { month: format });
  return Array.from({ length: 12 }, (_, i) => formatter.format(new Date(2017, i, 1)));
};

const getFormattedWeekdayNames = (locale: string, format: DateTimeFormatOption, startingDayOfWeek: number): string[] => {
  if (!supportsIntl()) return Array.from({ length: 7 }, () => '');
  const formatter = new Intl.DateTimeFormat(locale, { weekday: format });
  return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2017, 0, (i + 1 + startingDayOfWeek) % 7)));
};

const getDefaultBrowserLocale = (): string => {
  if (typeof navigator === 'undefined') return 'unk';
  return (navigator.languages && navigator.languages.length ? navigator.languages[0] : navigator.language).toLowerCase();
};

const formattedTime = (d: Date, locale: string, options?: Intl.DateTimeFormatOptions): string => {
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) return '';
  if (!supportsIntl()) {
    const ms = new Date().getTimezoneOffset() * 60000;
    return new Date(d.getTime() - ms).toISOString().slice(11, 16);
  }
  return d.toLocaleTimeString(locale, options);
};

const formattedPeriod = (startDate: Date, endDate: Date, periodUom: string, monthNames: string[]): string => {
  const singleYear = startDate.getFullYear() === endDate.getFullYear();
  const singleMonth = isSameMonth(startDate, endDate);
  const isYear = periodUom === 'year';
  const isMonth = periodUom === 'month';
  const isWeek = !isYear && !isMonth;

  const parts: string[] = [];
  parts.push(monthNames[startDate.getMonth()]);
  if (isWeek) {
    parts.push(' ');
    parts.push(String(startDate.getDate()));
  }
  if (!singleYear) {
    parts.push(isWeek ? ', ' : ' ');
    parts.push(String(startDate.getFullYear()));
  }
  if (!singleMonth || !singleYear) {
    parts.push(' - ');
    if (!singleMonth) {
      parts.push(monthNames[endDate.getMonth()]);
    }
    if (isWeek) parts.push(' ');
  } else if (isWeek) {
    parts.push(' - ');
  }
  if (isWeek) {
    parts.push(String(endDate.getDate()));
    parts.push(', ');
  } else {
    parts.push(' ');
  }
  parts.push(String(endDate.getFullYear()));
  return parts.join('');
};

const fromIsoStringToLocalDate = (s: string): Date => {
  const parts = Array.from({ length: 7 }, () => 0);
  s.split(/\D/, 7).forEach((value, i) => {
    parts[i] = Number(value);
  });
  parts[1] -= 1;
  return new Date(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5], parts[6]);
};

const daysOfWeek = (weekStart: Date): Date[] => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

const normalizeClasses = (classes: CalendarItem['classes']): string[] => {
  if (classes == null) return [];
  if (Array.isArray(classes)) return classes.filter((value) => !!value);
  return String(classes)
    .split(/\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

const normalizeItem = (item: CalendarItem): NormalizedCalendarItem => {
  const startDate = toLocalDate(item.startDate);
  const endDate = toLocalDate(item.endDate ?? item.startDate);
  const classes = normalizeClasses(item.classes);
  return {
    ...item,
    originalItem: item,
    startDate,
    endDate,
    title: item.title || 'Untitled',
    tooltip: item.tooltip ?? item.title,
    classes,
  };
};

export const CalendarMath = {
  addDays,
  beginningOfMonth,
  beginningOfPeriod,
  beginningOfWeek,
  dateOnly,
  dayDiff,
  daysOfWeek,
  endOfWeek,
  formattedPeriod,
  formattedTime,
  fromIsoStringToLocalDate,
  getDefaultBrowserLocale,
  getFormattedMonthNames,
  getFormattedWeekdayNames,
  incrementPeriod,
  instanceOfMonth,
  isFutureMonth,
  isInFuture,
  isInPast,
  isLastDayOfMonth,
  isLastInstanceOfMonth,
  isoMonthDay,
  isoYearMonth,
  isoYearMonthDay,
  isPastMonth,
  isSameDate,
  isSameDateTime,
  isSameMonth,
  languageCode,
  normalizeItem,
  paddedDay,
  paddedMonth,
  supportsIntl,
  today,
  toLocalDate,
};

export type CalendarMathType = typeof CalendarMath;
