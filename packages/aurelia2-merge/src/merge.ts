export type MergeValue = null | undefined | string | number | boolean | MergeValue[] | MergeRecord;
export interface MergeRecord {
  [key: string]: MergeValue;
}
export interface MergeLimits {
  maxDepth: number;
  maxNodes: number;
}
export interface MergeSide {
  readonly present: boolean;
  readonly value: MergeValue;
}
export interface MergeConflict {
  readonly id: string;
  readonly path: readonly string[];
  readonly kind: 'both-added' | 'both-modified' | 'modified-deleted' | 'deleted-modified';
  readonly base: MergeSide;
  readonly mine: MergeSide;
  readonly theirs: MergeSide;
}
export type MergeChoice =
  { choice: 'base' | 'mine' | 'theirs' | 'delete' } | { choice: 'custom'; value: MergeValue };
/** A recorded resolution: the chosen option and the frozen side it selects. */
export interface MergeDecision extends MergeSide {
  readonly choice: MergeChoice['choice'];
}
export interface MergePlan {
  merged: MergeRecord;
  conflicts: readonly MergeConflict[];
  changes: readonly (readonly string[])[];
}
const unsafe = new Set(['__proto__', 'constructor', 'prototype']);
const defaults: MergeLimits = { maxDepth: 64, maxNodes: 10000 };

/** Copy data before comparing or exposing it. Observed own properties are supported; executable values and class instances are not. */
export function copyMergeValue(value: MergeValue, options: Partial<MergeLimits> = {}): MergeValue {
  const limits = { ...defaults, ...options };
  if (
    !Number.isInteger(limits.maxDepth) ||
    limits.maxDepth < 1 ||
    limits.maxDepth > 128 ||
    !Number.isInteger(limits.maxNodes) ||
    limits.maxNodes < 1
  )
    throw new Error('Invalid merge limits');
  let nodes = 0;
  const ancestors = new Set<object>();
  const copy = (input: unknown, depth: number): MergeValue => {
    if (++nodes > limits.maxNodes || depth > limits.maxDepth)
      throw new Error('Merge input exceeds limits');
    if (
      input === null ||
      input === undefined ||
      typeof input === 'string' ||
      typeof input === 'boolean'
    )
      return input;
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    if (typeof input !== 'object') throw new TypeError('Merge values must be plain data');
    if (ancestors.has(input)) throw new TypeError('Cyclic merge input');
    const array = Array.isArray(input);
    if (
      !array &&
      Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null
    )
      throw new TypeError('Merge values must be plain records');
    if (Object.getOwnPropertySymbols(input).length)
      throw new TypeError('Symbol keys are not supported');
    ancestors.add(input);
    const result: MergeValue[] | MergeRecord = array ? [] : {};
    if (array && input.length > limits.maxNodes - nodes)
      throw new Error('Merge input exceeds limits');
    const keys = array
      ? Array.from({ length: input.length }, (_, i) => String(i))
      : Object.keys(input);
    if (keys.length > limits.maxNodes - nodes) throw new Error('Merge input exceeds limits');
    for (const key of keys) {
      if (unsafe.has(key)) throw new TypeError('Unsafe merge key');
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor) throw new TypeError('Sparse arrays are not supported');
      const next = copy(
        'value' in descriptor ? descriptor.value : Reflect.get(input, key),
        depth + 1,
      );
      if (array) (result as MergeValue[]).push(next);
      else (result as MergeRecord)[key] = next;
    }
    ancestors.delete(input);
    return result;
  };
  return copy(value, 0);
}
function record(value: MergeValue): value is MergeRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function equal(a: MergeValue, b: MergeValue): boolean {
  // Values are finite, so strict equality only differs from Object.is by treating -0 as 0.
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if (!record(a) || !record(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]))
  );
}
const side = (parent: MergeRecord, key: string): MergeSide => ({
  present: Object.hasOwn(parent, key),
  value: parent[key],
});
const same = (a: MergeSide, b: MergeSide) =>
  a.present === b.present && (!a.present || equal(a.value, b.value));
function freeze(value: MergeValue): MergeValue {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

/** Arrays and scalar fields are atomic; nested records merge field by field. */
export function mergeRecords(
  base: MergeRecord,
  mine: MergeRecord,
  theirs: MergeRecord,
  limits: Partial<MergeLimits> = {},
): MergePlan {
  const inputs = [base, mine, theirs].map((value) => copyMergeValue(value, limits));
  if (!inputs.every(record)) throw new TypeError('Merge roots must be records');
  const conflicts: MergeConflict[] = [];
  const changes: string[][] = [];
  const merge = (b: MergeRecord, m: MergeRecord, t: MergeRecord, path: string[]): MergeRecord => {
    const result: MergeRecord = {};
    for (const key of new Set([...Object.keys(m), ...Object.keys(t), ...Object.keys(b)])) {
      const p = [...path, key];
      const bs = side(b, key),
        ms = side(m, key),
        ts = side(t, key);
      let chosen: MergeSide;
      let conflicted = false;
      if (same(ms, ts)) chosen = ms;
      else if (same(ms, bs)) chosen = ts;
      else if (same(ts, bs)) chosen = ms;
      else if (
        ms.present &&
        ts.present &&
        record(ms.value) &&
        record(ts.value) &&
        (!bs.present || record(bs.value))
      ) {
        result[key] = merge(bs.present ? (bs.value as MergeRecord) : {}, ms.value, ts.value, p);
        continue;
      } else {
        conflicted = true;
        conflicts.push(
          Object.freeze({
            id: JSON.stringify(p),
            path: Object.freeze(p),
            kind: !bs.present
              ? 'both-added'
              : !ms.present
                ? 'deleted-modified'
                : !ts.present
                  ? 'modified-deleted'
                  : 'both-modified',
            base: Object.freeze({ ...bs, value: freeze(bs.value) }),
            mine: Object.freeze({ ...ms, value: freeze(ms.value) }),
            theirs: Object.freeze({ ...ts, value: freeze(ts.value) }),
          }),
        );
        chosen = ms;
      }
      if (chosen.present) result[key] = chosen.value;
      if (!conflicted && !same(chosen, bs)) changes.push(p);
    }
    return result;
  };
  const merged = merge(
    inputs[0] as MergeRecord,
    inputs[1] as MergeRecord,
    inputs[2] as MergeRecord,
    [],
  );
  return {
    merged: copyMergeValue(merged, {
      ...limits,
      maxNodes: Math.max((limits.maxNodes ?? defaults.maxNodes) * 3, 1),
    }) as MergeRecord,
    conflicts: Object.freeze(conflicts),
    changes: Object.freeze(changes.map((path) => Object.freeze(path))),
  };
}

export class MergeSession {
  readonly conflicts: readonly MergeConflict[];
  readonly changes: readonly (readonly string[])[];
  private readonly merged: MergeRecord;
  private choices: ReadonlyMap<string, MergeDecision> = new Map();
  private version = 0;
  constructor(
    base: MergeRecord,
    mine: MergeRecord,
    theirs: MergeRecord,
    private readonly limits: Partial<MergeLimits> = {},
  ) {
    this.limits = { ...limits };
    const plan = mergeRecords(base, mine, theirs, this.limits);
    this.merged = plan.merged;
    this.conflicts = plan.conflicts;
    this.changes = plan.changes;
  }
  get unresolvedCount(): number {
    return this.conflicts.length - this.choices.size;
  }
  get revision(): number {
    return this.version;
  }
  get isComplete(): boolean {
    return this.unresolvedCount === 0;
  }
  isResolved(id: string): boolean {
    return this.choices.has(id);
  }
  decision(id: string): MergeDecision | undefined {
    return this.choices.get(id);
  }
  resolve(id: string, decision: MergeChoice): void {
    const conflict = this.conflicts.find((c) => c.id === id);
    if (!conflict) throw new Error('Unknown merge conflict');
    let selected: MergeSide;
    if (decision.choice === 'custom')
      selected = { present: true, value: freeze(copyMergeValue(decision.value, this.limits)) };
    else if (decision.choice === 'delete') selected = { present: false, value: undefined };
    else if (['base', 'mine', 'theirs'].includes(decision.choice))
      selected = conflict[decision.choice];
    else throw new Error('Invalid merge choice');
    this.choices = new Map(this.choices).set(
      id,
      Object.freeze({ choice: decision.choice, present: selected.present, value: selected.value }),
    );
    this.version++;
  }
  clear(id: string): void {
    if (!this.choices.has(id)) return;
    const choices = new Map(this.choices);
    choices.delete(id);
    this.choices = choices;
    this.version++;
  }
  result(): MergeRecord {
    if (!this.isComplete) throw new Error('Resolve all merge conflicts before applying');
    const result = copyMergeValue(this.merged, {
      ...this.limits,
      maxNodes: (this.limits.maxNodes ?? defaults.maxNodes) * 3,
    }) as MergeRecord;
    for (const conflict of this.conflicts) {
      const selected = this.choices.get(conflict.id)!;
      let parent = result;
      for (const part of conflict.path.slice(0, -1)) parent = parent[part] as MergeRecord;
      const key = conflict.path[conflict.path.length - 1];
      if (selected.present) parent[key] = copyMergeValue(selected.value, this.limits);
      else delete parent[key];
    }
    return result;
  }
}

export interface LineDiff {
  type: 'equal' | 'remove' | 'add' | 'replace';
  before?: string;
  after?: string;
}
/** Bounded line comparison; falls back to a whole-text replacement above maxCells. */
export function diffLines(before: string, after: string, maxCells = 250000): LineDiff[] {
  if (!Number.isInteger(maxCells) || maxCells < 1 || maxCells > 1000000)
    throw new Error('Invalid line diff budget');
  if (before === after) return [{ type: 'equal', before, after }];
  const a = before.split('\n'),
    b = after.split('\n');
  if ((a.length + 1) * (b.length + 1) > maxCells) return [{ type: 'replace', before, after }];
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
  const operations: LineDiff[] = [];
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j])
      operations.push({ type: 'equal', before: a[i++], after: b[j++] });
    else if (
      j < b.length &&
      (i === a.length || table[i * width + j + 1] >= table[(i + 1) * width + j])
    )
      operations.push({ type: 'add', after: b[j++] });
    else operations.push({ type: 'remove', before: a[i++] });
  }
  return operations;
}
