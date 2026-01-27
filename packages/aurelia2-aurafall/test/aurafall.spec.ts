import { createFixture } from '@aurelia/testing';
import { CustomElement } from '@aurelia/runtime-html';
import { AureliaAurafallConfiguration, AuAurafallCustomElement } from '../src/index';

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const stubRect = (element: HTMLElement, rect: Partial<DOMRect>): void => {
  const base: DOMRect = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;

  element.getBoundingClientRect = () => ({ ...base, ...rect });
};

const setClientSize = (element: HTMLElement, width: number, height: number): void => {
  Object.defineProperty(element, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(element, 'clientHeight', { value: height, configurable: true });
};

describe('aurelia2-aurafall', () => {
  test('renders all items when virtual mode is disabled', async () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      id: `item-${index}`,
      height: 100 + index * 10,
    }));

    const { appHost, startPromise, tearDown } = createFixture(
      '<au-aurafall items.bind="items" calc-item-height.bind="calcItemHeight" virtual.bind="false"></au-aurafall>',
      class App {
        items = items;
        calcItemHeight = (item: { height: number }) => item.height;
      },
      [AureliaAurafallConfiguration]
    );

    await startPromise;

    const aurafall = appHost.querySelector('au-aurafall') as HTMLElement;
    const viewModel = CustomElement.for(aurafall).viewModel as AuAurafallCustomElement;
    const content = aurafall.querySelector('.au-aurafall-content') as HTMLDivElement;

    setClientSize(aurafall, 500, 300);
    setClientSize(content, 500, 0);
    stubRect(aurafall, { top: 0, height: 300 });
    stubRect(content, { top: 0, height: 0, width: 500 });

    viewModel.refreshLayout();
    await flush();

    expect(viewModel.itemRenderList).toHaveLength(items.length);
    expect(viewModel.itemRenderList[0].top).toBe(0);

    await tearDown();
  });

  test('virtual mode reduces rendered items based on scroll position', async () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      id: `item-${index}`,
      height: 90 + (index % 3) * 20,
    }));

    const { appHost, startPromise, tearDown } = createFixture(
      '<au-aurafall items.bind="items" calc-item-height.bind="calcItemHeight"></au-aurafall>',
      class App {
        items = items;
        calcItemHeight = (item: { height: number }) => item.height;
      },
      [AureliaAurafallConfiguration]
    );

    await startPromise;

    const aurafall = appHost.querySelector('au-aurafall') as HTMLElement;
    const viewModel = CustomElement.for(aurafall).viewModel as AuAurafallCustomElement;
    const content = aurafall.querySelector('.au-aurafall-content') as HTMLDivElement;

    setClientSize(aurafall, 520, 200);
    setClientSize(content, 520, 0);
    stubRect(aurafall, { top: 0, height: 200 });
    stubRect(content, { top: -150, height: 0, width: 520 });

    viewModel.refreshLayout();
    await flush();

    expect(viewModel.itemRenderList.length).toBeLessThan(items.length);

    await tearDown();
  });
});
