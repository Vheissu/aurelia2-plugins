export type HistoryMode = 'push' | 'replace';

export type ParseResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

export interface ParamOptions<T> {
  /** Value used when the key is missing or invalid. Defaults to the model value at connect time. */
  default?: T;
  /** Milliseconds to wait after the last change before writing. Defaults to 0. */
  debounce?: number;
  /** History entry policy for model changes. Corrections always replace. Defaults to `'replace'`. */
  history?: HistoryMode;
  /** Query key. Defaults to the model property name. */
  key?: string;
}

export interface ResolvedParamOptions<T> {
  readonly hasDefault: boolean;
  readonly default: T | undefined;
  readonly debounce: number;
  readonly history: HistoryMode;
  readonly key: string | undefined;
}

/**
 * A typed query parameter. Create one with the `param` builders; objects that were not created by
 * a builder are rejected by `connect`.
 */
export interface UrlParam<T> {
  readonly kind: string;
  readonly options: ResolvedParamOptions<T>;
  /** Parse every value of the key, in URL order. Never throws. */
  parse(values: readonly string[]): ParseResult<T>;
  /** Serialize a valid value. Throws `UrlStateCodecError` for values that cannot be represented. */
  serialize(value: T): string[];
  /** Whether a model value can be serialized. */
  validate(value: unknown): value is T;
  equals(a: T, b: T): boolean;
  clone(value: T): T;
}

export class UrlStateCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlStateCodecError';
  }
}

const params = new WeakSet<object>();
export function isUrlParam(value: unknown): value is UrlParam<unknown> {
  return typeof value === 'object' && value !== null && params.has(value);
}

/** Property names and query keys that can never be owned. */
export const RESERVED_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);
export const MAX_KEY_LENGTH = 100;

const invalid = (reason: string): ParseResult<never> => ({ ok: false, reason });
const valid = <T>(value: T): ParseResult<T> => ({ ok: true, value });
const isDate = (value: unknown): value is Date =>
  Object.prototype.toString.call(value) === '[object Date]' &&
  Number.isFinite((value as Date).getTime());

interface Scalar<T> {
  kind: string;
  read(raw: string): ParseResult<T>;
  write(value: T): string;
  validate(value: unknown): value is T;
  equals?(a: T, b: T): boolean;
  clone?(value: T): T;
}

function resolveOptions<T>(kind: string, options: ParamOptions<T>): ResolvedParamOptions<T> {
  const { debounce = 0, history = 'replace', key } = options;
  if (!Number.isFinite(debounce) || debounce < 0)
    throw new TypeError(`url-state: ${kind} debounce must be a non-negative number`);
  if (history !== 'push' && history !== 'replace')
    throw new TypeError(`url-state: ${kind} history must be "push" or "replace"`);
  if (key !== undefined) assertKey(key, 'query key');
  return Object.freeze({
    hasDefault:
      Object.prototype.hasOwnProperty.call(options, 'default') && options.default !== undefined,
    default: options.default,
    debounce,
    history,
    key,
  });
}

export function assertKey(key: unknown, label: string): asserts key is string {
  if (typeof key !== 'string' || key.length === 0 || key.length > MAX_KEY_LENGTH)
    throw new TypeError(`url-state: ${label} must be a string of 1-${MAX_KEY_LENGTH} characters`);
  if (RESERVED_KEYS.has(key)) throw new TypeError(`url-state: ${label} "${key}" is reserved`);
}

function define<T>(param: UrlParam<T>): UrlParam<T> {
  const { options } = param;
  if (options.hasDefault && options.default !== null && !param.validate(options.default))
    throw new TypeError(`url-state: the default for ${param.kind} is not a valid value`);
  if (options.hasDefault && options.default !== null)
    (options as { default: T }).default = param.clone(options.default as T);
  Object.freeze(options);
  Object.freeze(param);
  params.add(param);
  return param;
}

interface ScalarParam<T> extends UrlParam<T> {
  readonly scalar: Scalar<T>;
}

function scalarParam<T>(scalar: Scalar<T>, options: ParamOptions<T>): ScalarParam<T> {
  const equals = scalar.equals ?? ((a: T, b: T) => a === b);
  const clone = scalar.clone ?? ((value: T) => value);
  const resolved = { ...resolveOptions(scalar.kind, options) };
  return define({
    kind: scalar.kind,
    scalar,
    options: resolved,
    parse(values) {
      if (values.length === 0) return invalid('missing');
      return scalar.read(values[0]);
    },
    serialize(value) {
      if (!scalar.validate(value))
        throw new UrlStateCodecError(`url-state: invalid ${scalar.kind} value`);
      return [scalar.write(value)];
    },
    validate: (value): value is T => scalar.validate(value),
    equals,
    clone,
  } as ScalarParam<T>) as ScalarParam<T>;
}

type Nullable<O, T> = O extends { default: null } ? T | null : T;

export interface StringParamOptions extends ParamOptions<string | null> {
  /** Longest accepted value. Defaults to 1000. */
  maxLength?: number;
}
export interface NumberParamOptions extends ParamOptions<number | null> {
  min?: number;
  max?: number;
}
export interface DateParamOptions extends ParamOptions<Date | null> {
  min?: Date;
  max?: Date;
}
export interface ListParamOptions<T> extends ParamOptions<T[]> {
  /** Most items kept from the URL. Defaults to 50. */
  maxItems?: number;
}
export interface CustomParamDefinition<T> extends ParamOptions<T | null> {
  /** Parse one raw value. Return `undefined` (or throw) to reject it. */
  parse(raw: string): T | undefined;
  /** Serialize a value to one string. */
  serialize(value: T): string;
  /** Check model values before they are serialized. */
  validate?(value: unknown): value is T;
  /** Defaults to comparing serialized strings. */
  equals?(a: T, b: T): boolean;
  /** Defaults to `parse(serialize(value))`. */
  clone?(value: T): T;
  /** Longest raw or serialized value. Defaults to 2000. */
  maxLength?: number;
}

function limit(value: number | undefined, fallback: number, label: string): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1)
    throw new TypeError(`url-state: ${label} must be a positive integer`);
  return result;
}

function range(kind: string, min: number | undefined, max: number | undefined) {
  if (min !== undefined && !Number.isFinite(min))
    throw new TypeError(`url-state: ${kind} min must be finite`);
  if (max !== undefined && !Number.isFinite(max))
    throw new TypeError(`url-state: ${kind} max must be finite`);
  if (min !== undefined && max !== undefined && min > max)
    throw new TypeError(`url-state: ${kind} min exceeds max`);
  return (value: number) =>
    (min === undefined || value >= min) && (max === undefined || value <= max);
}

const INT = /^-?\d{1,16}$/;
const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d{1,3})?$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const pad = (value: number, length = 2) => String(value).padStart(length, '0');

function day(value: Date): string {
  return `${pad(value.getUTCFullYear(), 4)}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

function dateParam(kind: 'date' | 'datetime', options: DateParamOptions) {
  const { min, max } = options;
  if ((min !== undefined && !isDate(min)) || (max !== undefined && !isDate(max)))
    throw new TypeError(`url-state: ${kind} min and max must be valid dates`);
  const inRange = range(kind, min?.getTime(), max?.getTime());
  const representable = (value: Date) => {
    const year = value.getUTCFullYear();
    return year >= 0 && year <= 9999 && inRange(value.getTime());
  };
  const format = kind === 'date' ? day : (value: Date) => value.toISOString();
  return scalarParam<Date>(
    {
      kind,
      read(raw) {
        let value: Date;
        if (kind === 'date') {
          const match = DAY.exec(raw);
          if (!match) return invalid('format');
          value = new Date(0);
          value.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
          if (day(value) !== raw) return invalid('calendar');
        } else {
          if (!INSTANT.test(raw)) return invalid('format');
          value = new Date(raw);
        }
        return isDate(value) && representable(value) ? valid(value) : invalid('range');
      },
      write: format,
      validate: (value): value is Date => isDate(value) && representable(value),
      equals: (a, b) => format(a) === format(b),
      clone: (value) => new Date(value.getTime()),
    },
    options as ParamOptions<Date>,
  );
}

function custom<T>(
  definition: CustomParamDefinition<T>,
): UrlParam<Nullable<CustomParamDefinition<T>, T>> {
  const { parse, serialize } = definition;
  if (typeof parse !== 'function' || typeof serialize !== 'function')
    throw new TypeError('url-state: custom params need parse and serialize functions');
  const maxLength = limit(definition.maxLength, 2000, 'custom maxLength');
  const check = definition.validate;
  const write = (value: T): string => {
    let raw: unknown;
    try {
      raw = serialize(value);
    } catch (error) {
      throw new UrlStateCodecError(`url-state: custom serialize threw: ${describe(error)}`);
    }
    if (typeof raw !== 'string')
      throw new UrlStateCodecError('url-state: custom serialize must return a string');
    if (raw.length > maxLength)
      throw new UrlStateCodecError(`url-state: custom value exceeds ${maxLength} characters`);
    return raw;
  };
  const read = (raw: string): ParseResult<T> => {
    if (raw.length > maxLength) return invalid('length');
    let value: T | undefined;
    try {
      value = parse(raw);
    } catch {
      return invalid('parse');
    }
    if (value === undefined) return invalid('parse');
    if (check) {
      try {
        if (!check(value)) return invalid('validate');
      } catch {
        return invalid('validate');
      }
    }
    return valid(value);
  };
  const validate = (value: unknown): value is T => {
    if (value === undefined || value === null) return false;
    try {
      return check ? check(value) : true;
    } catch {
      return false;
    }
  };
  const encodeOrNull = (value: T) => {
    try {
      return write(value);
    } catch {
      return null;
    }
  };
  return scalarParam<T>(
    {
      kind: 'custom',
      read,
      write,
      validate,
      equals(a, b) {
        if (definition.equals) return definition.equals(a, b);
        const left = encodeOrNull(a);
        return left !== null ? left === encodeOrNull(b) : Object.is(a, b);
      },
      clone(value) {
        if (definition.clone) return definition.clone(value);
        const raw = encodeOrNull(value);
        const copy = raw === null ? null : read(raw);
        return copy?.ok ? copy.value : value;
      },
    },
    definition as ParamOptions<T>,
  ) as UrlParam<Nullable<CustomParamDefinition<T>, T>>;
}

export function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const param = Object.freeze({
  string<O extends StringParamOptions>(options: O = {} as O): UrlParam<Nullable<O, string>> {
    const maxLength = limit(options.maxLength, 1000, 'string maxLength');
    return scalarParam<string>(
      {
        kind: 'string',
        read: (raw) => (raw.length <= maxLength ? valid(raw) : invalid('length')),
        write: (value) => value,
        validate: (value): value is string =>
          typeof value === 'string' && value.length <= maxLength,
      },
      options as ParamOptions<string>,
    ) as UrlParam<Nullable<O, string>>;
  },

  int<O extends NumberParamOptions>(options: O = {} as O): UrlParam<Nullable<O, number>> {
    const inRange = range('int', options.min, options.max);
    const ok = (value: unknown): value is number =>
      Number.isSafeInteger(value) && inRange(value as number);
    return scalarParam<number>(
      {
        kind: 'int',
        read(raw) {
          if (!INT.test(raw)) return invalid('format');
          const value = Number(raw);
          return ok(value) ? valid(value) : invalid('range');
        },
        write: (value) => String(value),
        validate: ok,
      },
      options as ParamOptions<number>,
    ) as UrlParam<Nullable<O, number>>;
  },

  number<O extends NumberParamOptions>(options: O = {} as O): UrlParam<Nullable<O, number>> {
    const inRange = range('number', options.min, options.max);
    const ok = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value) && inRange(value);
    return scalarParam<number>(
      {
        kind: 'number',
        read(raw) {
          if (raw.length > 32 || !NUMBER.test(raw)) return invalid('format');
          const value = Number(raw);
          return ok(value) ? valid(value) : invalid('range');
        },
        write: (value) => String(value),
        validate: ok,
      },
      options as ParamOptions<number>,
    ) as UrlParam<Nullable<O, number>>;
  },

  boolean<O extends ParamOptions<boolean | null>>(
    options: O = {} as O,
  ): UrlParam<Nullable<O, boolean>> {
    return scalarParam<boolean>(
      {
        kind: 'boolean',
        read: (raw) =>
          raw === 'true' || raw === '1'
            ? valid(true)
            : raw === 'false' || raw === '0'
              ? valid(false)
              : invalid('format'),
        write: (value) => (value ? 'true' : 'false'),
        validate: (value): value is boolean => typeof value === 'boolean',
      },
      options as ParamOptions<boolean>,
    ) as UrlParam<Nullable<O, boolean>>;
  },

  enum<const V extends readonly string[], O extends ParamOptions<V[number] | null>>(
    values: V,
    options: O = {} as O,
  ): UrlParam<Nullable<O, V[number]>> {
    if (!Array.isArray(values) || values.length === 0)
      throw new TypeError('url-state: enum params need at least one value');
    const allowed = new Set<string>();
    for (const value of values) {
      if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.length > 200 ||
        allowed.has(value)
      )
        throw new TypeError('url-state: enum values must be unique non-empty strings');
      allowed.add(value);
    }
    const ok = (value: unknown): value is V[number] =>
      typeof value === 'string' && allowed.has(value);
    return scalarParam<V[number]>(
      {
        kind: 'enum',
        read: (raw) => (ok(raw) ? valid(raw) : invalid('enum')),
        write: (value) => value,
        validate: ok,
      },
      options as ParamOptions<V[number]>,
    ) as UrlParam<Nullable<O, V[number]>>;
  },

  /** Calendar date as `YYYY-MM-DD`, read into a `Date` at UTC midnight (like `input.valueAsDate`). */
  date<O extends DateParamOptions>(options: O = {} as O): UrlParam<Nullable<O, Date>> {
    return dateParam('date', options) as UrlParam<Nullable<O, Date>>;
  },

  /** Instant as an ISO 8601 timestamp with a zone; written with `toISOString()`. */
  datetime<O extends DateParamOptions>(options: O = {} as O): UrlParam<Nullable<O, Date>> {
    return dateParam('datetime', options) as UrlParam<Nullable<O, Date>>;
  },

  /** Repeated keys: `?tags=a&tags=b`. Invalid and empty items are dropped. */
  list<T>(item: UrlParam<T>, options: ListParamOptions<T> = {}): UrlParam<T[]> {
    if (!isUrlParam(item) || !('scalar' in item))
      throw new TypeError('url-state: list items must be a scalar param such as param.string()');
    const itemOptions = item.options;
    if (
      itemOptions.hasDefault ||
      itemOptions.debounce !== 0 ||
      itemOptions.history !== 'replace' ||
      itemOptions.key
    )
      throw new TypeError(
        'url-state: set default, debounce, history and key on the list, not on its item',
      );
    const scalar = (item as ScalarParam<T>).scalar;
    const maxItems = limit(options.maxItems, 50, 'list maxItems');
    const validateList = (value: unknown): value is T[] =>
      Array.isArray(value) &&
      value.length <= maxItems &&
      Array.from(value).every((entry) => scalar.validate(entry));
    return define<T[]>({
      kind: `list<${item.kind}>`,
      options: { ...resolveOptions<T[]>('list', options) },
      parse(values) {
        if (values.length === 0) return invalid('missing');
        const items: T[] = [];
        for (const raw of values) {
          if (raw === '') continue;
          const result = scalar.read(raw);
          if (result.ok) items.push(result.value);
          if (items.length === maxItems) break;
        }
        return valid(items);
      },
      serialize(value) {
        if (!validateList(value))
          throw new UrlStateCodecError(`url-state: invalid list<${item.kind}> value`);
        // An empty list is only serialized when it differs from a non-empty default.
        return value.length === 0 ? [''] : value.map((entry) => scalar.write(entry));
      },
      validate: validateList,
      equals: (a, b) =>
        a.length === b.length && a.every((entry, index) => item.equals(entry, b[index])),
      clone: (value) => value.map((entry) => item.clone(entry)),
    });
  },

  custom,
});
