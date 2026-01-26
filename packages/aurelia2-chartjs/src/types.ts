import type {
  Chart as ChartJS,
  ChartType,
  ChartData,
  ChartOptions,
  DefaultDataPoint,
  Plugin,
  UpdateMode
} from 'chart.js';

export interface ChartProps<
  TType extends ChartType = ChartType,
  TData = DefaultDataPoint<TType>,
  TLabel = unknown
> {
  /**
   * Chart.js chart type.
   */
  type: TType;
  /**
   * The data object passed into Chart.js.
   */
  data: ChartData<TType, TData, TLabel>;
  /**
   * The options object passed into Chart.js.
   * @default {}
   */
  options?: ChartOptions<TType>;
  /**
   * The plugins array passed into Chart.js.
   * @default []
   */
  plugins?: Plugin<TType>[];
  /**
   * Key name used to identify datasets.
   * @default 'label'
   */
  datasetIdKey?: string;
  /**
   * Chart.js update mode.
   */
  updateMode?: UpdateMode;
}

export interface ChartComponentRef<
  TType extends ChartType = ChartType,
  TData = DefaultDataPoint<TType>,
  TLabel = unknown
> {
  chart: ChartJS<TType, TData, TLabel> | null;
}

export type TypedChartProps<
  TType extends ChartType,
  TData = DefaultDataPoint<TType>,
  TLabel = unknown
> = Omit<ChartProps<TType, TData, TLabel>, 'type'>;
