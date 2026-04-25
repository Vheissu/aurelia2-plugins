import { bindable, BindingMode, customElement, INode, resolve } from 'aurelia';
import { DatePickerService, IDatePickerService } from './date-picker-service';
import type { DatePickerDay, DatePickerMonth, DatePickerValue } from './types';
import template from './au-date-picker.html';

const identity = <T>(value: T): T => value;

@customElement({
  name: 'au-date-picker',
  template,
})
export class AuDatePickerCustomElement {
  @bindable({ mode: BindingMode.twoWay }) public value: string | null = null;
  @bindable({ mode: BindingMode.twoWay, set: identity }) public selectedDate: Date | null = null;
  @bindable({ set: identity }) public min: DatePickerValue = null;
  @bindable({ set: identity }) public max: DatePickerValue = null;
  @bindable public locale: string | null = null;
  @bindable public firstDayOfWeek: number | null = null;
  @bindable public placeholder = 'Select date';
  @bindable public disabled = false;

  public open = false;
  public displayValue = '';
  public displayDate = new Date();
  public month: DatePickerMonth = {
    year: 0,
    month: 0,
    label: '',
    weekdays: [],
    days: [],
  };

  private readonly host = resolve(INode) as HTMLElement;
  private readonly dates = resolve(IDatePickerService) as DatePickerService;
  private syncing = false;

  public binding(): void {
    this.syncFromValue();
  }

  public valueChanged(): void {
    if (!this.syncing) this.syncFromValue();
  }

  public selectedDateChanged(): void {
    if (!this.syncing && this.selectedDate) {
      this.value = this.dates.formatIso(this.selectedDate);
      this.syncFromValue();
    }
  }

  public minChanged(): void {
    this.recompute();
  }

  public maxChanged(): void {
    this.recompute();
  }

  public localeChanged(): void {
    this.recompute();
  }

  public firstDayOfWeekChanged(): void {
    this.recompute();
  }

  public openPicker(): void {
    if (this.disabled) return;
    this.open = true;
  }

  public closePicker(): void {
    this.open = false;
  }

  public onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closePicker();
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.openPicker();
    }
  }

  public previousMonth(): void {
    this.displayDate = new Date(this.displayDate.getFullYear(), this.displayDate.getMonth() - 1, 1);
    this.recompute();
  }

  public nextMonth(): void {
    this.displayDate = new Date(this.displayDate.getFullYear(), this.displayDate.getMonth() + 1, 1);
    this.recompute();
  }

  public select(day: DatePickerDay): void {
    if (day.disabled) return;

    this.syncing = true;
    this.selectedDate = day.date;
    this.value = day.iso;
    this.displayValue = this.dates.formatDisplay(day.date, this.locale ?? this.dates.options.locale);
    this.syncing = false;
    this.closePicker();
    this.recompute();

    this.host.dispatchEvent(new CustomEvent('date-picker-select', {
      bubbles: true,
      detail: {
        date: day.date,
        value: day.iso,
      },
    }));
  }

  public dayClass(day: DatePickerDay): string {
    return [
      'au-dp-day',
      day.outsideMonth ? 'outside' : '',
      day.today ? 'today' : '',
      day.selected ? 'selected' : '',
    ].filter(Boolean).join(' ');
  }

  private syncFromValue(): void {
    const date = this.dates.parse(this.value ?? this.selectedDate);
    this.syncing = true;
    this.selectedDate = date;
    this.value = date ? this.dates.formatIso(date) : this.value;
    this.displayDate = date ?? new Date();
    this.displayValue = this.dates.formatDisplay(date, this.locale ?? this.dates.options.locale);
    this.syncing = false;
    this.recompute();
  }

  private recompute(): void {
    this.month = this.dates.createMonth({
      displayDate: this.displayDate,
      selected: this.selectedDate,
      min: this.dates.parse(this.min),
      max: this.dates.parse(this.max),
      locale: this.locale ?? this.dates.options.locale,
      firstDayOfWeek: this.firstDayOfWeek ?? this.dates.options.firstDayOfWeek,
    });
  }
}
