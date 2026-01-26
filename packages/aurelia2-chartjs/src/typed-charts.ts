import { customElement } from 'aurelia';
import {
  Chart as ChartJS,
  BarController,
  BubbleController,
  DoughnutController,
  LineController,
  PieController,
  PolarAreaController,
  RadarController,
  ScatterController
} from 'chart.js';
import type { ChartComponentLike, ChartType, DefaultDataPoint } from 'chart.js';
import { AuChartCustomElement } from './au-chart';
import template from './au-chart.html';

const normalizeRegisterables = (
  value?: ChartComponentLike | ChartComponentLike[]
): ChartComponentLike[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

export function createTypedChart<
  TType extends ChartType = ChartType,
  TData = DefaultDataPoint<TType>,
  TLabel = unknown
>(
  name: string,
  type: TType,
  registerables?: ChartComponentLike | ChartComponentLike[]
): typeof AuChartCustomElement {
  const toRegister = normalizeRegisterables(registerables);
  if (toRegister.length) {
    ChartJS.register(...toRegister);
  }

  @customElement({ name, template })
  class TypedChartCustomElement extends AuChartCustomElement {
    public binding(): void {
      this.type = type;
      super.binding();
    }
  }

  return TypedChartCustomElement;
}

export interface ExtendedDataPoint {
  [key: string]: string | number | null | ExtendedDataPoint;
}

export const AuBarChartCustomElement: typeof AuChartCustomElement = /* #__PURE__ */ createTypedChart<
  'bar',
  DefaultDataPoint<'bar'> | ExtendedDataPoint[]
>('au-bar-chart', 'bar', BarController);

export const AuDoughnutChartCustomElement: typeof AuChartCustomElement = /* #__PURE__ */ createTypedChart(
  'au-doughnut-chart',
  'doughnut',
  DoughnutController
);

export const AuLineChartCustomElement: typeof AuChartCustomElement = /* #__PURE__ */ createTypedChart(
  'au-line-chart',
  'line',
  LineController
);

export const AuPieChartCustomElement: typeof AuChartCustomElement = /* #__PURE__ */ createTypedChart(
  'au-pie-chart',
  'pie',
  PieController
);

export const AuPolarAreaChartCustomElement: typeof AuChartCustomElement = /* #__PURE__ */ createTypedChart(
  'au-polar-area-chart',
  'polarArea',
  PolarAreaController
);

export const AuRadarChartCustomElement: typeof AuChartCustomElement = /* #__PURE__ */ createTypedChart(
  'au-radar-chart',
  'radar',
  RadarController
);

export const AuBubbleChartCustomElement: typeof AuChartCustomElement = /* #__PURE__ */ createTypedChart(
  'au-bubble-chart',
  'bubble',
  BubbleController
);

export const AuScatterChartCustomElement: typeof AuChartCustomElement = /* #__PURE__ */ createTypedChart(
  'au-scatter-chart',
  'scatter',
  ScatterController
);
