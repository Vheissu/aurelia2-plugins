import { DI } from '@aurelia/kernel';
import { Chart as ChartJS } from 'chart.js';
import type {
  ChartComponentLike,
  ChartOptions,
  ChartType,
  Plugin,
  UpdateMode
} from 'chart.js';

export interface ChartJSConfigurationOptions {
  registerables?: ChartComponentLike | ChartComponentLike[];
  defaults?: ChartOptions<ChartType>;
  plugins?: Plugin[];
  datasetIdKey?: string;
  updateMode?: UpdateMode;
  destroyDelay?: number;
}

export interface IChartJSConfiguration extends ChartJSConfiguration {}
export const IChartJSConfiguration = DI.createInterface<IChartJSConfiguration>(
  'IChartJSConfiguration',
  (x) => x.singleton(ChartJSConfiguration)
);

export class ChartJSConfiguration {
  private _config: ChartJSConfigurationOptions = {
    registerables: [],
    defaults: {},
    plugins: [],
    datasetIdKey: 'label',
    updateMode: undefined,
    destroyDelay: 0
  };

  options(next: ChartJSConfigurationOptions = {}) {
    if (next.registerables) {
      const current = this.normalizeRegisterables(this._config.registerables);
      const incoming = this.normalizeRegisterables(next.registerables);
      this._config.registerables = [...current, ...incoming];
    }

    if (next.defaults) {
      this._config.defaults = Object.assign({}, this._config.defaults, next.defaults);
    }

    if (next.plugins) {
      this._config.plugins = [
        ...(this._config.plugins ?? []),
        ...next.plugins
      ];
    }

    if (next.datasetIdKey !== undefined) {
      this._config.datasetIdKey = next.datasetIdKey;
    }

    if (next.updateMode !== undefined) {
      this._config.updateMode = next.updateMode;
    }

    if (next.destroyDelay !== undefined) {
      this._config.destroyDelay = next.destroyDelay;
    }
  }

  getOptions(): ChartJSConfigurationOptions {
    return this._config;
  }

  apply(): void {
    const registerables = this.normalizeRegisterables(this._config.registerables);
    if (registerables.length) {
      ChartJS.register(...registerables);
    }

    if (this._config.defaults && Object.keys(this._config.defaults).length) {
      Object.assign(ChartJS.defaults, this._config.defaults);
    }
  }

  private normalizeRegisterables(
    value?: ChartComponentLike | ChartComponentLike[]
  ): ChartComponentLike[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }
}
