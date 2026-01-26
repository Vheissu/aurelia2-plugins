# aurelia2-chartjs

A Chart.js wrapper for Aurelia 2 with typed chart custom elements.

## Installation

```
npm install aurelia2-chartjs chart.js
```

## Register the plugin

```ts
import { AureliaChartJSConfiguration } from 'aurelia2-chartjs';
import { Chart as ChartJS, registerables } from 'chart.js';

// You can register Chart.js components yourself, or let the plugin do it.
ChartJS.register(...registerables);

Aurelia.register(
  AureliaChartJSConfiguration.configure({
    // Optional defaults for all charts
    defaults: {
      responsive: true
    },
    // Optional global plugins for all charts
    plugins: [],
    // Optional chart data behavior
    datasetIdKey: 'label',
    updateMode: undefined,
    destroyDelay: 0
  })
);
```

If you prefer, you can have the plugin register Chart.js components:

```ts
import { AureliaChartJSConfiguration } from 'aurelia2-chartjs';
import { registerables } from 'chart.js';

Aurelia.register(
  AureliaChartJSConfiguration.configure({
    registerables
  })
);
```

## Basic usage

```html
<au-chart
  type="bar"
  data.bind="data"
  options.bind="options">
  Chart fallback text.
</au-chart>
```

```ts
import type { ChartData, ChartOptions } from 'chart.js';

export class MyViewModel {
  public data: ChartData<'bar'> = {
    labels: ['January', 'February', 'March'],
    datasets: [{ label: 'Sales', data: [40, 20, 12] }]
  };

  public options: ChartOptions<'bar'> = {
    responsive: true
  };
}
```

## Typed chart elements

```html
<au-bar-chart data.bind="data" options.bind="options"></au-bar-chart>
<au-line-chart data.bind="lineData" options.bind="lineOptions"></au-line-chart>
```

Typed elements are provided:
- `au-bar-chart`
- `au-line-chart`
- `au-pie-chart`
- `au-doughnut-chart`
- `au-polar-area-chart`
- `au-radar-chart`
- `au-bubble-chart`
- `au-scatter-chart`

## Accessing the Chart.js instance

```html
<au-chart ref="chartVm" type="line" data.bind="data"></au-chart>
```

```ts
import type { AuChartCustomElement } from 'aurelia2-chartjs';

export class MyViewModel {
  public chartVm?: AuChartCustomElement;

  attached() {
    const chart = this.chartVm?.chart;
    chart?.update();
  }
}
```

## Updating data

The wrapper updates when `data`, `options`, or key arrays are replaced. If you mutate arrays in place
(e.g., `push` or index assignment), call `update()` on the element or Chart.js instance.

## Utilities

```ts
import { getDatasetAtEvent, getElementAtEvent, getElementsAtEvent } from 'aurelia2-chartjs';
```

## Configuration (customize)

```ts
Aurelia.register(
  AureliaChartJSConfiguration.customize((config) => {
    config.options({
      registerables,
      defaults: { responsive: true },
      datasetIdKey: 'label'
    });
  })
);
```
