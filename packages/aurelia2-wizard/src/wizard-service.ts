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
    const enabledSteps = steps.filter((step) => !step.disabled);
    const safeIndex = clamp(index, 0, Math.max(steps.length - 1, 0));
    const activeStep = steps[safeIndex] ?? enabledSteps[0] ?? null;

    return {
      steps: [...steps],
      index: safeIndex,
      completed: [...completed],
      activeStep,
      canGoNext: safeIndex < steps.length - 1,
      canGoPrevious: safeIndex > 0,
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
    if (!step || state.completed.includes(step.id)) {
      return state.completed;
    }
    return [...state.completed, step.id];
  }
}

export const IWizardService = DI.createInterface<IWizardService>('IWizardService', x => x.singleton(WizardService));
export interface IWizardService extends WizardService {}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
