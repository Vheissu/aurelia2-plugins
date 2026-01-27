export class MyApp {
  rows = [
    { id: 1, name: 'Ada', role: 'Engineer', team: 'Core' },
    { id: 2, name: 'Grace', role: 'Scientist', team: 'Research' },
    { id: 3, name: 'Linus', role: 'Maintainer', team: 'Platform' },
    { id: 4, name: 'Ken', role: 'Engineer', team: 'Platform' },
    { id: 5, name: 'Margaret', role: 'Engineer', team: 'Guidance' },
    { id: 6, name: 'Edsger', role: 'Architect', team: 'Research' },
    { id: 7, name: 'Barbara', role: 'Lead', team: 'Core' },
    { id: 8, name: 'Donald', role: 'Scientist', team: 'Research' },
    { id: 9, name: 'Frances', role: 'Analyst', team: 'Core' },
    { id: 10, name: 'Tim', role: 'Maintainer', team: 'Platform' },
  ];

  displayRows: Array<{ id: number; name: string; role: string; team: string }> = [];
  currentPage = 1;
  pageSize = 5;
  totalItems = 0;

  filters = [
    { value: '', keys: ['name', 'role', 'team'] }
  ];

  get selectedNames(): string {
    return this.rows
      .filter((row) => row.$isSelected)
      .map((row) => row.name)
      .join(', ');
  }
}
