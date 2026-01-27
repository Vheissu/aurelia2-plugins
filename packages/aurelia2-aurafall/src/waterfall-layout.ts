import { SpaceOption } from './types';

export interface SpaceBuildOptions {
  items: unknown[];
  itemWidth: number;
  columnCount: number;
  gap: number;
  calcItemHeight: (item: unknown, itemWidth: number) => number;
  startIndex?: number;
  previousSpaces?: SpaceOption[];
  columnsTop?: number[];
}

export const computeColumnCount = (
  contentWidth: number,
  itemMinWidth: number,
  maxColumnCount: number,
  minColumnCount: number
): number => {
  if (!contentWidth) return 0;
  if (contentWidth >= itemMinWidth * 2) {
    const count = Math.floor(contentWidth / itemMinWidth);
    if (maxColumnCount && count > maxColumnCount) return maxColumnCount;
    return count;
  }
  return minColumnCount;
};

export const computeItemWidth = (
  contentWidth: number,
  columnCount: number,
  gap: number
): number => {
  if (!contentWidth || columnCount <= 0) return 0;
  const totalGap = (columnCount - 1) * gap;
  return Math.ceil((contentWidth - totalGap) / columnCount);
};

export const buildSpaces = (options: SpaceBuildOptions): {
  spaces: SpaceOption[];
  columnsTop: number[];
} => {
  const {
    items,
    itemWidth,
    columnCount,
    gap,
    calcItemHeight,
    startIndex = 0,
    previousSpaces,
    columnsTop,
  } = options;

  const length = items.length;
  const safeStart = Math.max(0, Math.min(startIndex, length));
  const spaces = new Array<SpaceOption>(length);
  const nextColumnsTop = columnsTop ? columnsTop.slice() : new Array(columnCount).fill(0);

  if (previousSpaces && safeStart > 0) {
    for (let i = 0; i < safeStart; i += 1) {
      spaces[i] = previousSpaces[i];
    }
  }

  for (let i = safeStart; i < length; i += 1) {
    const columnIndex = getColumnIndex(nextColumnsTop);
    const height = calcItemHeight(items[i], itemWidth);
    const top = nextColumnsTop[columnIndex];
    const left = (itemWidth + gap) * columnIndex;

    spaces[i] = {
      index: i,
      item: items[i],
      column: columnIndex,
      top,
      left,
      bottom: top + height,
      height,
    };

    nextColumnsTop[columnIndex] = top + height + gap;
  }

  return { spaces, columnsTop: nextColumnsTop };
};

export const selectVisibleSpaces = (
  spaces: readonly SpaceOption[],
  viewportTop: number,
  viewportHeight: number,
  preloadScreenCount: [number, number]
): SpaceOption[] => {
  const length = spaces.length;
  if (!length) return [];
  if (!viewportHeight) return spaces.slice();

  const [topPreload, bottomPreload] = preloadScreenCount;
  const minLimit = viewportTop - topPreload * viewportHeight;
  const maxLimit = viewportTop + (bottomPreload + 1) * viewportHeight;

  const visible: SpaceOption[] = [];
  for (let i = 0; i < length; i += 1) {
    const space = spaces[i];
    const top = space.top;
    const bottom = space.bottom;

    if (
      (top >= minLimit && top <= maxLimit) ||
      (bottom >= minLimit && bottom <= maxLimit) ||
      (top < minLimit && bottom > maxLimit)
    ) {
      visible.push(space);
    }
  }

  return visible;
};

const getColumnIndex = (columnsTop: number[]): number => {
  let minValue = Number.POSITIVE_INFINITY;
  let minIndex = 0;

  for (let i = 0; i < columnsTop.length; i += 1) {
    const value = columnsTop[i];
    if (value < minValue) {
      minValue = value;
      minIndex = i;
    }
  }

  return minIndex;
};
