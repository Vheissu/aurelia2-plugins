import { param } from '../src/index';

// Mirrors the aurelia2-filter-builder document contract (`parseFilter(json) => { filter, issues }`)
// so the custom param can be tested without importing that package.
export type FilterCondition = {
  kind: 'condition';
  id: string;
  field: string;
  operator: string;
  value?: unknown;
};
export type FilterGroup = {
  kind: 'group';
  id: string;
  combinator: 'all' | 'any' | 'none';
  children: FilterNode[];
};
export type FilterNode = FilterGroup | FilterCondition;
export type FilterDocument = { version: 1; root: FilterGroup };

const reserved = new Set(['__proto__', 'constructor', 'prototype']);
const isPlain = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
const text = (value: unknown) =>
  typeof value === 'string' && value.length > 0 && value.length <= 200;

export function parseFilter(
  json: unknown,
  limits = { depth: 4, nodes: 40 },
): { filter: FilterDocument | null; issues: string[] } {
  const issues: string[] = [];
  if (!isPlain(json) || json.version !== 1 || !isPlain(json.root))
    return { filter: null, issues: ['not a filter document'] };
  const stack: { node: unknown; depth: number }[] = [{ node: json.root, depth: 1 }];
  let count = 0;
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (!isPlain(node) || Object.keys(node).some((key) => reserved.has(key)))
      issues.push('invalid node');
    else if (++count > limits.nodes) issues.push('too many nodes');
    else if (node.kind === 'group') {
      if (depth > limits.depth) issues.push('too deep');
      else if (
        !text(node.id) ||
        !['all', 'any', 'none'].includes(node.combinator as string) ||
        !Array.isArray(node.children)
      )
        issues.push('invalid group');
      else for (const child of node.children) stack.push({ node: child, depth: depth + 1 });
    } else if (
      node.kind !== 'condition' ||
      !text(node.id) ||
      !text(node.field) ||
      !text(node.operator)
    )
      issues.push('invalid condition');
    else if (
      node.value !== undefined &&
      typeof node.value === 'object' &&
      node.value !== null &&
      !Array.isArray(node.value)
    )
      issues.push('invalid value');
    if (issues.length > 0) break;
  }
  if (Object.keys(json).some((key) => reserved.has(key))) issues.push('invalid document');
  return issues.length > 0 ? { filter: null, issues } : { filter: json as FilterDocument, issues };
}

export const filterParam = param.custom<FilterDocument>({
  default: null,
  maxLength: 1500,
  parse: (raw) => parseFilter(JSON.parse(raw)).filter ?? undefined,
  serialize: (doc) => JSON.stringify(doc),
  validate: (value): value is FilterDocument => parseFilter(value).filter !== null,
});

export const sampleFilter = (): FilterDocument => ({
  version: 1,
  root: {
    kind: 'group',
    id: 'root',
    combinator: 'all',
    children: [
      {
        kind: 'condition',
        id: 'c1',
        field: 'plan',
        operator: 'any-of',
        value: ['pro', 'enterprise'],
      },
      { kind: 'condition', id: 'c2', field: 'seats', operator: 'gte', value: 10 },
      {
        kind: 'group',
        id: 'g1',
        combinator: 'none',
        children: [{ kind: 'condition', id: 'c3', field: 'country', operator: 'eq', value: 'NZ' }],
      },
    ],
  },
});
