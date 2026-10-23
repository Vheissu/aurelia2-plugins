import { bindable, customAttribute, DI, IContainer, INode, Registration, resolve } from 'aurelia';

export interface HistoryOptions<T> {
  limit?: number;
  clone: (value: T) => T;
  equals?: (a: T, b: T) => boolean;
}
interface Entry<T> {
  value: T;
  label: string;
}
/** An isolated, bounded history. Values cross the boundary only through the supplied clone. */
export class History<T> {
  private entries: Entry<T>[];
  private cursor = 0;
  private transaction?: { value: T; label: string };
  private readonly limit: number;
  constructor(
    initial: T,
    private readonly options: HistoryOptions<T>,
  ) {
    this.limit = options.limit ?? 100;
    if (!Number.isInteger(this.limit) || this.limit < 1)
      throw new Error('History limit must be a positive integer');
    this.entries = [{ value: options.clone(initial), label: 'Initial' }];
  }
  get value(): T {
    return this.options.clone(
      this.transaction ? this.transaction.value : this.entries[this.cursor].value,
    );
  }
  get canUndo(): boolean {
    return !this.transaction && this.cursor > 0;
  }
  get canRedo(): boolean {
    return !this.transaction && this.cursor < this.entries.length - 1;
  }
  get undoLabel(): string | undefined {
    return this.canUndo ? this.entries[this.cursor].label : undefined;
  }
  get redoLabel(): string | undefined {
    return this.canRedo ? this.entries[this.cursor + 1].label : undefined;
  }
  get length(): number {
    return this.entries.length;
  }
  record(value: T, label = 'Edit'): void {
    const snapshot = this.options.clone(value);
    if (this.transaction) {
      this.transaction.value = snapshot;
      return;
    }
    this.append(snapshot, label);
  }
  private append(snapshot: T, label: string): void {
    if (this.options.equals?.(this.entries[this.cursor].value, snapshot)) return;
    this.entries = [...this.entries.slice(0, this.cursor + 1), { value: snapshot, label }].slice(
      -this.limit - 1,
    );
    this.cursor = this.entries.length - 1;
  }
  begin(label = 'Edit'): void {
    if (this.transaction) throw new Error('A history transaction is already open');
    this.transaction = { value: this.value, label };
  }
  commit(): void {
    if (!this.transaction) throw new Error('No history transaction is open');
    const { value, label } = this.transaction;
    const snapshot = this.options.clone(value);
    this.append(snapshot, label);
    this.transaction = undefined;
  }
  rollback(): T {
    const value = this.options.clone(this.entries[this.cursor].value);
    this.transaction = undefined;
    return value;
  }
  undo(): T {
    const cursor = this.canUndo ? this.cursor - 1 : this.cursor;
    const value = this.options.clone(
      this.transaction ? this.transaction.value : this.entries[cursor].value,
    );
    this.cursor = cursor;
    return value;
  }
  redo(): T {
    const cursor = this.canRedo ? this.cursor + 1 : this.cursor;
    const value = this.options.clone(
      this.transaction ? this.transaction.value : this.entries[cursor].value,
    );
    this.cursor = cursor;
    return value;
  }
  reset(value: T): void {
    this.entries = [{ value: this.options.clone(value), label: 'Initial' }];
    this.cursor = 0;
    this.transaction = undefined;
  }
}
export interface UndoRedoOptions {
  limit: number;
}
export const IUndoRedoOptions = DI.createInterface<UndoRedoOptions>('IUndoRedoOptions');
export class HistoryFactory {
  private readonly options = resolve(IUndoRedoOptions);
  create<T>(initial: T, options: HistoryOptions<T>): History<T> {
    return new History(initial, { limit: this.options.limit, ...options });
  }
}

/** Opt-in keyboard history for an editor region; native text editing keeps its own history. */
@customAttribute({ name: 'history-keys', defaultProperty: 'history' })
export class HistoryKeys {
  @bindable history?: History<unknown>;
  @bindable apply?: (value: unknown) => void;
  private readonly host = resolve(INode) as HTMLElement;
  private readonly keydown = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      !(event.ctrlKey || event.metaKey) ||
      !this.history ||
      !this.apply
    )
      return;
    if (
      (event.target as Element).closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
      )
    )
      return;
    const key = event.key.toLowerCase();
    const redo = key === 'y' || (key === 'z' && event.shiftKey);
    if (key !== 'z' && key !== 'y') return;
    if (redo ? !this.history.canRedo : !this.history.canUndo) return;
    event.preventDefault();
    this.apply(redo ? this.history.redo() : this.history.undo());
  };
  attached(): void {
    this.host.addEventListener('keydown', this.keydown);
  }
  detaching(): void {
    this.host.removeEventListener('keydown', this.keydown);
  }
}
function configure(options: Partial<UndoRedoOptions> = {}) {
  const value = { limit: 100, ...options };
  if (!Number.isInteger(value.limit) || value.limit < 1)
    throw new Error('History limit must be a positive integer');
  return {
    register(container: IContainer) {
      return container.register(
        Registration.instance(IUndoRedoOptions, value),
        Registration.singleton(HistoryFactory, HistoryFactory),
        HistoryKeys,
      );
    },
  };
}
export const AureliaUndoRedoConfiguration = { ...configure(), configure };
