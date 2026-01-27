export type DateInput = Date | string | number;

export type DateTimeFormatOption = 'long' | 'short' | 'narrow' | undefined;

export type CalendarPeriodUom = 'week' | 'month' | 'year';

export interface CalendarItem {
  id: string;
  startDate: DateInput;
  title: string;
  tooltip?: string;
  endDate?: DateInput;
  url?: string;
  classes?: string[] | string | null;
  style?: string;
}

export interface NormalizedCalendarItem extends CalendarItem {
  originalItem: CalendarItem;
  startDate: Date;
  endDate: Date;
  classes: string[];
  itemRow?: number;
}

export interface CalendarDateClickDetail {
  date: Date;
  items: NormalizedCalendarItem[];
  event: Event;
}

export interface CalendarItemClickDetail {
  item: NormalizedCalendarItem;
  event: Event;
}

export interface CalendarPeriodChangeDetail {
  periodStart: Date;
  periodEnd: Date;
  displayFirstDate: Date;
  displayLastDate: Date;
}
