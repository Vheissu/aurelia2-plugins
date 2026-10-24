export type FilterType = 'text' | 'number' | 'boolean' | 'date' | 'enum';
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'starts-with'
  | 'ends-with'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'between'
  | 'any-of'
  | 'none-of'
  | 'is-empty'
  | 'is-not-empty';
export interface FilterField {
  key: string;
  label: string;
  type: FilterType;
  options?: readonly { label: string; value: string }[];
}
export interface FilterCondition {
  kind: 'condition';
  id: string;
  field: string;
  operator: FilterOperator;
  value?: unknown;
}
export interface FilterGroup {
  kind: 'group';
  id: string;
  combinator: 'all' | 'any' | 'none';
  children: FilterNode[];
}
export type FilterNode = FilterCondition | FilterGroup;
export interface FilterDocument {
  version: 1;
  root: FilterGroup;
}
export interface FilterLimits {
  maxDepth: number;
  maxConditions: number;
  maxNodes: number;
  maxValues: number;
  maxTextLength: number;
}
export interface FilterIssue {
  id?: string;
  code: string;
  message: string;
}
export const defaultLimits: Readonly<FilterLimits> = Object.freeze({
  maxDepth: 6,
  maxConditions: 100,
  maxNodes: 200,
  maxValues: 100,
  maxTextLength: 10000,
});
const maxStructuralDepth = 32;
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
const byType: Record<FilterType, readonly FilterOperator[]> = {
  text: ['eq', 'neq', 'contains', 'starts-with', 'ends-with', 'is-empty', 'is-not-empty'],
  number: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'is-empty', 'is-not-empty'],
  date: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'is-empty', 'is-not-empty'],
  boolean: ['eq', 'neq', 'is-empty', 'is-not-empty'],
  enum: ['eq', 'neq', 'any-of', 'none-of', 'is-empty', 'is-not-empty'],
};
export function filterLimits(options: Partial<FilterLimits> = {}): FilterLimits {
  const value = { ...defaultLimits, ...options };
  if (
    !Object.values(value).every((v) => Number.isInteger(v) && v > 0) ||
    value.maxDepth > maxStructuralDepth ||
    value.maxNodes > 100000 ||
    value.maxValues > 10000 ||
    value.maxTextLength > 1000000
  )
    throw new Error('Invalid filter limits');
  return value;
}
/**
 * Hard bounds for structural copies. Depth and condition counts above the policy limits are
 * reported as issues instead, so over-limit saved documents stay visible and can be trimmed.
 */
export function structuralLimits(options: Partial<FilterLimits> = {}): FilterLimits {
  const limits = filterLimits(options);
  return { ...limits, maxDepth: maxStructuralDepth, maxConditions: limits.maxNodes };
}
export function filterFields(fields: readonly FilterField[]): readonly FilterField[] {
  if (!Array.isArray(fields)) throw new Error('Fields must be an array');
  const keys = new Set<string>();
  return Object.freeze(
    fields.map((field: FilterField) => {
      if (
        !field ||
        typeof field.key !== 'string' ||
        !field.key ||
        unsafe.has(field.key) ||
        keys.has(field.key) ||
        typeof field.label !== 'string' ||
        !Object.hasOwn(byType, field.type)
      )
        throw new Error('Invalid or duplicate filter field');
      keys.add(field.key);
      const values = new Set<string>();
      const options = field.options?.map((option) => {
        if (
          typeof option.value !== 'string' ||
          typeof option.label !== 'string' ||
          values.has(option.value)
        )
          throw new Error('Invalid enum options');
        values.add(option.value);
        return Object.freeze({ ...option });
      });
      if (field.type === 'enum' && !options?.length) throw new Error('Enum fields need options');
      return Object.freeze({ ...field, options: options ? Object.freeze(options) : undefined });
    }),
  );
}
export function operatorsFor(field: FilterField): readonly FilterOperator[] {
  return byType[field.type] ?? [];
}
const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
function read(object: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor) return undefined;
  // Aurelia replaces observed data properties with own accessors.
  return 'value' in descriptor ? descriptor.value : Reflect.get(object, key);
}
/** Structural copy only; incomplete editor conditions are retained for validation. */
export function copyFilter(input: unknown, options: Partial<FilterLimits> = {}): FilterDocument {
  const limits = filterLimits(options);
  if (!plain(input) || read(input, 'version') !== 1) throw new Error('Unsupported filter document');
  const seen = new Set<object>(),
    ids = new Set<string>();
  let nodes = 0,
    conditions = 0;
  const text = (value: unknown): string => {
    if (typeof value !== 'string' || value.length > limits.maxTextLength)
      throw new Error('Invalid filter text');
    return value;
  };
  const items = (array: unknown[], max: number, message: string): unknown[] => {
    if (array.length > max) throw new Error(message);
    const list: unknown[] = [];
    for (let i = 0; i < array.length; i++) {
      if (!Object.hasOwn(array, i)) throw new Error('Sparse filter arrays are not supported');
      list.push(read(array as unknown as Record<string, unknown>, String(i)));
    }
    return list;
  };
  const visit = (value: unknown, depth: number): FilterNode => {
    if (++nodes > limits.maxNodes || depth > limits.maxDepth)
      throw new Error('Filter exceeds limits');
    if (!plain(value) || seen.has(value)) throw new Error('Invalid or cyclic filter node');
    seen.add(value);
    const id = text(read(value, 'id'));
    if (!id || ids.has(id)) throw new Error('Filter IDs must be nonempty and unique');
    ids.add(id);
    if (read(value, 'kind') === 'group') {
      const combinator = read(value, 'combinator');
      const children = read(value, 'children');
      if (!['all', 'any', 'none'].includes(combinator as string) || !Array.isArray(children))
        throw new Error('Invalid filter group or node limit');
      const list = items(children, limits.maxNodes - nodes, 'Invalid filter group or node limit');
      return {
        kind: 'group',
        id,
        combinator: combinator as FilterGroup['combinator'],
        children: list.map((child) => visit(child, depth + 1)),
      };
    }
    if (read(value, 'kind') !== 'condition' || ++conditions > limits.maxConditions)
      throw new Error('Invalid filter condition or condition limit');
    const field = text(read(value, 'field')),
      operator = text(read(value, 'operator')) as FilterOperator;
    if (unsafe.has(field)) throw new Error('Unsafe filter field');
    const raw = read(value, 'value');
    let copied: unknown;
    const scalar = (v: unknown) => {
      if (typeof v === 'string') return text(v);
      if (
        (typeof v === 'number' && Number.isFinite(v)) ||
        typeof v === 'boolean' ||
        v === undefined ||
        v === null
      )
        return v;
      throw new Error('Filter values must be finite scalars or scalar arrays');
    };
    if (Array.isArray(raw))
      copied = items(raw, limits.maxValues, 'Filter value list exceeds limits').map(scalar);
    else copied = scalar(raw);
    return {
      kind: 'condition',
      id,
      field,
      operator,
      ...(copied === undefined ? {} : { value: copied }),
    };
  };
  const root = visit(read(input, 'root'), 0);
  if (root.kind !== 'group') throw new Error('Filter root must be a group');
  return { version: 1, root };
}
function date(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
const empty = (value: unknown) => value === undefined || value === null || value === '';
function valueFits(value: unknown, field: FilterField): boolean {
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (field.type === 'boolean') return typeof value === 'boolean';
  if (field.type === 'date') return date(value);
  if (field.type === 'enum') return field.options!.some((option) => option.value === value);
  return typeof value === 'string';
}
function limitIssues(doc: FilterDocument, limits: FilterLimits): FilterIssue[] {
  const issues: FilterIssue[] = [];
  let conditions = 0;
  const walk = (node: FilterNode, depth: number, reported: boolean) => {
    if (!reported && depth > limits.maxDepth) {
      reported = true;
      issues.push({
        id: node.id,
        code: 'depth-limit',
        message: `Nest filters at most ${limits.maxDepth} levels deep; remove or move this item`,
      });
    }
    if (node.kind === 'condition') conditions++;
    else node.children.forEach((child) => walk(child, depth + 1, reported));
  };
  walk(doc.root, 0, false);
  if (conditions > limits.maxConditions)
    issues.push({
      id: doc.root.id,
      code: 'condition-limit',
      message: `Use at most ${limits.maxConditions} conditions; remove ${conditions - limits.maxConditions}`,
    });
  return issues;
}
function issuesFor(doc: FilterDocument, fields: readonly FilterField[]): FilterIssue[] {
  const map = new Map(fields.map((field) => [field.key, field]));
  const issues: FilterIssue[] = [];
  const walk = (node: FilterNode, isRoot = false) => {
    if (node.kind === 'group') {
      if (!isRoot && !node.children.length)
        issues.push({
          id: node.id,
          code: 'empty-group',
          message: 'Add a condition to this group or remove it',
        });
      node.children.forEach((child) => walk(child));
      return;
    }
    const field = map.get(node.field);
    const error = (code: string, message: string) => issues.push({ id: node.id, code, message });
    if (!field) return error('unknown-field', 'Choose an available field');
    if (!operatorsFor(field).includes(node.operator))
      return error('invalid-operator', 'Choose an operator for this field');
    if (node.operator === 'is-empty' || node.operator === 'is-not-empty') return;
    if (node.operator === 'between') {
      if (
        !Array.isArray(node.value) ||
        node.value.length !== 2 ||
        !node.value.every((value) => valueFits(value, field)) ||
        node.value[0] > node.value[1]
      )
        error('invalid-value', 'Enter an ordered pair of bounds');
    } else if (node.operator === 'any-of' || node.operator === 'none-of') {
      if (
        !Array.isArray(node.value) ||
        !node.value.length ||
        !node.value.every((value) => valueFits(value, field))
      )
        error('invalid-value', 'Choose at least one allowed value');
    } else if (!valueFits(node.value, field))
      error('invalid-value', 'Enter a value matching the field type');
  };
  walk(doc.root, true);
  return issues;
}
export function parseFilter(
  input: unknown,
  fields: readonly FilterField[],
  options: Partial<FilterLimits> = {},
): { filter: FilterDocument | null; issues: FilterIssue[] } {
  const definitions = filterFields(fields);
  try {
    const limits = filterLimits(options);
    if (
      typeof input === 'string' &&
      input.length > Math.min(4000000, limits.maxNodes * limits.maxTextLength)
    )
      throw new Error('Filter document exceeds text budget');
    const filter = copyFilter(
      typeof input === 'string' ? JSON.parse(input) : input,
      structuralLimits(limits),
    );
    const issues = [...limitIssues(filter, limits), ...issuesFor(filter, definitions)];
    return { filter: issues.length ? null : filter, issues };
  } catch (error) {
    return {
      filter: null,
      issues: [
        {
          code: 'invalid-document',
          message: error instanceof Error ? error.message : 'Invalid filter',
        },
      ],
    };
  }
}
export function validateFilter(
  input: unknown,
  fields: readonly FilterField[],
  options: Partial<FilterLimits> = {},
): FilterIssue[] {
  return parseFilter(input, fields, options).issues;
}
export function compileFilter(
  input: unknown,
  fields: readonly FilterField[],
  options: Partial<FilterLimits> = {},
): (record: Record<string, unknown>) => boolean {
  const definitions = filterFields(fields),
    parsed = parseFilter(input, definitions, options);
  if (!parsed.filter) throw new Error(parsed.issues.map((issue) => issue.message).join('; '));
  const map = new Map(definitions.map((field) => [field.key, field]));
  const compile = (node: FilterNode): ((record: Record<string, unknown>) => boolean) => {
    if (node.kind === 'group') {
      const children = node.children.map(compile);
      if (!children.length) return () => true;
      return node.combinator === 'all'
        ? (record) => children.every((test) => test(record))
        : node.combinator === 'any'
          ? (record) => children.some((test) => test(record))
          : (record) => !children.some((test) => test(record));
    }
    const field = map.get(node.field)!;
    return (record) => {
      const descriptor =
        record && typeof record === 'object'
          ? Object.getOwnPropertyDescriptor(record, node.field)
          : undefined;
      let value: unknown;
      try {
        value = descriptor
          ? 'value' in descriptor
            ? descriptor.value
            : Reflect.get(record, node.field)
          : undefined;
      } catch {
        return false;
      }
      if (node.operator === 'is-empty') return empty(value);
      if (node.operator === 'is-not-empty') return !empty(value);
      if (!valueFits(value, field)) return false;
      const comparable = value as number | string;
      switch (node.operator) {
        case 'eq':
          return value === node.value;
        case 'neq':
          return value !== node.value;
        case 'contains':
          return (value as string).includes(node.value as string);
        case 'starts-with':
          return (value as string).startsWith(node.value as string);
        case 'ends-with':
          return (value as string).endsWith(node.value as string);
        case 'lt':
          return comparable < (node.value as number | string);
        case 'lte':
          return comparable <= (node.value as number | string);
        case 'gt':
          return comparable > (node.value as number | string);
        case 'gte':
          return comparable >= (node.value as number | string);
        case 'between':
          return (
            comparable >= (node.value as (number | string)[])[0] &&
            comparable <= (node.value as (number | string)[])[1]
          );
        case 'any-of':
          return (node.value as string[]).includes(value as string);
        case 'none-of':
          return !(node.value as string[]).includes(value as string);
        default:
          return false;
      }
    };
  };
  return compile(parsed.filter.root);
}
export function describeFilter(
  input: unknown,
  fields: readonly FilterField[],
  options: Partial<FilterLimits> = {},
): string {
  const parsed = parseFilter(input, fields, options);
  if (!parsed.filter) return parsed.issues.map((issue) => issue.message).join('; ');
  const map = new Map(fields.map((field) => [field.key, field.label]));
  const describe = (node: FilterNode): string =>
    node.kind === 'condition'
      ? `${map.get(node.field)} ${node.operator}${node.value === undefined ? '' : ' ' + JSON.stringify(node.value)}`
      : node.children.length
        ? `${node.combinator} (${node.children.map(describe).join('; ')})`
        : 'All records';
  return describe(parsed.filter.root);
}
