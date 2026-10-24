import {
  bindable,
  BindingMode,
  computed,
  customElement,
  DI,
  IContainer,
  INode,
  queueTask,
  resolve,
} from 'aurelia';
import {
  copyFilter,
  defaultLimits,
  describeFilter,
  filterFields,
  filterLimits,
  operatorsFor,
  structuralLimits,
  validateFilter,
  type FilterCondition,
  type FilterDocument,
  type FilterField,
  type FilterGroup,
  type FilterIssue,
  type FilterLimits,
  type FilterNode,
  type FilterOperator,
} from './filter.js';
export * from './filter.js';
export interface FilterEditor {
  readonly template: string;
}
export const IFilterEditors = DI.createInterface<FilterEditors>('IFilterEditors', (x) =>
  x.singleton(FilterEditors),
);
export class FilterEditors {
  private readonly entries = new Map<string, FilterEditor>();
  register(field: string, editor: FilterEditor): () => void {
    if (!field || !editor.template || this.entries.has(field))
      throw new Error('Invalid or duplicate custom field editor');
    const copy = Object.freeze({ ...editor });
    this.entries.set(field, copy);
    return () => {
      if (this.entries.get(field) === copy) this.entries.delete(field);
    };
  }
  get(field: string): FilterEditor | undefined {
    return this.entries.get(field);
  }
}
interface EditorContext {
  field: FilterField | undefined;
  condition: FilterCondition;
  setValue: (value: unknown, control?: Element | null) => boolean;
}
/** Binding context of a custom value editor, stable per condition ID while the view is bound. */
export type FilterEditorContext = Readonly<EditorContext>;
type ControlPart = 'combinator' | 'field' | 'operator' | 'value' | 'boolean' | number;
interface EditOptions {
  message?: string;
  focus?: string;
  restore?: () => void;
}
let nextId = 0;
const id = () => `filter-node-${++nextId}`;
const boolean = (value: unknown) => value === true || value === '' || value === 'true';
const limitCodes = new Set(['depth-limit', 'condition-limit']);
const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Invalid filter');
/** To-view observers cache their last write, so rejected edits restore the control directly. */
function writeControl(control: Element | null | undefined, value: unknown): void {
  const text = value === undefined || value === null ? '' : String(value);
  if (control?.localName === 'select') {
    const select = control as HTMLSelectElement;
    if (!select.multiple) select.value = text;
    else {
      const values = Array.isArray(value) ? value.map(String) : [];
      for (const option of Array.from(select.options))
        option.selected = values.includes(option.value);
    }
  } else if (control?.localName === 'input') {
    const input = control as HTMLInputElement;
    if (input.type === 'checkbox' && typeof value === 'boolean') input.checked = value;
    else if (input.type === 'checkbox' || input.type === 'radio')
      input.checked = input.value === text;
    else input.value = text;
  } else if (control?.localName === 'textarea') (control as HTMLTextAreaElement).value = text;
}

@customElement({
  name: 'au-filter-group',
  template: `<fieldset data-filter-node.bind="node.id" disabled.bind="controller.disabled">
    <legend>Match \${node.combinator} of the following</legend>
    <label>Group match<select aria-label="Group match" value.to-view="node.combinator" change.trigger="controller.combinator(node.id, $event.target.value, $event.target)"><option value="all">All</option><option value="any">Any</option><option value="none">None</option></select></label>
    <button if.bind="depth > 0" type="button" click.trigger="controller.remove(node.id)">Remove group</button>
    <template repeat.for="child of node.children; key: id">
      <au-filter-group if.bind="child.kind === 'group'" node.bind="child" controller.bind="controller" depth.bind="depth + 1"></au-filter-group>
      <div else data-filter-node.bind="child.id">
        <label>Field<select aria-label="Condition field" value.to-view="child.field" change.trigger="controller.changeField(child.id, $event.target.value, $event.target)">
          <option if.bind="!controller.field(child.field)" value.bind="child.field">Unknown field: \${child.field}</option>
          <option repeat.for="field of controller.definitions" value.bind="field.key" selected.bind="child.field === field.key">\${field.label}</option>
        </select></label>
        <label>Operator<select aria-label="Condition operator" value.to-view="child.operator" change.trigger="controller.operator(child.id, $event.target.value, $event.target)">
          <option repeat.for="op of controller.operators(child.field)" value.bind="op" selected.bind="child.operator === op">\${op}</option>
        </select></label>
        <template if.bind="child.operator !== 'is-empty' && child.operator !== 'is-not-empty'">
          <au-compose if.bind="controller.customEditor(child.field)" template.bind="controller.customEditor(child.field).template" component.bind="controller.context(child)" scope-behavior="scoped"></au-compose>
          <template else>
            <template if.bind="child.operator === 'between'">
              <label>From<input aria-label="Lower bound" type.bind="controller.inputType(child.field)" value.to-view="controller.part(child, 0)" input.trigger="controller.input(child, $event.target.value, 0, $event.target)"></label>
              <label>To<input aria-label="Upper bound" type.bind="controller.inputType(child.field)" value.to-view="controller.part(child, 1)" input.trigger="controller.input(child, $event.target.value, 1, $event.target)"></label>
            </template>
            <template else><template switch.bind="controller.field(child.field)?.type"><label case="boolean">Value<select aria-label="Condition value" value.to-view="child.value === true ? 'true' : child.value === false ? 'false' : ''" change.trigger="controller.input(child, $event.target.value, null, $event.target)"><option value="">Choose</option><option value="true">True</option><option value="false">False</option></select></label>
            <label case="enum">Value<select aria-label="Condition value" multiple.bind="child.operator === 'any-of' || child.operator === 'none-of'" value.to-view="child.value" change.trigger="controller.enumInput(child, $event.target)"><option repeat.for="option of controller.field(child.field).options" value.bind="option.value" selected.bind="controller.enumSelected(child, option.value)">\${option.label}</option></select></label>
            <label default-case>Value<input aria-label="Condition value" type.bind="controller.inputType(child.field)" value.to-view="child.value ?? ''" input.trigger="controller.input(child, $event.target.value, null, $event.target)"></label></template></template>
          </template>
        </template>
        <button type="button" aria-label.bind="'Remove condition ' + child.field" click.trigger="controller.remove(child.id)">Remove condition</button>
        <span if.bind="controller.issue(child.id)" role="alert">\${controller.issue(child.id)}</span>
      </div>
    </template>
    <button type="button" data-filter-add.bind="node.id" disabled.bind="!controller.canAdd(depth, false)" click.trigger="controller.add(node.id, false)">Add condition</button>
    <button type="button" disabled.bind="!controller.canAdd(depth, true)" click.trigger="controller.add(node.id, true)">Add group</button>
    <span if.bind="controller.issue(node.id)" role="alert">\${controller.issue(node.id)}</span>
  </fieldset>`,
})
export class AuFilterGroup {
  @bindable node!: FilterGroup;
  @bindable controller!: AuFilterBuilder;
  @bindable depth = 0;
}
@customElement({
  name: 'au-filter-builder',
  template: `<section aria-label.bind="label">
    <au-filter-group if.bind="document" node.bind="document.root" controller.bind="controller" depth.bind="0"></au-filter-group>
    <p if.bind="error" role="alert">\${error}</p>
    <p role="status" aria-live="polite">\${announcement}</p>
    <p>\${summary}</p><au-slot></au-slot>
  </section>`,
})
export class AuFilterBuilder {
  @bindable fields: readonly FilterField[] | null | undefined = [];
  @bindable({ mode: BindingMode.twoWay }) filter: FilterDocument = {
    version: 1,
    root: { kind: 'group', id: id(), combinator: 'all', children: [] },
  };
  @bindable({ set: boolean }) disabled = false;
  @bindable label = 'Filter records';
  @bindable maxDepth = defaultLimits.maxDepth;
  @bindable maxConditions = defaultLimits.maxConditions;
  @bindable({ mode: BindingMode.fromView }) valid = true;
  @bindable({ mode: BindingMode.fromView }) issues: FilterIssue[] = [];
  readonly controller = this;
  definitions: readonly FilterField[] = [];
  document: FilterDocument | null = null;
  error = '';
  summary = '';
  announcement = '';
  private readonly registry = resolve(IFilterEditors);
  private readonly host = resolve(INode) as HTMLElement;
  private active = false;
  private readonly contexts = new Map<string, EditorContext>();
  binding(): void {
    this.active = true;
    this.rebuild();
  }
  filterChanged(): void {
    if (this.active) this.rebuild();
  }
  fieldsChanged(): void {
    if (this.active) this.rebuild();
  }
  maxDepthChanged(): void {
    if (this.active) this.rebuild();
  }
  maxConditionsChanged(): void {
    if (this.active) this.rebuild();
  }
  private limits(): FilterLimits {
    return filterLimits({
      maxDepth: Number(this.maxDepth),
      maxConditions: Number(this.maxConditions),
    });
  }
  private limitsKey(): string {
    try {
      return JSON.stringify(this.limits());
    } catch {
      return '';
    }
  }
  /** Fields that have not loaded yet keep the document visible but invalid. */
  private validate(document: FilterDocument): FilterIssue[] {
    const issues = validateFilter(document, this.definitions, this.limits());
    return this.fields === null || this.fields === undefined
      ? [{ code: 'fields-unavailable', message: 'Filter fields are not available yet' }, ...issues]
      : issues;
  }
  private rebuild(): void {
    this.definitions = [];
    try {
      this.definitions =
        this.fields === null || this.fields === undefined ? [] : filterFields(this.fields);
      const document = copyFilter(this.filter, structuralLimits());
      const issues = this.validate(document);
      this.syncContexts(document);
      this.document = document;
      this.error = '';
      this.issues = issues;
      this.valid = issues.length === 0;
      this.summary = this.valid
        ? describeFilter(document, this.definitions, this.limits())
        : issues.map((issue) => issue.message).join('; ');
    } catch (error) {
      this.syncContexts(null);
      this.document = null;
      this.error = errorText(error);
      this.valid = false;
      this.issues = [{ code: 'invalid-document', message: this.error }];
      this.summary = '';
    }
  }
  @computed() field(key: string): FilterField | undefined {
    return this.definitions.find((field) => field.key === key);
  }
  @computed() operators(key: string): readonly FilterOperator[] {
    const field = this.field(key);
    return field ? operatorsFor(field) : [];
  }
  @computed() issue(key: string): string {
    return this.issues
      .filter((issue) => issue.id === key)
      .map((issue) => issue.message)
      .join('; ');
  }
  inputType(key: string): string {
    const type = this.field(key)?.type;
    return type === 'number' ? 'number' : type === 'date' ? 'date' : 'text';
  }
  part(condition: FilterCondition, index: number): unknown {
    return Array.isArray(condition.value) ? (condition.value[index] ?? '') : '';
  }
  customEditor(key: string): FilterEditor | undefined {
    return this.registry.get(key);
  }
  context(condition: FilterCondition): FilterEditorContext {
    const key = condition.id;
    let context = this.contexts.get(key);
    if (!context) {
      context = {
        field: this.field(condition.field),
        condition,
        setValue: (value, control) => this.value(key, value, control),
      };
      this.contexts.set(key, context);
    }
    return context;
  }
  /** Keeps composed editors mounted across edits; contexts of removed conditions are dropped. */
  private syncContexts(document: FilterDocument | null): void {
    const conditions = new Map<string, FilterCondition>();
    if (document)
      for (const node of this.nodes(document))
        if (node.kind === 'condition') conditions.set(node.id, node);
    for (const [key, context] of this.contexts) {
      const condition = conditions.get(key);
      if (!condition) this.contexts.delete(key);
      else {
        context.condition = condition;
        context.field = this.definitions.find((field) => field.key === condition.field);
      }
    }
  }
  private nodes(doc: FilterDocument): FilterNode[] {
    const list: FilterNode[] = [];
    const stack: FilterNode[] = [doc.root];
    while (stack.length) {
      const node = stack.pop()!;
      list.push(node);
      if (node.kind === 'group') stack.push(...node.children);
    }
    return list;
  }
  @computed() canAdd(depth: number, group: boolean): boolean {
    if (this.disabled || !this.document || !this.definitions.length) return false;
    if (this.issues.some((issue) => limitCodes.has(issue.code))) return false;
    const nodes = this.nodes(this.document),
      limits = this.limits(),
      size = group ? 2 : 1;
    // A new group needs room for the condition that makes it valid.
    return (
      depth + size <= limits.maxDepth &&
      nodes.length + size <= structuralLimits().maxNodes &&
      nodes.filter((n) => n.kind === 'condition').length < limits.maxConditions
    );
  }
  private edit(change: (doc: FilterDocument) => void, options: EditOptions = {}): boolean {
    const reject = (message?: string): false => {
      if (message) this.announcement = message;
      options.restore?.();
      return false;
    };
    if (this.disabled || !this.active || !this.document) return reject();
    const source = this.filter,
      fields = this.fields,
      before = JSON.stringify(source),
      beforeFields = JSON.stringify(fields),
      limitsBefore = this.limitsKey();
    const focused = this.host.ownerDocument.activeElement;
    let document: FilterDocument, issues: FilterIssue[];
    try {
      const next = copyFilter(source, structuralLimits());
      change(next);
      // Structural validation is independent of incomplete user-entered values.
      document = copyFilter(next, structuralLimits());
      issues = this.validate(document);
    } catch (error) {
      return reject(`Change not applied: ${errorText(error)}`);
    }
    const event = new CustomEvent('filter-before-change', {
      bubbles: true,
      cancelable: true,
      detail: {
        filter: copyFilter(document, structuralLimits()),
        valid: issues.length === 0,
        issues: issues.map((issue) => ({ ...issue })),
      },
    });
    if (!this.host.dispatchEvent(event)) return reject('Change cancelled');
    if (
      !this.active ||
      this.disabled ||
      this.filter !== source ||
      this.fields !== fields ||
      this.limitsKey() !== limitsBefore ||
      JSON.stringify(source) !== before ||
      JSON.stringify(fields) !== beforeFields
    )
      return reject('Change not applied because the filter changed');
    this.filter = document;
    this.rebuild();
    this.announcement = options.message ?? 'Filter updated';
    this.host.dispatchEvent(
      new CustomEvent('filter-change', {
        bubbles: true,
        detail: {
          filter: copyFilter(document, structuralLimits()),
          valid: issues.length === 0,
          issues: issues.map((issue) => ({ ...issue })),
        },
      }),
    );
    const focusId = options.focus;
    if (focusId)
      queueTask(() => {
        if (!this.active) return;
        const current = this.host.ownerDocument.activeElement;
        if (current !== focused && current !== this.host.ownerDocument.body) return;
        const target = Array.from(
          this.host.querySelectorAll<HTMLElement>('[data-filter-node]'),
        ).find((el) => el.dataset.filterNode === focusId);
        target?.querySelector<HTMLElement>('select,input,button')?.focus();
      });
    return true;
  }
  /** Writes the committed value back to a control whose proposed edit was not applied. */
  private restore(control: Element | null | undefined, key: string, part: ControlPart): void {
    const node = control && this.document && this.nodes(this.document).find((n) => n.id === key);
    if (!node) return;
    if (node.kind === 'group') {
      if (part === 'combinator') writeControl(control, node.combinator);
      return;
    }
    writeControl(
      control,
      part === 'field'
        ? node.field
        : part === 'operator'
          ? node.operator
          : part === 'boolean'
            ? node.value === true
              ? 'true'
              : node.value === false
                ? 'false'
                : ''
            : typeof part === 'number'
              ? this.part(node, part)
              : node.value,
    );
  }
  private condition(doc: FilterDocument, key: string): FilterCondition {
    const node = this.nodes(doc).find((node) => node.id === key);
    if (!node || node.kind !== 'condition') throw new Error('Unknown filter condition');
    return node;
  }
  private defaultValue(field: FilterField, op: FilterOperator): unknown {
    if (op === 'is-empty' || op === 'is-not-empty') return undefined;
    if (op === 'between') return ['', ''];
    if (op === 'any-of' || op === 'none-of') return [];
    if (field.type === 'boolean') return true;
    if (field.type === 'enum') return field.options?.[0]?.value;
    return '';
  }
  add(parentId: string, group: boolean): boolean {
    const parent = this.document && this.nodes(this.document).find((node) => node.id === parentId);
    if (!parent || parent.kind !== 'group' || !this.definitions.length) return false;
    const stack = [{ node: this.document!.root, depth: 0 }];
    let depth = 0;
    while (stack.length) {
      const current = stack.pop()!;
      if (current.node.id === parentId) {
        depth = current.depth;
        break;
      }
      for (const child of current.node.children)
        if (child.kind === 'group') stack.push({ node: child, depth: current.depth + 1 });
    }
    if (!this.canAdd(depth, group)) return false;
    const existing = new Set(this.nodes(this.document!).map((node) => node.id));
    let newId = id();
    while (existing.has(newId)) newId = id();
    const field = this.definitions[0];
    return this.edit(
      (doc) => {
        const target = this.nodes(doc).find((node) => node.id === parentId) as FilterGroup;
        target.children.push(
          group
            ? { kind: 'group', id: newId, combinator: 'all', children: [] }
            : {
                kind: 'condition',
                id: newId,
                field: field.key,
                operator: operatorsFor(field)[0],
                value: this.defaultValue(field, operatorsFor(field)[0]),
              },
        );
      },
      { message: group ? 'Group added' : 'Condition added', focus: newId },
    );
  }
  remove(key: string): boolean {
    if (!this.document || this.document.root.id === key) return false;
    const parent = this.nodes(this.document).find(
      (node) => node.kind === 'group' && node.children.some((child) => child.id === key),
    ) as FilterGroup | undefined;
    if (!parent) return false;
    const index = parent.children.findIndex((child) => child.id === key);
    const focus = parent.children[index + 1]?.id ?? parent.children[index - 1]?.id ?? parent.id;
    return this.edit(
      (doc) => {
        const p = this.nodes(doc).find((node) => node.id === parent.id) as FilterGroup;
        p.children = p.children.filter((child) => child.id !== key);
      },
      { message: 'Condition or group removed', focus },
    );
  }
  combinator(key: string, value: FilterGroup['combinator'], control?: Element | null): boolean {
    return this.edit(
      (doc) => {
        const node = this.nodes(doc).find((node) => node.id === key);
        if (node?.kind !== 'group') throw new Error('Unknown filter group');
        node.combinator = value;
      },
      { restore: () => this.restore(control, key, 'combinator') },
    );
  }
  changeField(key: string, value: string, control?: Element | null): boolean {
    const field = this.field(value);
    const restore = () => this.restore(control, key, 'field');
    if (!field) {
      restore();
      return false;
    }
    return this.edit(
      (doc) => {
        const node = this.condition(doc, key);
        node.field = value;
        node.operator = operatorsFor(field)[0];
        node.value = this.defaultValue(field, node.operator);
      },
      { restore },
    );
  }
  operator(key: string, value: FilterOperator, control?: Element | null): boolean {
    return this.edit(
      (doc) => {
        const node = this.condition(doc, key),
          field = this.field(node.field);
        if (!field || !operatorsFor(field).includes(value)) throw new Error('Invalid operator');
        node.operator = value;
        node.value = this.defaultValue(field, value);
      },
      { restore: () => this.restore(control, key, 'operator') },
    );
  }
  value(key: string, value: unknown, control?: Element | null): boolean {
    return this.edit(
      (doc) => {
        this.condition(doc, key).value = value;
      },
      { restore: () => this.restore(control, key, 'value') },
    );
  }
  input(
    condition: FilterCondition,
    raw: string,
    index?: number | null,
    control?: Element | null,
  ): boolean {
    const key = condition.id;
    const type = this.field(condition.field)?.type;
    const value =
      type === 'number'
        ? raw === ''
          ? undefined
          : Number(raw)
        : type === 'boolean'
          ? raw === ''
            ? undefined
            : raw === 'true'
          : raw;
    const part: ControlPart =
      index !== null && index !== undefined ? index : type === 'boolean' ? 'boolean' : 'value';
    return this.edit(
      (doc) => {
        const node = this.condition(doc, key);
        if (typeof part !== 'number') node.value = value;
        else {
          const values = Array.isArray(node.value) ? [...node.value] : ['', ''];
          values[part] = value;
          node.value = values;
        }
      },
      { restore: () => this.restore(control, key, part) },
    );
  }
  enumSelected(condition: FilterCondition, value: unknown): boolean {
    return Array.isArray(condition.value)
      ? condition.value.includes(value as never)
      : condition.value === value;
  }
  enumInput(condition: FilterCondition, element: HTMLSelectElement): boolean {
    return this.value(
      condition.id,
      element.multiple
        ? Array.from(element.selectedOptions).map((option) => option.value)
        : element.value,
      element,
    );
  }
  unbinding(): void {
    this.active = false;
    this.contexts.clear();
  }
}
function configure(editors: Record<string, FilterEditor> = {}) {
  const entries = Object.entries(editors).map(
    ([key, value]) => [key, Object.freeze({ ...value })] as const,
  );
  return {
    register(container: IContainer) {
      container.register(IFilterEditors, AuFilterBuilder, AuFilterGroup);
      const registry = container.get(IFilterEditors);
      for (const [key, editor] of entries) registry.register(key, editor);
      return container;
    },
  };
}
export const AureliaFilterBuilderConfiguration = { ...configure(), configure };
