import {
  bindable,
  BindingMode,
  computed,
  customElement,
  DI,
  IContainer,
  INode,
  queueTask,
  Registration,
  resolve,
} from 'aurelia';
import {
  copyMergeValue,
  diffLines,
  MergeSession,
  type MergeChoice,
  type MergeConflict,
  type MergeLimits,
  type MergeRecord,
  type MergeSide,
  type MergeValue,
} from './merge.js';
export * from './merge.js';
export const IMergeLimits = DI.createInterface<MergeLimits>('IMergeLimits');
export class MergeService {
  private readonly limits = resolve(IMergeLimits);
  create(base: MergeRecord, mine: MergeRecord, theirs: MergeRecord): MergeSession {
    return new MergeSession(base, mine, theirs, this.limits);
  }
}
interface ConflictRow {
  conflict: MergeConflict;
  label: string;
  id: string;
  custom: string;
  error: string;
  diff: ReturnType<typeof diffLines>;
  textDiff: boolean;
  expanded: boolean;
  largeDiff: boolean;
}
type SideChoice = 'base' | 'mine' | 'theirs' | 'delete';
const defaultLabel = (path: readonly string[]) => path.join(' / ');
const statusText: Record<MergeChoice['choice'], string> = {
  mine: 'Resolved: using your changes',
  theirs: 'Resolved: using the server version',
  base: 'Resolved: using the original',
  delete: 'Resolved: field removed',
  custom: 'Resolved with a custom value',
};
/** JSON-like text that keeps nested undefined distinct from null and missing keys. */
function display(value: MergeValue, indent = ''): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const inner = indent + '  ';
  const items = Array.isArray(value)
    ? value.map((item) => inner + display(item, inner))
    : Object.keys(value).map(
        (key) => `${inner}${JSON.stringify(key)}: ${display(value[key], inner)}`,
      );
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  return items.length ? `${open}\n${items.join(',\n')}\n${indent}${close}` : open + close;
}
let nextId = 0;
@customElement({
  name: 'au-merge',
  template: `<section aria-label.bind="label">
    <p if.bind="error" role="alert">\${error}</p>
    <p if.bind="session" role="status" aria-live="polite">\${session.unresolvedCount} conflicts remaining</p>
    <fieldset repeat.for="row of visibleRows; key: id" data-merge-conflict.bind="row.conflict.id" aria-describedby.bind="row.id + '-status'">
      <legend>\${row.label}</legend>
      <p id.bind="row.id + '-status'" data-merge-status>\${status(row)}</p>
      <div><strong>Original</strong><pre>\${format(row.conflict.base)}</pre></div>
      <div><strong>Your changes</strong><pre>\${format(row.conflict.mine)}</pre></div>
      <div><strong>Server version</strong><pre>\${format(row.conflict.theirs)}</pre></div>
      <details if.bind="row.textDiff" toggle.trigger="toggleDiff(row, $event.target.open)"><summary>Text changes from original to server</summary>
        <template if.bind="row.expanded"><p if.bind="row.largeDiff">Text is too large for a line comparison. Compare the field values above.</p>
        <div repeat.for="line of row.diff"><span>\${line.type}: </span><code>\${line.after ?? line.before}</code></div></template>
      </details>
      <label><input type="radio" name.bind="row.id" value="mine" checked.to-view="choice(row)" change.trigger="choose(row, 'mine', $event.target)"> Use yours</label>
      <label><input type="radio" name.bind="row.id" value="theirs" checked.to-view="choice(row)" change.trigger="choose(row, 'theirs', $event.target)"> Use server</label>
      <label><input type="radio" name.bind="row.id" value="base" checked.to-view="choice(row)" change.trigger="choose(row, 'base', $event.target)"> Use original</label>
      <label><input type="radio" name.bind="row.id" value="delete" checked.to-view="choice(row)" change.trigger="choose(row, 'delete', $event.target)"> Remove field</label>
      <label>Custom JSON for \${row.label}<textarea value.bind="row.custom" aria-invalid.bind="row.error ? 'true' : 'false'"></textarea></label>
      <button type="button" click.trigger="custom(row)">Use custom value for \${row.label}</button>
      <p if.bind="row.error" role="alert">\${row.error}</p>
    </fieldset>
    <nav if.bind="pages > 1" aria-label="Conflict pages"><button type="button" disabled.bind="page === 0" click.trigger="turnPage(-1)">Previous conflicts</button><span>Page \${page + 1} of \${pages}</span><button type="button" disabled.bind="page + 1 >= pages" click.trigger="turnPage(1)">Next conflicts</button></nav>
    <button type="button" aria-disabled.bind="session.isComplete ? 'false' : 'true'" click.trigger="apply()">Apply merge</button>
    <button type="button" click.trigger="cancel()">Cancel merge</button>
    <au-slot></au-slot>
  </section>`,
})
export class AuMerge {
  @bindable base: MergeRecord = {};
  @bindable mine: MergeRecord = {};
  @bindable theirs: MergeRecord = {};
  @bindable label = 'Resolve conflicting changes';
  @bindable pageSize = 20;
  @bindable fieldLabel: (path: readonly string[]) => string = defaultLabel;
  @bindable({ mode: BindingMode.fromView }) session?: MergeSession;
  @bindable({ mode: BindingMode.fromView }) error = '';
  rows: ConflictRow[] = [];
  page = 0;
  get pages(): number {
    return Math.max(1, Math.ceil(this.rows.length / this.size()));
  }
  get visibleRows(): ConflictRow[] {
    return this.rows.slice(this.page * this.size(), (this.page + 1) * this.size());
  }
  private size(): number {
    const size = Number(this.pageSize);
    if (!Number.isInteger(size) || size < 1 || size > 100)
      throw new Error('Merge page size must be between 1 and 100');
    return size;
  }
  pageSizeChanged(): void {
    this.size();
    this.page = Math.min(this.page, this.pages - 1);
  }
  turnPage(direction: number): void {
    if (!Number.isInteger(direction)) return;
    this.page = Math.max(0, Math.min(this.pages - 1, this.page + direction));
    for (const row of this.rows) {
      row.expanded = false;
      row.diff = [];
    }
  }
  private readonly service = resolve(MergeService);
  private readonly host = resolve(INode) as HTMLElement;
  private readonly id = `au-merge-${++nextId}`;
  private active = false;
  private queued = false;
  private applying = false;
  private revision = 0;
  private sources: readonly unknown[] = [];
  binding(): void {
    this.active = true;
    // Inputs are immutable by contract: rebinding to the same references keeps the choices.
    const [base, mine, theirs] = this.sources;
    if (!this.session || base !== this.base || mine !== this.mine || theirs !== this.theirs)
      this.reset();
  }
  baseChanged(): void {
    this.scheduleReset();
  }
  mineChanged(): void {
    this.scheduleReset();
  }
  theirsChanged(): void {
    this.scheduleReset();
  }
  fieldLabelChanged(): void {
    for (const row of this.rows) row.label = this.labelFor(row.conflict.path);
  }
  private labelFor(path: readonly string[]): string {
    try {
      return String(this.fieldLabel(path));
    } catch {
      return defaultLabel(path);
    }
  }
  private scheduleReset(): void {
    if (!this.active || this.queued) return;
    this.queued = true;
    queueTask(() => {
      if (!this.queued) return;
      this.queued = false;
      if (this.active) this.reset();
    });
  }
  private reset(): void {
    const revision = ++this.revision;
    this.page = 0;
    this.sources = [this.base, this.mine, this.theirs];
    try {
      const session = this.service.create(this.base, this.mine, this.theirs);
      this.session = session;
      // Fresh IDs per reset stop the keyed repeat reusing native state such as open details.
      this.rows = session.conflicts.map((conflict, index) => ({
        conflict,
        label: this.labelFor(conflict.path),
        id: `${this.id}-${revision}-${index}`,
        custom: '',
        error: '',
        diff: [],
        expanded: false,
        largeDiff: false,
        textDiff:
          typeof conflict.base.value === 'string' && typeof conflict.theirs.value === 'string',
      }));
      this.error = '';
      this.host.dispatchEvent(
        new CustomEvent('merge-reset', { bubbles: true, detail: { session } }),
      );
    } catch (error) {
      this.session = undefined;
      this.rows = [];
      this.error = error instanceof Error ? error.message : 'Invalid merge input';
    }
  }
  format(side: MergeSide): string {
    if (!side.present) return '(missing)';
    if (side.value === undefined) return '(undefined)';
    return display(side.value);
  }
  @computed() choice(row: ConflictRow): string {
    return this.session?.decision(row.conflict.id)?.choice ?? '';
  }
  @computed() status(row: ConflictRow): string {
    const decision = this.session?.decision(row.conflict.id);
    if (!decision) return 'Unresolved';
    return decision.choice === 'custom'
      ? `${statusText.custom}: ${this.format(decision)}`
      : statusText[decision.choice];
  }
  toggleDiff(row: ConflictRow, open: boolean): void {
    if (!this.active || !this.rows.includes(row) || !row.textDiff) return;
    row.expanded = open;
    row.diff = [];
    row.largeDiff = false;
    if (!open) return;
    const before = row.conflict.base.value as string;
    const after = row.conflict.theirs.value as string;
    if (before.length + after.length > 100000) {
      row.largeDiff = true;
      return;
    }
    const diff = diffLines(before, after, 40000);
    row.largeDiff = diff.length > 400 || diff.some((line) => line.type === 'replace');
    if (!row.largeDiff) row.diff = diff;
  }
  choose(row: ConflictRow, choice: SideChoice, control?: Element | null): boolean {
    const applied = this.select(row, { choice });
    // Checked observers cache their last write, so a rejected click is undone on the DOM directly.
    if (!applied && control) this.syncChoice(row);
    return applied;
  }
  private syncChoice(row: ConflictRow): void {
    const choice = this.session?.decision(row.conflict.id)?.choice ?? '';
    const inputs = this.host.querySelectorAll<HTMLInputElement>('input[type=radio]');
    for (const input of Array.from(inputs))
      if (input.name === row.id) input.checked = input.value === choice;
  }
  private select(row: ConflictRow, decision: MergeChoice): boolean {
    if (!this.active || !this.session || !this.rows.includes(row)) return false;
    this.session.resolve(row.conflict.id, decision);
    row.error = '';
    return true;
  }
  custom(row: ConflictRow): boolean {
    try {
      return this.select(row, { choice: 'custom', value: JSON.parse(row.custom) as MergeValue });
    } catch (error) {
      row.error = error instanceof Error ? error.message : 'Invalid custom value';
      return false;
    }
  }
  apply(): boolean {
    // A listener that applies again would otherwise publish the same resolution twice.
    if (this.applying) return false;
    if (this.queued) {
      this.queued = false;
      this.reset();
    }
    if (!this.active || !this.session) return false;
    const session = this.session;
    if (!session.isComplete) {
      const row = this.rows.find((r) => !session.isResolved(r.conflict.id));
      if (row) {
        this.page = Math.floor(this.rows.indexOf(row) / this.size());
        const focus = () => {
          if (this.active && this.session === session)
            this.host.querySelector<HTMLInputElement>(`input[name="${row.id}"]`)?.focus();
        };
        focus();
        queueTask(focus);
      }
      return false;
    }
    this.applying = true;
    try {
      const revision = this.revision;
      const sessionRevision = session.revision;
      const result = session.result();
      const event = new CustomEvent('merge-before-apply', {
        bubbles: true,
        cancelable: true,
        detail: { merged: session.result() },
      });
      if (
        !this.host.dispatchEvent(event) ||
        !this.active ||
        this.queued ||
        revision !== this.revision ||
        sessionRevision !== session.revision ||
        session !== this.session
      )
        return false;
      this.host.dispatchEvent(
        new CustomEvent('merge-resolve', { bubbles: true, detail: { merged: result } }),
      );
      return true;
    } finally {
      this.applying = false;
    }
  }
  cancel(): void {
    this.host.dispatchEvent(new CustomEvent('merge-cancel', { bubbles: true }));
  }
  unbinding(): void {
    this.active = false;
    this.queued = false;
    this.revision++;
  }
}
function configure(options: Partial<MergeLimits> = {}) {
  const limits = Object.freeze({ maxDepth: 64, maxNodes: 10000, ...options });
  copyMergeValue({}, limits);
  return {
    register(container: IContainer) {
      return container.register(
        Registration.instance(IMergeLimits, limits),
        Registration.singleton(MergeService, MergeService),
        AuMerge,
      );
    },
  };
}
export const AureliaMergeConfiguration = { ...configure(), configure };
