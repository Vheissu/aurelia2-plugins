export type DatePickerValue = string | Date | null | undefined;

export interface DatePickerDay {
  date: Date;
  iso: string;
  label: string;
  outsideMonth: boolean;
  today: boolean;
  selected: boolean;
  disabled: boolean;
}

export interface DatePickerMonth {
  year: number;
  month: number;
  label: string;
  weekdays: string[];
  days: DatePickerDay[];
}

export interface DatePickerConfigurationOptions {
  locale?: string;
  firstDayOfWeek?: number;
  dateFormat?: Intl.DateTimeFormatOptions;
}

export interface DatePickerSelectDetail {
  date: Date;
  value: string;
}
