import { IContainer, IRegistry } from '@aurelia/kernel';
import {
  ChartJSConfiguration,
  ChartJSConfigurationOptions,
  IChartJSConfiguration
} from './configuration';
import { AuChartCustomElement } from './au-chart';
import {
  AuBarChartCustomElement,
  AuBubbleChartCustomElement,
  AuDoughnutChartCustomElement,
  AuLineChartCustomElement,
  AuPieChartCustomElement,
  AuPolarAreaChartCustomElement,
  AuRadarChartCustomElement,
  AuScatterChartCustomElement
} from './typed-charts';

const DefaultComponents: IRegistry[] = [
  AuChartCustomElement as unknown as IRegistry,
  AuBarChartCustomElement as unknown as IRegistry,
  AuBubbleChartCustomElement as unknown as IRegistry,
  AuDoughnutChartCustomElement as unknown as IRegistry,
  AuLineChartCustomElement as unknown as IRegistry,
  AuPieChartCustomElement as unknown as IRegistry,
  AuPolarAreaChartCustomElement as unknown as IRegistry,
  AuRadarChartCustomElement as unknown as IRegistry,
  AuScatterChartCustomElement as unknown as IRegistry
];

function createConfiguration(options?: ChartJSConfigurationOptions) {
  return {
    register(container: IContainer): IContainer {
      const config = container.get(IChartJSConfiguration) as ChartJSConfiguration;
      config.options(options ?? {});
      config.apply();

      return container.register(...DefaultComponents);
    },
    configure(next?: ChartJSConfigurationOptions) {
      return createConfiguration(next);
    },
    customize(callback?: (config: IChartJSConfiguration) => void) {
      return {
        register(container: IContainer): IContainer {
          const config = container.get(IChartJSConfiguration) as ChartJSConfiguration;
          config.options(options ?? {});
          callback?.(config);
          config.apply();

          return container.register(...DefaultComponents);
        },
        configure(next?: ChartJSConfigurationOptions) {
          return createConfiguration(next);
        }
      };
    }
  };
}

export const AureliaChartJSConfiguration = createConfiguration({});

export { AuChartCustomElement } from './au-chart';
export {
  AuBarChartCustomElement,
  AuBubbleChartCustomElement,
  AuDoughnutChartCustomElement,
  AuLineChartCustomElement,
  AuPieChartCustomElement,
  AuPolarAreaChartCustomElement,
  AuRadarChartCustomElement,
  AuScatterChartCustomElement,
  createTypedChart
} from './typed-charts';
export {
  getDatasetAtEvent,
  getElementAtEvent,
  getElementsAtEvent
} from './utils';
export type { ChartProps, ChartComponentRef, TypedChartProps } from './types';
export {
  ChartJSConfiguration,
  IChartJSConfiguration,
  type ChartJSConfigurationOptions
} from './configuration';
