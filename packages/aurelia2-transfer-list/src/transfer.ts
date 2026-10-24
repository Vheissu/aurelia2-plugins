export type TransferKey = string | number;
export type TransferDirection = 'add' | 'remove' | 'reorder';
export interface TransferChange<K extends TransferKey = TransferKey> {
  /** The proposed (before-change) or committed (change) key array. */
  value: K[];
  previous: K[];
  /** Keys added, removed or reordered, in list order. */
  moved: K[];
  direction: TransferDirection;
}
export interface TransferLimit {
  /** Maximum number of keys; `null` or `undefined` means no limit. */
  max?: number | null;
}

export function isTransferKey(key: unknown): key is TransferKey {
  return (
    (typeof key === 'string' && key !== '') || (typeof key === 'number' && Number.isFinite(key))
  );
}

function validateKeys(value: readonly TransferKey[]): void {
  if (
    !Array.isArray(value) ||
    value.some((key) => !isTransferKey(key)) ||
    Object.keys(value).length !== value.length ||
    new Set(value).size !== value.length
  )
    throw new TypeError(
      'Transfer keys must be a dense array of unique non-empty strings or finite numbers',
    );
}

/**
 * Return a new key array with `keys` appended (`add`, skipping keys already present) or
 * removed (`remove`). Adding past `max` throws a `RangeError` and nothing is added.
 */
export function transfer<K extends TransferKey>(
  value: readonly K[],
  keys: readonly K[],
  direction: 'add' | 'remove',
  { max }: TransferLimit = {},
): K[] {
  validateKeys(value);
  validateKeys(keys);
  if (max != null && (!Number.isInteger(max) || max < 0))
    throw new RangeError('max must be a non-negative integer');
  if (direction === 'remove') {
    const removed = new Set(keys);
    return value.filter((key) => !removed.has(key));
  }
  if (direction !== 'add') throw new TypeError(`Unknown transfer direction: ${String(direction)}`);
  const present = new Set(value);
  const added = keys.filter((key) => !present.has(key) && present.add(key));
  if (max != null && added.length && value.length + added.length > max)
    throw new RangeError(`A transfer list allows at most ${max} keys`);
  return [...value, ...added];
}

/**
 * Return a new key array with every key in `keys` moved one place up (`-1`) or down (`1`).
 * Adjacent selected keys move as a block; a block already at the edge stays put.
 */
export function reorderKeys<K extends TransferKey>(
  value: readonly K[],
  keys: readonly K[],
  offset: -1 | 1,
): K[] {
  validateKeys(value);
  validateKeys(keys);
  if (offset !== -1 && offset !== 1) throw new RangeError('offset must be -1 or 1');
  const moving = new Set(keys);
  const next = [...value];
  const swap = (a: number, b: number) => ([next[a], next[b]] = [next[b], next[a]]);
  if (offset < 0) {
    for (let i = 1; i < next.length; i++)
      if (moving.has(next[i]) && !moving.has(next[i - 1])) swap(i, i - 1);
  } else {
    for (let i = next.length - 2; i >= 0; i--)
      if (moving.has(next[i]) && !moving.has(next[i + 1])) swap(i, i + 1);
  }
  return next;
}

export const sameKeys = (a: readonly TransferKey[], b: readonly TransferKey[]) =>
  a.length === b.length && a.every((key, index) => key === b[index]);
