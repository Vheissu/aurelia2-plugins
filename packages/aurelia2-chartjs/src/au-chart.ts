import { bindable, customElement, ICustomElementViewModel, queueTask, resolve, watch } from 'aurelia';
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

  private readonly config = resolve(IChartJSConfiguration);
  private isAttached = false;
  private pendingUpdate: ChartJS | null = null;
  private destroyTimer?: ReturnType<typeof setTimeout>;

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
    this.isAttached = true;
    clearTimeout(this.destroyTimer);
    this.destroyChart();
    this.renderChart();
  }

  public detaching(): void {
    this.isAttached = false;
    this.pendingUpdate = null;
    if (this.chart && this.destroyDelay > 0) {
      this.destroyTimer = setTimeout(() => this.destroyChart(), this.destroyDelay);
    } else {
      this.destroyChart();
    }
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
        ?.map(dataset =>
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
    if (!this.isAttached) return;
    if (!this.chart) {
      this.renderChart();
      return;
    }

    this.updateChart();
  }

  private requestUpdate(): void {
    if (!this.isAttached) return;
    const chart = this.chart;
    if (!chart) {
      this.renderChart();
      return;
    }

    if (this.pendingUpdate === chart) return;
    this.pendingUpdate = chart;

    queueTask(() => {
      if (this.pendingUpdate !== chart) return;
      this.pendingUpdate = null;
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
    this.chart = null;
    this.destroyTimer = undefined;
    chart?.destroy();
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
