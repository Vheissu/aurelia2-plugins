import {
  CalendarDateClickDetail,
  CalendarItem,
  CalendarItemClickDetail,
} from 'aurelia2-calendar';

type ClickSummary = {
  label: string;
  itemTitles: string[];
};

const d = (year: number, monthIndex: number, day: number, hour = 0, minute = 0): Date =>
  new Date(year, monthIndex, day, hour, minute, 0, 0);

export class MyApp {
  public showDate = d(2024, 0, 15);

  public items: CalendarItem[] = [
    { id: 'kickoff', title: 'Kickoff', startDate: d(2024, 0, 2, 9), endDate: d(2024, 0, 2, 10) },
    { id: 'design', title: 'Design Sprint', startDate: d(2024, 0, 8), endDate: d(2024, 0, 12) },
    { id: 'review', title: 'Quarterly Review', startDate: d(2024, 0, 18), endDate: d(2024, 0, 19) },
    { id: 'offsite', title: 'Team Offsite', startDate: d(2024, 0, 24), endDate: d(2024, 0, 27) },
    { id: 'release', title: 'Release', startDate: d(2024, 0, 30, 14), endDate: d(2024, 0, 30, 15) },
  ];

  public dateClasses: Record<string, string | string[]> = {
    '2024-01-01': ['is-holiday'],
    '2024-01-15': ['is-highlight'],
  };

  public lastDateClick: ClickSummary | null = null;
  public lastItemClick: ClickSummary | null = null;

  public onDateClick(detail: CalendarDateClickDetail): void {
    this.lastDateClick = {
      label: detail.date.toDateString(),
      itemTitles: detail.items.map((item) => item.title),
    };
  }

  public onItemClick(detail: CalendarItemClickDetail): void {
    this.lastItemClick = {
      label: detail.item.title,
      itemTitles: [detail.item.startDate.toDateString(), detail.item.endDate.toDateString()],
    };
  }
}
