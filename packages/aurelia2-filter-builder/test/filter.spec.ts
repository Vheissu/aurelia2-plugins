import { createFixture } from '@aurelia/testing';
import { runTasks } from 'aurelia';
import {
  AureliaFilterBuilderConfiguration,
  compileFilter,
  copyFilter,
  describeFilter,
  filterFields,
  IFilterEditors,
  parseFilter,
  validateFilter,
  type FilterDocument,
  type FilterField,
  type FilterNode,
} from '../src/index';
const fields: FilterField[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'seats', label: 'Seats', type: 'number' },
  { key: 'active', label: 'Active', type: 'boolean' },
  { key: 'joined', label: 'Joined', type: 'date' },
  {
    key: 'plan',
    label: 'Plan',
    type: 'enum',
    options: [
      { label: 'Free', value: 'free' },
      { label: 'Pro', value: 'pro' },
    ],
  },
];
const document = (children: FilterNode[] = []): FilterDocument => ({
  version: 1,
  root: { kind: 'group', id: 'root', combinator: 'all', children },
});
const condition = (
  field = 'name',
  operator = 'eq',
  value: unknown = 'Ada',
  id = 'c',
): FilterNode => ({ kind: 'condition', id, field, operator: operator as any, value });
describe('filter documents', () => {
  it('compiles nested all/any/none groups without generating executable code', () => {
    const filter = document([
      condition('seats', 'gte', 10),
      {
        kind: 'group',
        id: 'g',
        combinator: 'none',
        children: [condition('plan', 'eq', 'free', 'c2')],
      },
    ]);
    const test = compileFilter(filter, fields);
    expect(test({ seats: 10, plan: 'pro' })).toBe(true);
    expect(test({ seats: 10, plan: 'free' })).toBe(false);
    expect(test({ seats: NaN, plan: 'pro' })).toBe(false);
    expect(test(Object.create({ seats: 10, plan: 'pro' }))).toBe(false);
    const dangerous = "'); throw Error('oops'); //";
    expect(
      compileFilter(document([condition('name', 'eq', dangerous)]), fields)({ name: dangerous }),
    ).toBe(true);
    expect(compileFilter(document(), fields)({})).toBe(true);
  });
  it.each([
    ['name', 'contains', 'da', { name: 'Ada' }, true],
    ['name', 'starts-with', 'Ad', { name: 'Ada' }, true],
    ['name', 'ends-with', 'zz', { name: 'Ada' }, false],
    ['seats', 'between', [2, 4], { seats: 4 }, true],
    ['active', 'eq', false, { active: false }, true],
    ['joined', 'lt', '2024-03-01', { joined: '2024-02-29' }, true],
    ['plan', 'any-of', ['pro'], { plan: 'pro' }, true],
    ['plan', 'none-of', ['pro'], { plan: 'free' }, true],
    ['name', 'is-empty', undefined, {}, true],
    ['name', 'is-not-empty', undefined, { name: '' }, false],
  ])('evaluates %s %s', (field, op, value, record, expected) => {
    expect(
      compileFilter(
        document([condition(field as string, op as string, value)]),
        fields,
      )(record as any),
    ).toBe(expected);
  });
  it('rejects invalid dates, reversed ranges, unknown fields/operators and prototype keys', () => {
    for (const child of [
      condition('joined', 'eq', '2024-02-30'),
      condition('seats', 'between', [4, 2]),
      condition('missing'),
      condition('active', 'contains', 'x'),
      condition('__proto__'),
      condition('plan', 'any-of', ['bad']),
    ])
      expect(parseFilter(document([child]), fields).filter).toBeNull();
    expect(() => compileFilter(document([condition('missing')]), fields)).toThrow(
      'available field',
    );
    expect(() => filterFields([...fields, fields[0]])).toThrow('duplicate');
  });
  it('bounds hostile documents before recursion, rejects cycles and duplicate identifiers', () => {
    let node: FilterNode = condition();
    for (let i = 0; i < 10000; i++)
      node = { kind: 'group', id: 'g' + i, combinator: 'all', children: [node] };
    expect(parseFilter(document([node]), fields).issues[0].message).toContain('limits');
    const cycle: any = document();
    cycle.root.children.push(cycle.root);
    expect(parseFilter(cycle, fields).filter).toBeNull();
    expect(parseFilter(document([condition(), condition()]), fields).issues[0].message).toContain(
      'unique',
    );
    expect(parseFilter('not JSON', fields).filter).toBeNull();
    expect(
      parseFilter(document([condition('name', 'eq', 'abc')]), fields, { maxTextLength: 2 }).filter,
    ).toBeNull();
  });
  it('captures definitions and filter values at compilation and treats throwing record getters as nonmatches', () => {
    const filter = document([condition()]);
    const test = compileFilter(filter, fields);
    (filter.root.children[0] as any).value = 'Grace';
    expect(test({ name: 'Ada' })).toBe(true);
    const value = Object.defineProperty({}, 'name', {
      get() {
        throw Error('getter');
      },
    });
    expect(test(value)).toBe(false);
    expect(describeFilter(filter, fields)).toContain('Name eq');
  });
  it('keeps incomplete filters editable but prevents compiling them', () => {
    const filter = document([{ kind: 'group', id: 'empty', combinator: 'any', children: [] }]);
    expect(copyFilter(filter)).toEqual(filter);
    expect(validateFilter(filter, fields)[0].code).toBe('empty-group');
    expect(() => compileFilter(filter, fields)).toThrow('Add a condition');
  });
});
async function setup(filter = document(), configuration = AureliaFilterBuilderConfiguration) {
  const f = createFixture(
    '<au-filter-builder fields.bind="fields" filter.two-way="filter" component.ref="view"></au-filter-builder>',
    { fields: [...fields], filter, view: undefined as any },
    [configuration],
  );
  await f.startPromise;
  return f;
}
describe('filter builder views', () => {
  it('renders nested fieldsets and publishes immutable edits through DOM inputs', async () => {
    const source = document([
      { kind: 'group', id: 'nested', combinator: 'any', children: [condition()] },
    ]);
    const f = await setup(source);
    const change = jest.fn();
    f.appHost.addEventListener('filter-change', change);
    try {
      expect(f.appHost.querySelectorAll('fieldset')).toHaveLength(2);
      const input = f.appHost.querySelector<HTMLInputElement>(
        'input[aria-label="Condition value"]',
      )!;
      input.value = 'Grace';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      runTasks();
      expect(f.component.filter).not.toBe(source);
      expect((source.root.children[0] as any).children[0].value).toBe('Ada');
      expect(compileFilter(f.component.filter, fields)({ name: 'Grace' })).toBe(true);
      expect(change).toHaveBeenCalledTimes(1);
    } finally {
      await f.tearDown();
    }
  });
  it('adds and removes conditions with focus and live announcements', async () => {
    const f = await setup();
    try {
      const button = Array.from(f.appHost.querySelectorAll('button')).find(
        (b) => b.textContent === 'Add condition',
      )!;
      button.click();
      runTasks();
      expect(f.component.filter.root.children).toHaveLength(1);
      expect(globalThis.document.activeElement?.getAttribute('aria-label')).toBe('Condition field');
      const key = f.component.filter.root.children[0].id;
      expect(f.component.view.remove(key)).toBe(true);
      runTasks();
      expect(f.component.filter.root.children).toHaveLength(0);
      expect(f.appHost.querySelector('[role=status]')!.textContent).toContain('removed');
    } finally {
      await f.tearDown();
    }
  });
  it('resets incompatible values and renders number, range, enum and boolean editors', async () => {
    const f = await setup(document([condition()]));
    try {
      f.component.view.changeField('c', 'seats');
      runTasks();
      expect(f.component.view.valid).toBe(false);
      f.component.view.operator('c', 'between');
      runTasks();
      expect(f.appHost.querySelectorAll('input[type=number]')).toHaveLength(2);
      f.component.view.input(f.component.view.document.root.children[0], '2', 0);
      f.component.view.input(f.component.view.document.root.children[0], '4', 1);
      runTasks();
      expect(f.component.view.valid).toBe(true);
      f.component.view.changeField('c', 'plan');
      runTasks();
      expect(f.appHost.querySelectorAll('[aria-label="Condition value"] option')).toHaveLength(2);
      f.component.view.changeField('c', 'active');
      runTasks();
      const select = f.appHost.querySelector<HTMLSelectElement>('[aria-label="Condition value"]')!;
      select.value = 'false';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      runTasks();
      expect((f.component.filter.root.children[0] as any).value).toBe(false);
    } finally {
      await f.tearDown();
    }
  });
  it('supports event veto and rejects same-turn source edits without overwriting them', async () => {
    const f = await setup(document([condition()]));
    const changed = jest.fn();
    f.appHost.addEventListener('filter-change', changed);
    try {
      const veto = (e: Event) => e.preventDefault();
      f.appHost.addEventListener('filter-before-change', veto);
      expect(f.component.view.value('c', 'Other')).toBe(false);
      f.appHost.removeEventListener('filter-before-change', veto);
      f.appHost.addEventListener('filter-before-change', () => {
        (f.component.filter.root.children[0] as any).value = 'External';
      });
      expect(f.component.view.value('c', 'Other')).toBe(false);
      expect((f.component.filter.root.children[0] as any).value).toBe('External');
      expect(changed).not.toHaveBeenCalled();
    } finally {
      await f.tearDown();
    }
  });
  it('keeps removed-field conditions visible with validation errors', async () => {
    const f = await setup(document([condition()]));
    try {
      f.component.fields = fields.filter((field) => field.key !== 'name');
      runTasks();
      expect(f.component.filter.root.children).toHaveLength(1);
      expect(f.component.view.valid).toBe(false);
      expect(f.appHost.textContent).toContain('Unknown field: name');
    } finally {
      await f.tearDown();
    }
  });
  it('composes field-specific custom editors and isolates registries between apps', async () => {
    const config = AureliaFilterBuilderConfiguration.configure({
      name: {
        template: '<button type="button" click.trigger="setValue(\'Custom\')">Use custom</button>',
      },
    });
    const f = await setup(document([condition()]), config);
    const g = await setup(document([condition()]));
    try {
      const button = Array.from(f.appHost.querySelectorAll('button')).find(
        (b) => b.textContent === 'Use custom',
      )!;
      button.click();
      runTasks();
      expect((f.component.filter.root.children[0] as any).value).toBe('Custom');
      expect(g.appHost.textContent).not.toContain('Use custom');
      expect(() => f.container.get(IFilterEditors).register('name', { template: 'text' })).toThrow(
        'duplicate',
      );
    } finally {
      await f.tearDown();
      await g.tearDown();
    }
  });
  it('enforces limits, static boolean syntax, and stop/start lifecycle', async () => {
    const f = createFixture(
      '<au-filter-builder fields.bind="fields" filter.two-way="filter" max-conditions="1" max-depth="1" component.ref="view"></au-filter-builder><au-filter-builder fields.bind="fields" disabled></au-filter-builder>',
      { fields, filter: document([condition()]), view: undefined as any },
      [AureliaFilterBuilderConfiguration],
    );
    await f.startPromise;
    try {
      expect(f.component.view.canAdd(0, false)).toBe(false);
      expect(f.component.view.add('root', false)).toBe(false);
      expect(f.appHost.querySelectorAll('fieldset')[1].disabled).toBe(true);
      await f.au.stop();
      await f.au.start();
      runTasks();
      expect(f.component.view.document.root.children).toHaveLength(1);
    } finally {
      await f.tearDown();
    }
  });
});

it('supports enum multi-selection and prevents changing limits inside a proposed edit', async () => {
  const f = await setup(document([condition('plan', 'any-of', ['pro'])]));
  try {
    const select = f.appHost.querySelector<HTMLSelectElement>('[aria-label="Condition value"]')!;
    expect(select.multiple).toBe(true);
    for (const option of Array.from(select.options)) option.selected = true;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    runTasks();
    expect((f.component.filter.root.children[0] as any).value).toEqual(['free', 'pro']);
    const original = f.component.filter;
    f.appHost.addEventListener('filter-before-change', () => {
      f.component.view.maxDepth = 2;
    });
    expect(f.component.view.value('c', ['free'])).toBe(false);
    expect(f.component.filter).toBe(original);
  } finally {
    await f.tearDown();
  }
});

const settle = async () => {
  runTasks();
  await new Promise((done) => setTimeout(done, 0));
  runTasks();
};
async function mount(
  filter: FilterDocument,
  attributes = '',
  configuration = AureliaFilterBuilderConfiguration,
) {
  const f = createFixture(
    `<au-filter-builder fields.bind="fields" filter.two-way="filter" component.ref="view" ${attributes}></au-filter-builder>`,
    { fields: [...fields], filter, view: undefined as any },
    [configuration],
  );
  await f.startPromise;
  return f;
}
const group = (id: string, children: FilterNode[]): FilterNode => ({
  kind: 'group',
  id,
  combinator: 'all',
  children,
});
const control = <T extends Element>(host: Element, selector: string) =>
  host.querySelector<T>(selector)!;
const change = (element: HTMLElement, type = 'change') =>
  element.dispatchEvent(new Event(type, { bubbles: true }));

describe('review regressions', () => {
  it('keeps custom editor contexts and DOM mounted across own and unrelated edits', async () => {
    const config = AureliaFilterBuilderConfiguration.configure({
      name: {
        template:
          '<input class="custom" value.to-view="condition.value" input.trigger="setValue($event.target.value, $event.target)"><output>${condition.value}</output>',
      },
    });
    const f = await mount(document([condition(), condition('seats', 'eq', 1, 'c2')]), '', config);
    try {
      await settle();
      const input = control<HTMLInputElement>(f.appHost, 'input.custom');
      const context = f.component.view.context(f.component.view.document.root.children[0]);
      input.focus();
      input.value = 'Adam';
      change(input, 'input');
      await settle();
      expect((f.component.filter.root.children[0] as any).value).toBe('Adam');
      expect(control(f.appHost, 'input.custom')).toBe(input);
      expect(globalThis.document.activeElement).toBe(input);
      expect(control(f.appHost, 'output').textContent).toBe('Adam');
      // The composed template observes the context, so Aurelia installs own accessors on it.
      expect(Object.getOwnPropertyDescriptor(context, 'condition')?.get).toBeDefined();
      expect(f.component.view.value('c2', 5)).toBe(true);
      await settle();
      expect(control(f.appHost, 'input.custom')).toBe(input);
      expect(f.component.view.context(f.component.view.document.root.children[0])).toBe(context);
      expect(context.condition.value).toBe('Adam');
      const veto = (event: Event) => event.preventDefault();
      f.appHost.addEventListener('filter-before-change', veto);
      input.value = 'Zed';
      expect(context.setValue('Zed', input)).toBe(false);
      expect(input.value).toBe('Adam');
      f.appHost.removeEventListener('filter-before-change', veto);
      expect(f.component.view.remove('c')).toBe(true);
      await settle();
      expect(f.appHost.querySelector('input.custom')).toBeNull();
      f.component.filter = document([condition()]);
      await settle();
      expect(f.component.view.context(f.component.view.document.root.children[0])).not.toBe(
        context,
      );
    } finally {
      await f.tearDown();
    }
  });

  it('edits bound documents whose properties Aurelia already observes', async () => {
    const f = createFixture(
      '<p>${filter.root.combinator} <b repeat.for="c of filter.root.children">${c.value}</b></p><au-filter-builder fields.bind="fields" filter.two-way="filter" component.ref="view"></au-filter-builder>',
      { fields, filter: document([condition()]), view: undefined as any },
      [AureliaFilterBuilderConfiguration],
    );
    await f.startPromise;
    try {
      expect(
        Object.getOwnPropertyDescriptor(f.component.filter.root, 'combinator')?.get,
      ).toBeDefined();
      expect(f.component.view.error).toBe('');
      expect(f.component.view.value('c', 'Grace')).toBe(true);
      expect(f.component.view.combinator('root', 'any')).toBe(true);
      runTasks();
      expect(f.appHost.querySelector('p')!.textContent).toBe('any Grace');
    } finally {
      await f.tearDown();
    }
  });

  it('restores rejected DOM controls after veto, stale edits, and limit errors', async () => {
    const f = await mount(
      document([
        condition(),
        condition('plan', 'any-of', ['pro'], 'c2'),
        condition('active', 'eq', true, 'c3'),
        condition('seats', 'between', [2, 4], 'c4'),
      ]),
    );
    const errors = jest.fn();
    window.addEventListener('error', errors);
    try {
      const veto = (event: Event) => event.preventDefault();
      f.appHost.addEventListener('filter-before-change', veto);
      const status = control(f.appHost, '[role=status]');
      const match = control<HTMLSelectElement>(f.appHost, '[aria-label="Group match"]');
      match.value = 'any';
      change(match);
      expect(match.value).toBe('all');
      runTasks();
      expect(status.textContent).toBe('Change cancelled');
      const name = control<HTMLInputElement>(f.appHost, '[data-filter-node="c"] input');
      name.value = 'Grace';
      change(name, 'input');
      expect(name.value).toBe('Ada');
      const field = control<HTMLSelectElement>(
        f.appHost,
        '[data-filter-node="c"] [aria-label="Condition field"]',
      );
      field.value = 'seats';
      change(field);
      expect(field.value).toBe('name');
      const operator = control<HTMLSelectElement>(
        f.appHost,
        '[data-filter-node="c"] [aria-label="Condition operator"]',
      );
      operator.value = 'contains';
      change(operator);
      expect(operator.value).toBe('eq');
      const plans = control<HTMLSelectElement>(
        f.appHost,
        '[data-filter-node="c2"] select[multiple]',
      );
      for (const option of Array.from(plans.options)) option.selected = true;
      change(plans);
      expect(Array.from(plans.selectedOptions).map((option) => option.value)).toEqual(['pro']);
      const active = control<HTMLSelectElement>(
        f.appHost,
        '[data-filter-node="c3"] [aria-label="Condition value"]',
      );
      active.value = 'false';
      change(active);
      expect(active.value).toBe('true');
      const lower = control<HTMLInputElement>(
        f.appHost,
        '[data-filter-node="c4"] [aria-label="Lower bound"]',
      );
      lower.value = '3';
      change(lower, 'input');
      expect(lower.value).toBe('2');
      f.appHost.removeEventListener('filter-before-change', veto);
      const replace = () => {
        f.component.filter = JSON.parse(JSON.stringify(f.component.filter));
      };
      f.appHost.addEventListener('filter-before-change', replace);
      name.value = 'Stale';
      change(name, 'input');
      expect(name.value).toBe('Ada');
      runTasks();
      expect(status.textContent).toContain('filter changed');
      f.appHost.removeEventListener('filter-before-change', replace);
      name.value = 'x'.repeat(10001);
      change(name, 'input');
      expect(name.value).toBe('Ada');
      runTasks();
      expect(status.textContent).toContain('Change not applied');
      expect((f.component.filter.root.children[0] as any).value).toBe('Ada');
      expect(errors).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('error', errors);
      await f.tearDown();
    }
  });

  it('limits value lists separately from conditions and keeps over-limit documents editable', async () => {
    const many = document([condition(), condition('seats', 'eq', 1, 'c2')]);
    expect(validateFilter(many, fields, { maxConditions: 1 }).map((issue) => issue.code)).toEqual([
      'condition-limit',
    ]);
    const plans = document([condition('plan', 'any-of', ['free', 'pro'])]);
    expect(parseFilter(plans, fields, { maxConditions: 1 }).filter).not.toBeNull();
    expect(parseFilter(plans, fields, { maxValues: 1 }).issues[0].code).toBe('invalid-document');
    const f = await mount(document([condition('plan', 'any-of', ['free'])]), 'max-conditions="1"');
    try {
      const select = control<HTMLSelectElement>(f.appHost, 'select[multiple]');
      for (const option of Array.from(select.options)) option.selected = true;
      change(select);
      expect((f.component.filter.root.children[0] as any).value).toEqual(['free', 'pro']);
    } finally {
      await f.tearDown();
    }
    const g = await mount(many, 'max-conditions="1"');
    try {
      expect(
        g.appHost.querySelectorAll('[data-filter-node="c"], [data-filter-node="c2"]'),
      ).toHaveLength(2);
      expect(g.component.view.valid).toBe(false);
      expect(g.appHost.textContent).toContain('Use at most 1 conditions');
      const adds = Array.from(g.appHost.querySelectorAll<HTMLButtonElement>('button')).filter((b) =>
        b.textContent!.startsWith('Add'),
      );
      expect(adds.every((button) => button.disabled)).toBe(true);
      expect(g.component.view.remove('c2')).toBe(true);
      expect(g.component.view.valid).toBe(true);
    } finally {
      await g.tearDown();
    }
    const h = await mount(document([group('g', [condition()])]), 'max-depth="1"');
    try {
      expect(h.appHost.querySelector('[data-filter-node="c"]')).not.toBeNull();
      expect(h.component.view.issues).toEqual([
        expect.objectContaining({ id: 'c', code: 'depth-limit' }),
      ]);
      expect(h.component.view.add('root', false)).toBe(false);
      expect(h.component.view.remove('g')).toBe(true);
      expect(h.component.view.valid).toBe(true);
    } finally {
      await h.tearDown();
    }
  });

  it('describes and validates deep documents with the configured depth limit', async () => {
    let node = condition();
    for (let i = 0; i < 7; i++) node = group('g' + i, [node]);
    const deep = document([node]);
    expect(validateFilter(deep, fields)[0].code).toBe('depth-limit');
    expect(describeFilter(deep, fields, { maxDepth: 10 })).toContain('Name eq');
    const f = await mount(deep, 'max-depth="10"');
    try {
      expect(f.component.view.valid).toBe(true);
      expect(f.component.view.summary).toContain('Name eq');
    } finally {
      await f.tearDown();
    }
  });

  it('rejects sparse child and value arrays without crashing the view', async () => {
    const pair: unknown[] = new Array(2);
    const list: unknown[] = [];
    list.length = 1;
    for (const child of [condition('seats', 'between', pair), condition('plan', 'none-of', list)])
      expect(parseFilter(document([child]), fields).issues[0].message).toContain('Sparse');
    const children: FilterNode[] = [];
    children.length = 1;
    const sparse = document([group('g', children)]);
    expect(() => copyFilter(sparse)).toThrow('Sparse');
    const f = await mount(sparse);
    try {
      expect(f.component.view.error).toContain('Sparse');
      expect(f.appHost.querySelector('fieldset')).toBeNull();
    } finally {
      await f.tearDown();
    }
  });

  it('shows a safe invalid state until fields load', async () => {
    const f = createFixture(
      '<au-filter-builder fields.bind="schema.fields" filter.bind="filter" component.ref="view"></au-filter-builder>',
      { schema: undefined as any, filter: document([condition()]), view: undefined as any },
      [AureliaFilterBuilderConfiguration],
    );
    await f.startPromise;
    try {
      expect(f.component.view.valid).toBe(false);
      expect(f.component.view.issues[0].code).toBe('fields-unavailable');
      expect(f.appHost.querySelector('[data-filter-node="c"]')).not.toBeNull();
      expect(f.component.view.canAdd(0, false)).toBe(false);
      f.component.schema = { fields };
      runTasks();
      expect(f.component.view.valid).toBe(true);
      f.component.schema = { fields: [fields[0], fields[0]] };
      runTasks();
      expect(f.component.view.error).toContain('duplicate');
    } finally {
      await f.tearDown();
    }
  });

  it('does not add a group without a condition budget to populate it', async () => {
    const f = await mount(document([condition()]), 'max-conditions="1"');
    try {
      expect(f.component.view.canAdd(0, true)).toBe(false);
      expect(f.component.view.add('root', true)).toBe(false);
      expect(f.component.filter.root.children).toHaveLength(1);
      expect(f.component.view.remove('c')).toBe(true);
      expect(f.component.view.add('root', true)).toBe(true);
      const created = f.component.filter.root.children[0].id;
      expect(f.component.view.add(created, false)).toBe(true);
      expect(f.component.view.valid).toBe(true);
      expect(f.component.view.canAdd(0, true)).toBe(false);
    } finally {
      await f.tearDown();
    }
  });
});
