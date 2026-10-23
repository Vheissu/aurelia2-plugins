import { createFixture } from '@aurelia/testing';
import { runTasks } from 'aurelia';
import { AureliaSchemaFormConfiguration, IFieldRenderers, SchemaField } from '../src/index';
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  runTasks();
};
function setup(schema: SchemaField[], model: Record<string, unknown> = {}, renderers = {}) {
  return createFixture(
    '<au-schema-form schema.bind="schema" model.bind="model" component.ref="form"></au-schema-form>',
    { schema, model, form: undefined as any },
    [AureliaSchemaFormConfiguration.configure(renderers)],
  );
}
describe('schema forms', () => {
  it('composes labelled fields and writes input values through Aurelia two-way bindings', async () => {
    const f = setup([{ key: 'name', type: 'text', label: 'Name' }], { name: 'Ada' });
    await f.startPromise;
    const input = f.appHost.querySelector('input')!;
    expect(input.value).toBe('Ada');
    expect(f.appHost.querySelector('label')!.htmlFor).toBe(input.id);
    input.value = 'Grace';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(f.component.model.name).toBe('Grace');
    f.component.model.name = 'Lin';
    runTasks();
    expect(input.value).toBe('Lin');
    await f.tearDown();
  });
  it('validates required fields, emits structured errors and focuses the first invalid field', async () => {
    const f = setup([{ key: 'email', type: 'email', label: 'Email', required: true }], {
      email: '',
    });
    await f.startPromise;
    const invalid = jest.fn();
    f.appHost.addEventListener('schema-invalid', invalid);
    const event = new Event('submit', { bubbles: true, cancelable: true });
    f.appHost.querySelector('form')!.dispatchEvent(event);
    runTasks();
    expect(event.defaultPrevented).toBe(true);
    expect(invalid.mock.calls[0][0].detail.errors.email).toBe('Email is required');
    expect(document.activeElement).toBe(f.appHost.querySelector('input'));
    expect(f.appHost.querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
    f.component.model.email = 'invalid';
    expect(f.component.form.validate()).toBe(false);
    f.component.model.email = 'ada@example.test';
    const submitted = jest.fn();
    f.appHost.addEventListener('schema-submit', submitted);
    expect(f.component.form.submit()).toBe(true);
    expect(submitted).toHaveBeenCalledTimes(1);
    await f.tearDown();
  });
  it('supports registered custom Aurelia renderers without constructing HTML from schema values', async () => {
    const f = setup(
      [{ key: 'bio', type: 'long-text', label: '<script>oops</script>' }],
      { bio: 'Hello' },
      {
        'long-text': {
          template: '<textarea id.bind="id" value.two-way="model[field.key]"></textarea>',
        },
      },
    );
    await f.startPromise;
    expect(f.appHost.querySelector('textarea')!.value).toBe('Hello');
    expect(f.appHost.querySelector('script')).toBeNull();
    const registry = f.container.get(IFieldRenderers);
    expect(() => registry.register('text', { template: 'x' })).toThrow('already registered');
    const dispose = registry.register('custom', { template: '<span>custom</span>' });
    expect(registry.get('custom')).toBeDefined();
    dispose();
    expect(() => registry.get('custom')).toThrow('Unknown');
    await f.tearDown();
  });
  it('ignores hidden and disabled fields, then validates when visible', async () => {
    const f = setup(
      [
        {
          key: 'extra',
          type: 'text',
          label: 'Extra',
          required: true,
          visible: (m) => m.show === true,
        },
        { key: 'locked', type: 'text', label: 'Locked', disabled: true, required: true },
      ],
      { show: false, extra: '' },
    );
    await f.startPromise;
    expect(f.component.form.validate()).toBe(true);
    expect(f.appHost.querySelectorAll('input')).toHaveLength(1);
    f.component.model.show = true;
    await flush();
    expect(f.appHost.querySelectorAll('input')).toHaveLength(2);
    expect(f.component.form.validate()).toBe(false);
    await f.tearDown();
  });
  it('supports custom validators and rejects options outside the schema', async () => {
    const f = setup(
      [
        {
          key: 'plan',
          type: 'select',
          label: 'Plan',
          options: [{ label: 'Basic', value: 'basic' }],
          validate: (value) => (value === 'basic' ? 'Unavailable' : undefined),
        },
      ],
      { plan: 'forged' },
    );
    await f.startPromise;
    f.component.model.plan = 'forged';
    expect(f.component.form.validate()).toBe(false);
    expect(f.component.form.rows[0].context.error).toContain('invalid selection');
    f.component.model.plan = 'basic';
    expect(f.component.form.validate()).toBe(false);
    expect(f.component.form.rows[0].context.error).toBe('Unavailable');
    await f.tearDown();
  });
  it('rejects duplicate and prototype-mutating keys and unknown renderer types', async () => {
    const f = setup([], {});
    await f.startPromise;
    for (const schema of [
      [{ key: '__proto__', type: 'text', label: 'X' }],
      [
        { key: 'x', type: 'text', label: 'X' },
        { key: 'x', type: 'text', label: 'Y' },
      ],
      [{ key: 'x', type: 'missing', label: 'X' }],
    ]) {
      // Exercise the public bindable callback on the DI-created resource.
      expect(() => {
        f.component.form.schema = schema;
        f.component.form.schemaChanged();
      }).toThrow();
      f.component.form.schema = [];
    }
    await f.tearDown();
  });
  it('switches model identity without retaining old field bindings', async () => {
    const old = { name: 'old' };
    const f = setup([{ key: 'name', type: 'text', label: 'Name' }], old);
    await f.startPromise;
    f.component.model = { name: 'new' };
    await flush();
    const input = f.appHost.querySelector('input')!;
    expect(input.value).toBe('new');
    input.value = 'changed';
    input.dispatchEvent(new Event('input'));
    expect(old.name).toBe('old');
    await f.tearDown();
  });
});

it('binds number fields as numbers and validates required checkboxes', async () => {
  const f = setup(
    [
      { key: 'age', type: 'number', label: 'Age', required: true },
      { key: 'terms', type: 'checkbox', label: 'Terms', required: true },
    ],
    { age: 10, terms: false },
  );
  await f.startPromise;
  const input = f.appHost.querySelector<HTMLInputElement>('input[type=number]')!;
  input.value = '42';
  input.dispatchEvent(new Event('input'));
  expect(f.component.model.age).toBe(42);
  expect(f.component.form.validate()).toBe(false);
  f.component.model.terms = true;
  expect(f.component.form.validate()).toBe(true);
  await f.tearDown();
});

it('accepts a cleared optional number input and rejects numeric coercion of booleans', async () => {
  const f = setup([{ key: 'n', type: 'number', label: 'Count' }], { n: 1 });
  await f.startPromise;
  try {
    const input = f.appHost.querySelector('input')!;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(f.component.form.validate()).toBe(true);
    f.component.model.n = true;
    expect(f.component.form.validate()).toBe(false);
  } finally {
    await f.tearDown();
  }
});

it('updates touched errors while typing and when cross-field validation dependencies change', async () => {
  const f = setup(
    [
      { key: 'name', type: 'text', label: 'Name', required: true },
      {
        key: 'confirmation',
        type: 'text',
        label: 'Confirm',
        validate: (value, model) => (value === model.name ? undefined : 'Must match'),
      },
    ],
    { name: '', confirmation: '' },
  );
  await f.startPromise;
  try {
    expect(f.component.form.validate()).toBe(false);
    runTasks();
    const inputs = f.appHost.querySelectorAll('input');
    inputs[0].value = 'Ada';
    inputs[0].dispatchEvent(new Event('input'));
    runTasks();
    expect(inputs[0].getAttribute('aria-invalid')).toBe('false');
    expect(inputs[1].getAttribute('aria-invalid')).toBe('true');
    inputs[1].value = 'Ada';
    inputs[1].dispatchEvent(new Event('input'));
    runTasks();
    expect(inputs[1].getAttribute('aria-invalid')).toBe('false');
  } finally {
    await f.tearDown();
  }
});
it('enforces number and text constraints in both the model and native inputs', async () => {
  const f = setup(
    [
      { key: 'amount', type: 'number', label: 'Amount', min: 1, max: 5, step: 0.5 },
      {
        key: 'body',
        type: 'textarea',
        label: 'Body',
        minLength: 2,
        maxLength: 5,
        placeholder: 'Write here',
      },
    ],
    { amount: 0, body: 'a' },
  );
  await f.startPromise;
  try {
    const input = f.appHost.querySelector('input')!;
    expect(input.min).toBe('1');
    expect(input.step).toBe('0.5');
    expect(f.appHost.querySelector('textarea')!.placeholder).toBe('Write here');
    for (const amount of [0, 6, 1.2]) {
      f.component.model.amount = amount;
      expect(f.component.form.validate()).toBe(false);
    }
    f.component.model.amount = 1.5;
    f.component.model.body = 'valid';
    expect(f.component.form.validate()).toBe(true);
    f.component.model.body = 'too long';
    expect(f.component.form.validate()).toBe(false);
  } finally {
    await f.tearDown();
  }
});

it('isolates renderer registrations from caller mutation and other app containers', async () => {
  const f = setup([], {});
  const g = setup([], {});
  await f.startPromise;
  await g.startPromise;
  try {
    const first = f.container.get(IFieldRenderers);
    const second = g.container.get(IFieldRenderers);
    expect(first.get('text')).not.toBe(second.get('text'));
    expect(Object.isFrozen(first.get('text'))).toBe(true);
    const renderer = { template: '<span>Original</span>' };
    const remove = first.register('local-only', renderer);
    renderer.template = '<span>Changed</span>';
    expect(first.get('local-only').template).toBe('<span>Original</span>');
    expect(() => second.get('local-only')).toThrow('Unknown');
    remove();
    remove();
    expect(() => first.get('local-only')).toThrow('Unknown');
  } finally {
    await f.tearDown();
    await g.tearDown();
  }
});
