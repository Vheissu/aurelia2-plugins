import { DI } from 'aurelia';
import type { TourConfigurationOptions, TourDispose, TourListener, TourState, TourStep } from './types';

export class TourService {
  public options: Required<TourConfigurationOptions> = {
    nextLabel: 'Next',
    previousLabel: 'Back',
    doneLabel: 'Done',
    closeLabel: 'Close',
  };

  private listeners = new Set<TourListener>();
  private state: TourState = {
    active: false,
    index: 0,
    steps: [],
    current: null,
  };

  public configure(options: TourConfigurationOptions = {}): void {
    this.options = {
      ...this.options,
      ...options,
    };
    this.notify();
  }

  public subscribe(listener: TourListener): TourDispose {
    this.listeners.add(listener);
    listener(this.getState());

    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  public start(steps: TourStep[], index = 0): void {
    this.state = createState(steps, true, clamp(index, 0, Math.max(steps.length - 1, 0)));
    this.notify();
  }

  public stop(): void {
    this.state = createState(this.state.steps, false, this.state.index);
    this.notify();
  }

  public next(): void {
    if (this.state.index >= this.state.steps.length - 1) {
      this.stop();
      return;
    }

    this.goTo(this.state.index + 1);
  }

  public previous(): void {
    this.goTo(this.state.index - 1);
  }

  public goTo(index: number): void {
    this.state = createState(
      this.state.steps,
      this.state.active,
      clamp(index, 0, Math.max(this.state.steps.length - 1, 0))
    );
    this.notify();
  }

  public getState(): TourState {
    return {
      active: this.state.active,
      index: this.state.index,
      steps: [...this.state.steps],
      current: this.state.current,
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

export const ITourService = DI.createInterface<ITourService>('ITourService', x => x.singleton(TourService));
export interface ITourService extends TourService {}

function createState(steps: TourStep[], active: boolean, index: number): TourState {
  return {
    active: active && steps.length > 0,
    index,
    steps: [...steps],
    current: steps[index] ?? null,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
