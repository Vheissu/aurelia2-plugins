import {
  isUrlParam,
  param,
  UrlStateCodecError,
  type ParseResult,
  type UrlParam,
} from '../src/index';
import { filterParam, sampleFilter } from './filter-document';

const value = <T>(result: ParseResult<T>) => (result.ok ? result.value : 'INVALID');
const roundTrip = <T>(p: UrlParam<T>, input: T) => value(p.parse(p.serialize(input)));

describe('param codecs (pure)', () => {
  it('string: first value wins, length is capped, values round-trip unchanged', () => {
    const p = param.string({ maxLength: 5 });
    expect(value(p.parse(['acme', 'other']))).toBe('acme');
    expect(value(p.parse(['toolong']))).toBe('INVALID');
    expect(value(p.parse(['']))).toBe('');
    expect(p.parse([])).toEqual({ ok: false, reason: 'missing' });
    expect(roundTrip(p, 'a b&')).toBe('a b&');
    expect(p.validate('abcdef')).toBe(false);
    expect(() => p.serialize('abcdef' as string)).toThrow(UrlStateCodecError);
  });

  it('int: rejects non-integers, ranges and unsafe sizes; leading zeros parse to a canonical value', () => {
    const p = param.int({ min: 1, max: 500 });
    expect(value(p.parse(['3']))).toBe(3);
    expect(p.serialize(value(p.parse(['007'])) as number)).toEqual(['7']);
    for (const bad of ['-4', '0', '501', '1.5', '+1', '1e2', ' 1', 'abc', '99999999999999999'])
      expect(value(p.parse([bad]))).toBe('INVALID');
    expect(p.validate(2.5)).toBe(false);
    expect(p.validate('2')).toBe(false);
    expect(() => param.int({ min: 5, max: 1 })).toThrow(/min exceeds max/);
  });

  it('number: accepts decimals and exponents, rejects NaN, Infinity and empty values', () => {
    const p = param.number({ max: 1e30 });
    expect(value(p.parse(['1.25']))).toBe(1.25);
    expect(value(p.parse(['.5']))).toBe(0.5);
    expect(value(p.parse(['-2e3']))).toBe(-2000);
    expect(roundTrip(p, 1e21)).toBe(1e21);
    expect(p.serialize(1e21)).toEqual(['1e+21']);
    for (const bad of ['NaN', 'Infinity', '', '1.', '0x10', '1e400', '2e30'])
      expect(value(p.parse([bad]))).toBe('INVALID');
  });

  it('boolean and enum: only listed spellings are valid', () => {
    const b = param.boolean();
    expect(
      [b.parse(['true']), b.parse(['1']), b.parse(['false']), b.parse(['0'])].map(value),
    ).toEqual([true, true, false, false]);
    expect(value(b.parse(['yes']))).toBe('INVALID');
    expect(b.serialize(true)).toEqual(['true']);
    const e = param.enum(['all', 'open', 'closed'] as const);
    expect(value(e.parse(['open']))).toBe('open');
    expect(value(e.parse(['OPEN']))).toBe('INVALID');
    expect(value(e.parse(['toString']))).toBe('INVALID');
    expect(() => param.enum([])).toThrow();
    expect(() => param.enum(['a', 'a'])).toThrow(/unique/);
  });

  it('list: repeated keys, invalid and empty items dropped, item count capped, empty marker', () => {
    const p = param.list(param.enum(['a', 'b', 'c']), { maxItems: 2 });
    expect(value(p.parse(['a', 'bogus', '', 'c', 'b']))).toEqual(['a', 'c']);
    expect(p.serialize(['b', 'a'])).toEqual(['b', 'a']);
    expect(p.serialize([])).toEqual(['']);
    expect(value(p.parse(['']))).toEqual([]);
    expect(p.validate(['a', 'b', 'c'])).toBe(false);
    const ints = param.list(param.int());
    expect(value(ints.parse(['1', 'x', '3']))).toEqual([1, 3]);
    expect(() => param.list(param.string({ debounce: 5 }))).toThrow(/on the list/);
    expect(() => param.list(ints as unknown as UrlParam<number>)).toThrow(/scalar/);
  });

  it('date: calendar dates at UTC midnight; impossible dates and out-of-range years are invalid', () => {
    const p = param.date();
    const parsed = value(p.parse(['2024-02-29'])) as Date;
    expect(parsed.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(p.serialize(parsed)).toEqual(['2024-02-29']);
    expect(roundTrip(p, new Date('0099-03-01T00:00:00Z'))).toEqual(
      new Date('0099-03-01T00:00:00Z'),
    );
    for (const bad of [
      '2023-02-29',
      '2024-13-01',
      '2024-1-01',
      '24-01-01',
      'today',
      '2024-01-01T00:00Z',
    ])
      expect(value(p.parse([bad]))).toBe('INVALID');
    expect(p.validate(new Date('nope'))).toBe(false);
    const bounded = param.date({ min: new Date('2024-01-01T00:00:00Z') });
    expect(value(bounded.parse(['2023-12-31']))).toBe('INVALID');
  });

  it('datetime: ISO instants with a zone are normalized to toISOString()', () => {
    const p = param.datetime();
    const parsed = value(p.parse(['2024-05-01T10:30:00+02:00'])) as Date;
    expect(p.serialize(parsed)).toEqual(['2024-05-01T08:30:00.000Z']);
    expect(value(p.parse(['2024-05-01T10:30:00']))).toBe('INVALID');
    expect(value(p.parse(['2024-05-01']))).toBe('INVALID');
    const copy = p.clone(parsed);
    expect(copy).not.toBe(parsed);
    expect(p.equals(copy, parsed)).toBe(true);
  });

  it('custom: throwing or undefined parse is invalid; bad serialize output raises a codec error', () => {
    const p = param.custom<{ n: number }>({
      parse: (raw) =>
        raw === 'boom'
          ? (undefined as never)
          : raw === 'throw'
            ? JSON.parse('{')
            : { n: Number(raw) },
      serialize: (v) =>
        v.n < 0 ? (42 as unknown as string) : v.n > 100 ? 'x'.repeat(30) : String(v.n),
      validate: (v): v is { n: number } =>
        typeof (v as { n?: unknown })?.n === 'number' && Number.isFinite((v as { n: number }).n),
      maxLength: 20,
    });
    expect(value(p.parse(['5']))).toEqual({ n: 5 });
    expect(value(p.parse(['boom']))).toBe('INVALID');
    expect(value(p.parse(['throw']))).toBe('INVALID');
    expect(value(p.parse(['NaN']))).toBe('INVALID');
    expect(value(p.parse(['1'.repeat(21)]))).toBe('INVALID');
    expect(() => p.serialize({ n: -1 })).toThrow(/must return a string/);
    expect(() => p.serialize({ n: 101 })).toThrow(/exceeds 20/);
    expect(p.equals({ n: 1 }, { n: 1 })).toBe(true);
    const original = { n: 3 };
    expect(p.clone(original)).toEqual(original);
    expect(p.clone(original)).not.toBe(original);
  });

  it('custom: validates a filter-builder style JSON document without importing that package', () => {
    const doc = sampleFilter();
    const [raw] = filterParam.serialize(doc);
    expect(value(filterParam.parse([raw]))).toEqual(doc);
    const polluted = raw.replace('"root"', '"__proto__":{"admin":true},"root"');
    expect(value(filterParam.parse([polluted]))).toBe('INVALID');
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
    expect(value(filterParam.parse(['{"version":2}']))).toBe('INVALID');
    expect(value(filterParam.parse(['not json']))).toBe('INVALID');
    let deep = '{"kind":"condition","id":"c","field":"plan","operator":"eq","value":"pro"}';
    for (let i = 0; i < 6; i++)
      deep = `{"kind":"group","id":"g${i}","combinator":"all","children":[${deep}]}`;
    expect(value(filterParam.parse([`{"version":1,"root":${deep}}`]))).toBe('INVALID');
  });

  it('builders validate options, defaults and keys up front and produce frozen branded params', () => {
    expect(() => param.string({ debounce: -1 })).toThrow(/debounce/);
    expect(() => param.string({ history: 'pushy' as 'push' })).toThrow(/history/);
    expect(() => param.string({ key: '__proto__' })).toThrow(/reserved/);
    expect(() => param.string({ key: 'x'.repeat(101) })).toThrow(/1-100/);
    expect(() => param.int({ default: 1.5 })).toThrow(/default/);
    expect(() => param.enum(['a'], { default: 'b' as 'a' })).toThrow(/default/);
    const p = param.list(param.string(), { default: ['x'] });
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.options)).toBe(true);
    expect(isUrlParam(p)).toBe(true);
    expect(isUrlParam({ ...p })).toBe(false);
    expect(param.int({ default: null }).options).toMatchObject({ hasDefault: true, default: null });
  });
});

it('rejects sparse lists instead of silently serializing holes', () => {
  const p = param.list(param.string());
  expect(p.validate(Array(2))).toBe(false);
  expect(() => p.serialize(Array(2))).toThrow();
});
