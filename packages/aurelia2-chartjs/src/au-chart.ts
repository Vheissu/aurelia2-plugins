import { bindable, customElement, ICustomElementViewModel, watch } from 'aurelia';
import { inject } from '@aurelia/kernel';
import { queueTask } from '@aurelia/runtime';
import { Chart as ChartJS } from 'chart.js';
import type {
  ChartData,
  ChartOptions,
  ChartType,
  Plugin,
  UpdateMode
} from 'chart.js';
import { IChartJSConfiguration } from './configuration';
import { cloneData, setDatasets, setLabels, setOptions } from './utils';
import template from './au-chart.html';

@customElement({
  name: 'au-chart',
  template
})
@inject(IChartJSConfiguration)
export class AuChartCustomElement implements ICustomElementViewModel {
  @bindable public type?: ChartType;
  @bindable public data?: ChartData;
  @bindable public options: ChartOptions = {};
  @bindable public plugins: Plugin[] = [];
  @bindable public datasetIdKey: string = 'label';
  @bindable public updateMode?: UpdateMode;
  @bindable public destroyDelay: number = 0;
  @bindable public ariaLabel?: string;
  @bindable public ariaDescribedby?: string;
  @bindable public chartId?: string;
  @bindable public width?: number | string;
  @bindable public height?: number | string;

  public canvas?: HTMLCanvasElement;
  public chart: ChartJS | null = null;

  private pendingUpdate = false;

  public constructor(private readonly config: IChartJSConfiguration) {}

  public binding(): void {
    this.config.apply();
    const defaults = this.config.getOptions();

    if (this.datasetIdKey === 'label' && defaults.datasetIdKey) {
      this.datasetIdKey = defaults.datasetIdKey;
    }

    if (this.updateMode === undefined && defaults.updateMode !== undefined) {
      this.updateMode = defaults.updateMode;
    }

    if (this.destroyDelay === 0 && defaults.destroyDelay) {
      this.destroyDelay = defaults.destroyDelay;
    }
  }

  public attached(): void {
    this.renderChart();
  }

  public detached(): void {
    this.destroyChart();
  }

  @watch((x: AuChartCustomElement) => x.data)
  protected handleDataChanged(): void {
    this.requestUpdate();
  }

  @watch((x: AuChartCustomElement) => x.data?.labels?.length)
  protected handleLabelsChanged(): void {
    this.requestUpdate();
  }

  @watch((x: AuChartCustomElement) => x.data?.datasets?.length)
  protected handleDatasetsChanged(): void {
    this.requestUpdate();
  }

  @watch(
    (x: AuChartCustomElement) =>
      x.data?.datasets
        ?.map((dataset: any) =>
          Array.isArray(dataset?.data) ? dataset.data.length : 0
        )
        .join('|')
  )
  protected handleDatasetDataChanged(): void {
    this.requestUpdate();
  }

  @watch((x: AuChartCustomElement) => x.options)
  protected handleOptionsChanged(): void {
    this.requestUpdate();
  }

  @watch((x: AuChartCustomElement) => x.plugins)
  protected handlePluginsChanged(): void {
    this.requestUpdate();
  }

  @watch((x: AuChartCustomElement) => x.type)
  protected handleTypeChanged(): void {
    this.requestUpdate();
  }

  @watch((x: AuChartCustomElement) => x.datasetIdKey)
  protected handleDatasetKeyChanged(): void {
    this.requestUpdate();
  }

  public update(): void {
    if (!this.chart) {
      this.renderChart();
      return;
    }

    this.updateChart();
  }

  private requestUpdate(): void {
    if (!this.chart) {
      this.renderChart();
      return;
    }

    this.scheduleUpdate();
  }

  private scheduleUpdate(): void {
    if (this.pendingUpdate) return;
    this.pendingUpdate = true;

    queueTask(() => {
      this.pendingUpdate = false;
      this.updateChart();
    });
  }

  private renderChart(): void {
    if (!this.canvas || !this.data || !this.type) return;

    const config = this.config.getOptions();
    const mergedPlugins = this.mergePlugins(config.plugins, this.plugins);
    const clonedData = cloneData(this.data, this.datasetIdKey);

    this.chart = new ChartJS(this.canvas, {
      type: this.type,
      data: clonedData,
      options: { ...this.options },
      plugins: mergedPlugins
    });
  }

  private updateChart(): void {
    if (!this.chart) return;

    const chartConfig = this.chart.config as { type?: ChartType };
    if (this.type && chartConfig.type !== this.type) {
      chartConfig.type = this.type;
    }

    if (this.options) {
      setOptions(this.chart, this.options);
    }

    if (this.data) {
      setLabels(this.chart.data, this.data.labels);
      setDatasets(this.chart.data, this.data.datasets, this.datasetIdKey);
    }

    const config = this.config.getOptions();
    const mergedPlugins = this.mergePlugins(config.plugins, this.plugins);
    if (mergedPlugins.length || this.chart.config.plugins?.length) {
      this.chart.config.plugins = mergedPlugins;
    }

    this.chart.update(this.updateMode);
  }

  private destroyChart(): void {
    const chart = this.chart;
    if (!chart) return;

    if (this.destroyDelay > 0) {
      setTimeout(() => {
        chart.destroy();
        this.chart = null;
      }, this.destroyDelay);
      return;
    }

    chart.destroy();
    this.chart = null;
  }

  private mergePlugins(
    configPlugins: Plugin[] | undefined,
    instancePlugins: Plugin[] | undefined
  ): Plugin[] {
    const merged = [
      ...(configPlugins ?? []),
      ...(instancePlugins ?? [])
    ];

    return merged;
  }
}
