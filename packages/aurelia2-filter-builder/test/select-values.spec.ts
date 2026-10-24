import { createFixture } from '@aurelia/testing';
import {
  AureliaFilterBuilderConfiguration,
  type FilterDocument,
  type FilterField,
} from '../src/index';

it('renders saved field, operator and enum selections when option repeats first attach', async () => {
  const fields: FilterField[] = [
    { key: 'name', label: 'Name', type: 'text' },
    {
      key: 'plan',
      label: 'Plan',
      type: 'enum',
      options: [
        { value: 'free', label: 'Free' },
        { value: 'pro', label: 'Pro' },
      ],
    },
  ];
  const filter: FilterDocument = {
    version: 1,
    root: {
      kind: 'group',
      id: 'root',
      combinator: 'all',
      children: [
        { kind: 'condition', id: 'name', field: 'name', operator: 'contains', value: 'Acme' },
        { kind: 'condition', id: 'plan', field: 'plan', operator: 'eq', value: 'pro' },
      ],
    },
  };
  const f = createFixture(
    '<au-filter-builder fields.bind="fields" filter.bind="filter"></au-filter-builder>',
    { fields, filter },
    [AureliaFilterBuilderConfiguration],
  );
  await f.startPromise;
  try {
    const values = (label: string) =>
      Array.from(
        f.appHost.querySelectorAll<HTMLSelectElement>(`select[aria-label="${label}"]`),
      ).map((s) => s.value);
    expect(values('Condition field')).toEqual(['name', 'plan']);
    expect(values('Condition operator')).toEqual(['contains', 'eq']);
    expect(values('Condition value')).toEqual(['pro']);
  } finally {
    await f.tearDown();
  }
});
