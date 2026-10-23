import {
  bindable,
  computed,
  customElement,
  DI,
  IContainer,
  IObservation,
  IEffect,
  INode,
  resolve,
} from 'aurelia';

export interface SchemaField {
  key: string;
  type: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  visible?: (model: Readonly<Record<string, unknown>>) => boolean;
  options?: readonly { label: string; value: string }[];
  validate?: (value: unknown, model: Readonly<Record<string, unknown>>) => string | undefined;
}
export interface FieldContext {
  field: SchemaField;
  model: Record<string, unknown>;
  id: string;
  error?: string;
  touched: boolean;
  touch: () => void;
}
export interface FieldRenderer {
  readonly template: string;
}
export const IFieldRenderers = DI.createInterface<FieldRenderers>('IFieldRenderers', (x) =>
  x.singleton(FieldRenderers),
);
const input = (type: string) =>
  `<input id.bind="id" type="${type}" value.two-way="model[field.key]" required.bind="field.required" disabled.bind="field.disabled" placeholder.bind="field.placeholder" min.bind="field.min" max.bind="field.max" step.bind="field.step ?? 'any'" minlength.bind="field.minLength" maxlength.bind="field.maxLength" aria-invalid.bind="error ? 'true' : 'false'" aria-describedby.bind="error ? id + '-error' : null" blur.trigger="touch()">`;
const builtins: Record<string, FieldRenderer> = {
  text: { template: input('text') },
  email: { template: input('email') },
  textarea: {
    template:
      '<textarea id.bind="id" value.two-way="model[field.key]" required.bind="field.required" disabled.bind="field.disabled" placeholder.bind="field.placeholder" minlength.bind="field.minLength" maxlength.bind="field.maxLength" aria-invalid.bind="error ? \'true\' : \'false\'" aria-describedby.bind="error ? id + \'-error\' : null" blur.trigger="touch()"></textarea>',
  },
  number: { template: input('number').replace('value.two-way', 'value-as-number.two-way') },
  checkbox: {
    template: `<input id.bind="id" type="checkbox" checked.two-way="model[field.key]" required.bind="field.required" disabled.bind="field.disabled" aria-invalid.bind="error ? 'true' : 'false'" aria-describedby.bind="error ? id + '-error' : null" change.trigger="touch()">`,
  },
  select: {
    template: `<select id.bind="id" value.two-way="model[field.key]" required.bind="field.required" disabled.bind="field.disabled" aria-invalid.bind="error ? 'true' : 'false'" aria-describedby.bind="error ? id + '-error' : null" blur.trigger="touch()"><option value="">Choose…</option><option repeat.for="option of field.options" value.bind="option.value">\${option.label}</option></select>`,
  },
};
export class FieldRenderers {
  private readonly renderers = new Map<string, FieldRenderer>(
    Object.entries(builtins).map(([type, renderer]) => [type, Object.freeze({ ...renderer })]),
  );
  register(type: string, renderer: FieldRenderer): () => void {
    if (!type || !renderer.template) throw new Error('A renderer needs a type and template');
    if (this.renderers.has(type)) throw new Error(`Renderer already registered: ${type}`);
    const entry = Object.freeze({ ...renderer });
    this.renderers.set(type, entry);
    return () => {
      if (this.renderers.get(type) === entry) this.renderers.delete(type);
    };
  }
  get(type: string): FieldRenderer {
    const renderer = this.renderers.get(type);
    if (!renderer) throw new Error(`Unknown schema field type: ${type}`);
    return renderer;
  }
}
let nextFormId = 0;
@customElement({
  name: 'au-schema-form',
  template: `<form novalidate submit.trigger="submit($event)">
    <div repeat.for="row of rows" if.bind="isVisible(row.field)">
      <label for.bind="row.id">\${row.field.label}</label>
      <au-compose template.bind="row.template" component.bind="row.context" scope-behavior="scoped"></au-compose>
      <span if.bind="row.context.error" id.bind="row.id + '-error'" role="alert">\${row.context.error}</span>
    </div>
    <au-slot><button type="submit">Submit</button></au-slot>
  </form>`,
})
export class AuSchemaForm {
  @bindable schema: readonly SchemaField[] = [];
  @bindable model: Record<string, unknown> = {};
  rows: { field: SchemaField; id: string; template: string; context: FieldContext }[] = [];
  private readonly renderers = resolve(IFieldRenderers);
  private readonly host = resolve(INode) as HTMLElement;
  private readonly prefix = `au-schema-${++nextFormId}`;
  private active = false;
  private readonly observation = resolve(IObservation);
  private effect?: IEffect;
  binding(): void {
    this.active = true;
    this.rebuild();
    this.effect = this.observation.watch(
      this,
      (vm) => vm.rows.map((row) => (row.context.touched ? vm.errorFor(row.field) : undefined)),
      (errors) => {
        this.rows.forEach((row, index) => {
          row.context.error = errors[index];
        });
      },
      { immediate: false },
    );
  }
  schemaChanged(): void {
    if (this.active) this.rebuild();
  }
  modelChanged(): void {
    if (this.active) this.rebuild();
  }
  unbinding(): void {
    this.active = false;
    this.effect?.stop();
    this.effect = undefined;
    this.rows = [];
  }
  private rebuild(): void {
    const keys = new Set<string>();
    this.rows = this.schema.map((field, index) => {
      if (
        !field.key ||
        ['__proto__', 'prototype', 'constructor'].includes(field.key) ||
        keys.has(field.key)
      )
        throw new Error(`Invalid or duplicate schema key: ${field.key}`);
      for (const key of ['min', 'max', 'step', 'minLength', 'maxLength'] as const) {
        const value = field[key];
        if (
          value !== undefined &&
          (!Number.isFinite(value) ||
            (key === 'step' && value <= 0) ||
            ((key === 'minLength' || key === 'maxLength') &&
              (!Number.isInteger(value) || value < 0)))
        )
          throw new Error(`Invalid ${key} for ${field.key}`);
      }
      if (
        (field.min !== undefined && field.max !== undefined && field.min > field.max) ||
        (field.minLength !== undefined &&
          field.maxLength !== undefined &&
          field.minLength > field.maxLength)
      )
        throw new Error(`Invalid limits for ${field.key}`);
      keys.add(field.key);
      const id = `${this.prefix}-${index}`;
      const context: FieldContext = {
        field,
        model: this.model,
        id,
        touched: false,
        touch: () => {
          context.touched = true;
          context.error = this.errorFor(field);
        },
      };
      return { field, id, template: this.renderers.get(field.type).template, context };
    });
  }
  @computed()
  isVisible(field: SchemaField): boolean {
    return field.visible?.(this.model) !== false;
  }
  private errorFor(field: SchemaField): string | undefined {
    if (field.disabled || !this.isVisible(field)) return undefined;
    const value = this.model[field.key];
    const empty =
      value == null ||
      value === '' ||
      (field.type === 'number' && typeof value === 'number' && Number.isNaN(value));
    if (field.required && (empty || (field.type === 'checkbox' && value !== true)))
      return `${field.label} is required`;
    if (field.type === 'number' && !empty) {
      if (
        !['number', 'string'].includes(typeof value) ||
        (typeof value === 'string' && !value.trim()) ||
        !Number.isFinite(Number(value))
      )
        return `${field.label} must be a number`;
      const number = Number(value);
      if (field.min !== undefined && number < field.min)
        return `${field.label} must be at least ${field.min}`;
      if (field.max !== undefined && number > field.max)
        return `${field.label} must be at most ${field.max}`;
      if (field.step !== undefined) {
        const steps = (number - (field.min ?? 0)) / field.step;
        if (Math.abs(steps - Math.round(steps)) > 1e-8)
          return `${field.label} must use increments of ${field.step}`;
      }
    }
    if (!empty && typeof value === 'string') {
      if (field.minLength !== undefined && value.length < field.minLength)
        return `${field.label} must contain at least ${field.minLength} characters`;
      if (field.maxLength !== undefined && value.length > field.maxLength)
        return `${field.label} must contain at most ${field.maxLength} characters`;
    }
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))
      return `${field.label} must be an email address`;
    if (
      field.type === 'select' &&
      value !== '' &&
      value != null &&
      !field.options?.some((option) => option.value === value)
    )
      return `${field.label} has an invalid selection`;
    return field.validate?.(value, this.model);
  }
  validate(): boolean {
    let valid = true;
    for (const row of this.rows) {
      row.context.touched = true;
      row.context.error = this.errorFor(row.field);
      if (row.context.error) valid = false;
    }
    return valid;
  }
  submit(event?: Event): boolean {
    event?.preventDefault();
    const valid = this.validate();
    this.host.dispatchEvent(
      new CustomEvent(valid ? 'schema-submit' : 'schema-invalid', {
        bubbles: true,
        detail: {
          model: this.model,
          errors: Object.fromEntries(
            this.rows.filter((r) => r.context.error).map((r) => [r.field.key, r.context.error]),
          ),
        },
      }),
    );
    if (!valid) {
      const row = this.rows.find((r) => r.context.error);
      if (row) this.host.querySelector<HTMLElement>(`#${row.id}`)?.focus();
    }
    return valid;
  }
}
function configure(renderers: Record<string, FieldRenderer> = {}) {
  return {
    register(container: IContainer) {
      container.register(IFieldRenderers, AuSchemaForm);
      const registry = container.get(IFieldRenderers);
      for (const [type, renderer] of Object.entries(renderers)) registry.register(type, renderer);
      return container;
    },
  };
}
export const AureliaSchemaFormConfiguration = { ...configure(), configure };
