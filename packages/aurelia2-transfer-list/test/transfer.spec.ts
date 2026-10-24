import { transfer, reorderKeys } from '../src/index';

describe('key operations', () => {
  it('appends new keys without mutating the input', () => {
    const value = Object.freeze(['a']);
    expect(transfer(value, ['a', 'b'], 'add')).toEqual(['a', 'b']);
    expect(value).toEqual(['a']);
  });
  it('removes keys in original order', () =>
    expect(transfer(['a', 'b', 'c'], ['b'], 'remove')).toEqual(['a', 'c']));
  it('rejects an entire over-limit addition', () =>
    expect(() => transfer(['a'], ['b', 'c'], 'add', { max: 2 })).toThrow(RangeError));
  it('allows removal while already above the limit', () =>
    expect(transfer(['a', 'b'], ['a'], 'remove', { max: 0 })).toEqual(['b']));
  it('moves adjacent selections as a block', () => {
    expect(reorderKeys(['a', 'b', 'c', 'd'], ['b', 'c'], -1)).toEqual(['b', 'c', 'a', 'd']);
    expect(reorderKeys(['a', 'b', 'c', 'd'], ['b', 'c'], 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(reorderKeys(['a', 'b', 'c'], ['a', 'b'], -1)).toEqual(['a', 'b', 'c']);
  });
  it.each([['a', 'a'], [''], [NaN], Array(2)].map((keys) => [keys]))(
    'rejects invalid keys %p',
    (keys) => {
      expect(() => transfer(keys as any, [], 'add')).toThrow();
    },
  );
  it('rejects invalid offsets and limits', () => {
    expect(() => reorderKeys(['a'], ['a'], 0 as any)).toThrow();
    expect(() => transfer([], ['a'], 'add', { max: NaN })).toThrow();
  });
});
