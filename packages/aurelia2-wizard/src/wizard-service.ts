import { DI } from 'aurelia';
import type { WizardConfigurationOptions, WizardState, WizardStep } from './types';

export class WizardService {
  public options: Required<WizardConfigurationOptions> = {
    nextLabel: 'Next',
    previousLabel: 'Back',
    completeLabel: 'Complete',
    linear: true,
  };

  public configure(options: WizardConfigurationOptions = {}): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  public createState(
    steps: WizardStep[],
    index = 0,
    completed: string[] = []
  ): WizardState {
    const numericIndex = Number(index);
    const requestedIndex = Number.isNaN(numericIndex) ? 0 : Math.trunc(numericIndex);
    const eligible = steps.flatMap((step, candidate) => step.disabled ? [] : [candidate]);
    const lastIndex = eligible.at(-1);
    const activeIndex = eligible.find((candidate) => candidate >= requestedIndex) ?? lastIndex;

    return {
      steps: [...steps],
      index: activeIndex ?? 0,
      completed: [...completed],
      activeStep: activeIndex === undefined ? null : steps[activeIndex],
      canGoNext: activeIndex !== lastIndex,
      canGoPrevious: activeIndex !== eligible[0],
    };
  }

  public nextIndex(state: WizardState): number {
    for (let index = state.index + 1; index < state.steps.length; index += 1) {
      if (!state.steps[index].disabled) return index;
    }
    return state.index;
  }

  public previousIndex(state: WizardState): number {
    for (let index = state.index - 1; index >= 0; index -= 1) {
      if (!state.steps[index].disabled) return index;
    }
    return state.index;
  }

  public canEnter(state: WizardState, index: number, linear = this.options.linear): boolean {
    const step = state.steps[index];
    if (!step || step.disabled) return false;
    if (!linear) return true;
    if (index <= state.index) return true;

    return state.steps.slice(0, index).every((entry) => {
      return entry.optional || entry.disabled || state.completed.includes(entry.id);
    });
  }

  public markCompleted(state: WizardState, step = state.activeStep): string[] {
    if (!step || step.disabled || state.completed.includes(step.id)) {
      return state.completed;
    }
    return [...state.completed, step.id];
  }
}

export const IWizardService = DI.createInterface<IWizardService>('IWizardService', x => x.singleton(WizardService));
export interface IWizardService extends WizardService {}
