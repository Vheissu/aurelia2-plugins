import { CustomElement } from 'aurelia';
import { createFixture } from '@aurelia/testing';
import { AuChartCustomElement } from './../src/au-chart';
import { AuBarChartCustomElement } from './../src/typed-charts';
import { AureliaChartJSConfiguration } from './../src/index';
import { Chart as ChartJS } from 'chart.js';
import type { ChartData, ChartOptions } from 'chart.js';

jest.mock('chart.js', () => {
  class Chart {
    static register = jest.fn();
    static defaults: Record<string, unknown> = {};
    public config: any;
    public data: any;
    public options: any;
    public update = jest.fn();
    public destroy = jest.fn();

    constructor(_canvas: HTMLCanvasElement, config: any) {
      this.config = config;
      this.data = config.data;
      this.options = config.options;
    }
  }

  return {
    Chart,
    BarController: class {},
    BubbleController: class {},
    DoughnutController: class {},
    LineController: class {},
    PieController: class {},
    PolarAreaController: class {},
    RadarController: class {},
    ScatterController: class {}
  };
});

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-chartjs', () => {
  beforeEach(() => {
    (ChartJS as any).defaults = {};
    (ChartJS as any).register?.mockClear?.();
  });

  function getChartVm(appHost: HTMLElement): AuChartCustomElement {
    const el = appHost.querySelector('au-chart') as HTMLElement;
    if (!el) {
      throw new Error('au-chart not found in fixture');
    }
    return CustomElement.for(el).viewModel as AuChartCustomElement;
  }

  test('renders canvas with bound attributes', async () => {
    const { appHost, startPromise, tearDown } = createFixture(
      '<au-chart type.bind="type" data.bind="data" options.bind="options" '
      + 'chart-id.bind="chartId" aria-label.bind="ariaLabel" aria-describedby.bind="ariaDescribedby" '
      + 'width.bind="width" height.bind="height">Fallback</au-chart>',
      class App {
        public type = 'bar' as const;
        public data: ChartData<'bar'> = {
          labels: ['A'],
          datasets: [{ label: 'A', data: [1] }]
        };
        public options: ChartOptions<'bar'> = { responsive: true };
        public chartId = 'chart-1';
        public ariaLabel = 'Sales chart';
        public ariaDescribedby = 'chart-desc';
        public width = 300;
        public height = 200;
      },
      [AuChartCustomElement]
    );

    await startPromise;

    const chartVm = getChartVm(appHost);
    const canvas = appHost.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('role')).toBe('img');
    expect(canvas?.getAttribute('id')).toBe('chart-1');
    expect(canvas?.getAttribute('aria-label')).toBe('Sales chart');
    expect(canvas?.getAttribute('aria-describedby')).toBe('chart-desc');
    expect(canvas?.getAttribute('width')).toBe('300');
    expect(canvas?.getAttribute('height')).toBe('200');
    expect(canvas?.textContent).toContain('Fallback');
    expect(chartVm.chart).not.toBeNull();

    await tearDown();
  });

  test('updates bound attributes after changes', async () => {
    const { component, appHost, startPromise, tearDown } = createFixture(
      '<au-chart type.bind="type" data.bind="data" options.bind="options" '
      + 'chart-id.bind="chartId" aria-label.bind="ariaLabel"></au-chart>',
      class App {
        public type = 'line' as const;
        public data: ChartData<'line'> = {
          labels: ['A'],
          datasets: [{ label: 'A', data: [1] }]
        };
        public options: ChartOptions<'line'> = {};
        public chartId = 'chart-initial';
        public ariaLabel = 'Initial label';
      },
      [AuChartCustomElement]
    );

    await startPromise;

    const canvas = appHost.querySelector('canvas');
    expect(canvas?.getAttribute('id')).toBe('chart-initial');
    expect(canvas?.getAttribute('aria-label')).toBe('Initial label');

    component.chartId = 'chart-next';
    component.ariaLabel = 'Next label';

    await flush();

    expect(canvas?.getAttribute('id')).toBe('chart-next');
    expect(canvas?.getAttribute('aria-label')).toBe('Next label');

    await tearDown();
  });

  test('calls chart.update when data changes', async () => {
    const { component, appHost, startPromise, tearDown } = createFixture(
      '<au-chart type.bind="type" data.bind="data" options.bind="options"></au-chart>',
      class App {
        public type = 'bar' as const;
        public data: ChartData<'bar'> = {
          labels: ['A'],
          datasets: [{ label: 'A', data: [1] }]
        };
        public options: ChartOptions<'bar'> = {};
      },
      [AuChartCustomElement]
    );

    await startPromise;

    const chart = getChartVm(appHost).chart as any;
    chart.update.mockClear();

    component.data = {
      labels: ['A', 'B'],
      datasets: [{ label: 'A', data: [1, 2] }]
    };

    await flush();

    expect(chart.update).toHaveBeenCalled();

    await tearDown();
  });

  test('merges datasets by datasetIdKey', async () => {
    const { component, appHost, startPromise, tearDown } = createFixture(
      '<au-chart type.bind="type" data.bind="data" dataset-id-key.bind="datasetIdKey"></au-chart>',
      class App {
        public type = 'bar' as const;
        public datasetIdKey = 'id';
        public data: ChartData<'bar'> = {
          labels: ['A'],
          datasets: [{ id: 'a', label: 'A', data: [1] }] as any
        };
      },
      [AuChartCustomElement]
    );

    await startPromise;

    const chart = getChartVm(appHost).chart as any;
    const datasetRef = chart.data.datasets[0];

    component.data = {
      labels: ['A'],
      datasets: [{ id: 'a', label: 'A', data: [2] }] as any
    };

    await flush();

    expect(chart.data.datasets[0]).toBe(datasetRef);
    expect(datasetRef.data[0]).toBe(2);

    await tearDown();
  });

  test('applies configuration defaults and plugins', async () => {
    const plugin = { id: 'test-plugin' };

    const { appHost, startPromise, tearDown } = createFixture(
      '<au-chart type.bind="type" data.bind="data"></au-chart>',
      class App {
        public type = 'line' as const;
        public data: ChartData<'line'> = {
          labels: ['A'],
          datasets: [{ label: 'A', data: [1] }]
        };
      },
      [
        AureliaChartJSConfiguration.configure({
          defaults: { responsive: false },
          plugins: [plugin]
        })
      ]
    );

    await startPromise;

    expect((ChartJS as any).defaults.responsive).toBe(false);
    expect(getChartVm(appHost).chart?.config.plugins).toEqual([plugin]);

    await tearDown();
  });

  test('destroys chart after delay on detach', async () => {
    jest.useFakeTimers();

    const { appHost, startPromise, tearDown } = createFixture(
      '<au-chart type.bind="type" data.bind="data" destroy-delay.bind="destroyDelay"></au-chart>',
      class App {
        public type = 'bar' as const;
        public data: ChartData<'bar'> = {
          labels: ['A'],
          datasets: [{ label: 'A', data: [1] }]
        };
        public destroyDelay = 50;
      },
      [AuChartCustomElement]
    );

    await startPromise;

    const chartVm = getChartVm(appHost);
    const chart = chartVm.chart as any;
    chartVm.detached();

    expect(chart.destroy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(60);

    expect(chart.destroy).toHaveBeenCalledTimes(1);

    await tearDown();
    jest.useRealTimers();
  });

  test('typed chart element renders a canvas', async () => {
    const { appHost, startPromise, tearDown } = createFixture(
      '<au-bar-chart data.bind="data" options.bind="options"></au-bar-chart>',
      class App {
        public data: ChartData<'bar'> = {
          labels: ['A'],
          datasets: [{ label: 'A', data: [1] }]
        };
        public options: ChartOptions<'bar'> = {};
      },
      [AuBarChartCustomElement]
    );

    await startPromise;

    const canvas = appHost.querySelector('canvas');
    expect(canvas).not.toBeNull();

    await tearDown();
  });
});
