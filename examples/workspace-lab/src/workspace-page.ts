import { customElement } from 'aurelia';
import {
  compileFilter,
  parseFilter,
  type FilterDocument,
  type FilterField,
} from 'aurelia2-filter-builder';
import { type MentionEntity, type MentionState, type MentionTrigger } from 'aurelia2-mentions';
import { param } from 'aurelia2-url-state';
import template from './workspace-page.html?raw';
@customElement({ name: 'workspace-page', template })
export class WorkspacePage {
  fields: FilterField[] = [
    { key: 'name', label: 'Customer', type: 'text' },
    { key: 'seats', label: 'Seats', type: 'number' },
    {
      key: 'plan',
      label: 'Plan',
      type: 'enum',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Pro', value: 'pro' },
      ],
    },
    { key: 'active', label: 'Active', type: 'boolean' },
  ];
  view = {
    q: '',
    page: 1,
    segment: {
      version: 1,
      root: { kind: 'group', id: 'root', combinator: 'all', children: [] },
    } as FilterDocument,
  };
  segment = this.view.segment;
  params = {
    q: param.string({ debounce: 200 }),
    page: param.int({ min: 1, history: 'push' }),
    segment: param.custom<FilterDocument>({
      parse: (raw) => {
        const result = parseFilter(raw, this.fields);
        return result.issues.length ? undefined : (result.filter ?? undefined);
      },
      serialize: (value) => JSON.stringify(value),
      validate: (value): value is FilterDocument => {
        try {
          return parseFilter(value, this.fields).issues.length === 0;
        } catch {
          return false;
        }
      },
      maxLength: 8000,
    }),
  };
  assignees = [
    { id: 'ana', label: 'Ana Smith' },
    { id: 'ben', label: 'Ben Lee' },
    { id: 'alex', label: 'Alex Chen' },
    { id: 'pat', label: 'Pat Taylor', disabled: true },
  ];
  assigned = ['ana'];
  get assignedSummary(): string {
    return this.assigned.join(', ');
  }

  customers = [
    { name: 'Acme Studio', seats: 12, plan: 'pro', active: true },
    { name: 'Northwind', seats: 3, plan: 'free', active: true },
    { name: 'Cedar Design', seats: 24, plan: 'pro', active: false },
  ];
  visible = this.customers;
  previewError = '';
  urlApplied(): void {
    this.segment = this.view.segment;
    this.preview();
  }
  filterEdited(): void {
    this.preview();
    if (!this.previewError) this.view.segment = this.segment;
  }
  preview(): void {
    try {
      this.visible = this.customers
        .filter(compileFilter(this.segment, this.fields))
        .filter((c) => c.name.toLowerCase().includes(this.view.q.toLowerCase()));
      this.previewError = '';
    } catch {
      this.previewError = 'Complete the filter to refresh the results.';
    }
  }
  comment = '';
  mentions: readonly MentionEntity[] = [];
  mentionState?: MentionState;
  triggers: MentionTrigger[] = [
    {
      char: '@',
      search: async (query, signal) => {
        await new Promise<void>((done, reject) => {
          signal.throwIfAborted();
          const abort = () => {
            clearTimeout(timer);
            reject(signal.reason);
          };
          const timer = setTimeout(() => {
            signal.removeEventListener('abort', abort);
            done();
          }, 60);
          signal.addEventListener('abort', abort, { once: true });
        });
        return [
          { id: 'ana', label: 'Ana Smith', description: 'Design' },
          { id: 'ben', label: 'Ben Lee', description: 'Engineering' },
          { id: 'alex', label: 'Alex Chen', description: 'Support' },
        ].filter((person) => person.label.toLowerCase().includes(query.toLowerCase()));
      },
    },
  ];
  get mentionSummary(): string {
    return JSON.stringify(this.mentions, null, 2);
  }
  base = { title: 'Customer onboarding', priority: 1, owner: 'Ana' };
  mine = { title: 'Add account import', priority: 1, owner: 'Ana' };
  theirs = { title: 'Improve account setup', priority: 2, owner: 'Ana' };
  conflict = false;
  merged = '';
  simulateConflict(): void {
    this.conflict = true;
    this.merged = '';
  }
  apply(value: unknown): void {
    this.merged = JSON.stringify(value, null, 2);
    this.conflict = false;
  }
}
