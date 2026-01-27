import {
  buildSpaces,
  computeColumnCount,
  computeItemWidth,
  selectVisibleSpaces,
} from '../src/waterfall-layout';

const calcHeight = (item: { height: number }): number => item.height;

describe('waterfall-layout', () => {
  test('computeColumnCount respects min and max bounds', () => {
    expect(computeColumnCount(0, 220, 10, 2)).toBe(0);
    expect(computeColumnCount(300, 220, 10, 2)).toBe(2);
    expect(computeColumnCount(900, 200, 3, 2)).toBe(3);
    expect(computeColumnCount(450, 200, 10, 2)).toBe(2);
  });

  test('computeItemWidth accounts for gaps', () => {
    expect(computeItemWidth(500, 2, 10)).toBe(245);
    expect(computeItemWidth(0, 2, 10)).toBe(0);
  });

  test('buildSpaces positions items in the shortest column', () => {
    const items = [
      { id: 'a', height: 100 },
      { id: 'b', height: 120 },
      { id: 'c', height: 80 },
    ];

    const { spaces, columnsTop } = buildSpaces({
      items,
      itemWidth: 245,
      columnCount: 2,
      gap: 10,
      calcItemHeight: calcHeight,
    });

    expect(spaces).toHaveLength(3);
    expect(spaces[0]).toMatchObject({ index: 0, column: 0, top: 0, left: 0, height: 100 });
    expect(spaces[1]).toMatchObject({ index: 1, column: 1, top: 0, left: 255, height: 120 });
    expect(spaces[2]).toMatchObject({ index: 2, column: 0, top: 110, left: 0, height: 80 });
    expect(columnsTop).toEqual([200, 130]);
  });

  test('selectVisibleSpaces filters by viewport and preload', () => {
    const spaces = [
      { index: 0, item: {}, column: 0, top: 0, bottom: 100, left: 0, height: 100 },
      { index: 1, item: {}, column: 0, top: 120, bottom: 200, left: 0, height: 80 },
      { index: 2, item: {}, column: 0, top: 210, bottom: 260, left: 0, height: 50 },
    ];

    const visible = selectVisibleSpaces(spaces, 0, 200, [0, 0]);
    expect(visible.map((space) => space.index)).toEqual([0, 1]);

    const preloaded = selectVisibleSpaces(spaces, 0, 200, [0, 1]);
    expect(preloaded.map((space) => space.index)).toEqual([0, 1, 2]);
  });
});
