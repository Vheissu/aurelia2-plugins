import { bindable, BindingMode, customElement, INode, resolve } from 'aurelia';
import { IWizardService } from './wizard-service';
import type { WizardState, WizardStep, WizardStepDetail } from './types';
import template from './au-wizard.html';

const identity = <T>(value: T): T => value;

@customElement({
  name: 'au-wizard',
  template,
})
export class AuWizardCustomElement {
  @bindable({ set: identity }) public steps: WizardStep[] = [];
  @bindable({ mode: BindingMode.twoWay }) public index = 0;
  @bindable({ mode: BindingMode.twoWay, set: identity }) public completed: string[] = [];
  @bindable public linear: boolean | null = null;
  @bindable public nextLabel: string | null = null;
  @bindable public previousLabel: string | null = null;
  @bindable public completeLabel: string | null = null;

  public state: WizardState = {
    steps: [],
    index: 0,
    completed: [],
    activeStep: null,
    canGoNext: false,
    canGoPrevious: false,
  };
  public activeStep: WizardStep = { id: '', title: '' };
  public previousLabelText = '';
  public nextLabelText = '';
  public enterable: boolean[] = [];
  public stepClasses: string[] = [];

  private readonly host = resolve(INode) as HTMLElement;
  private readonly wizard = resolve(IWizardService);
  private syncing = false;

  public binding(): void {
    this.recompute();
  }

  public stepsChanged(): void {
    this.recompute();
  }

  public indexChanged(): void {
    if (this.syncing) return;
    this.recompute();
  }

  public completedChanged(): void {
    if (this.syncing) return;
    this.recompute();
  }

  public linearChanged(): void {
    this.recompute();
  }

  public next(): void {
    this.completed = this.wizard.markCompleted(this.state);

    if (this.index >= this.steps.length - 1) {
      this.dispatch('wizard-complete');
      this.recompute();
      return;
    }

    this.index = this.wizard.nextIndex(this.state);
    this.recompute();
    this.dispatch('wizard-next');
  }

  public previous(): void {
    this.index = this.wizard.previousIndex(this.state);
    this.recompute();
    this.dispatch('wizard-previous');
  }

  public goTo(index: number): void {
    if (!this.canEnter(index)) return;
    this.index = index;
    this.recompute();
    this.dispatch('wizard-step');
  }

  public canEnter(index: number): boolean {
    return this.wizard.canEnter(this.state, index, this.linear ?? this.wizard.options.linear);
  }

  public stepClass(step: WizardStep, index: number): string {
    return [
      'au-wizard-step',
      index === this.index ? 'active' : '',
      this.completed.includes(step.id) ? 'completed' : '',
    ].filter(Boolean).join(' ');
  }

  private recompute(): void {
    this.state = this.wizard.createState(this.steps, this.index, this.completed);
    this.syncing = true;
    if (this.index !== this.state.index) {
      this.index = this.state.index;
    }
    if (!sameStrings(this.completed, this.state.completed)) {
      this.completed = this.state.completed;
    }
    this.syncing = false;
    this.activeStep = this.state.activeStep ?? { id: '', title: '' };
    this.enterable = this.state.steps.map((_, stepIndex) => this.canEnter(stepIndex));
    this.stepClasses = this.state.steps.map((step, stepIndex) => this.stepClass(step, stepIndex));
    this.previousLabelText = this.previousLabel ?? this.wizard.options.previousLabel;
    this.nextLabelText = this.index >= this.steps.length - 1
      ? this.completeLabel ?? this.wizard.options.completeLabel
      : this.nextLabel ?? this.wizard.options.nextLabel;
  }

  private dispatch(name: string): void {
    const detail: WizardStepDetail = {
      index: this.index,
      step: this.state.activeStep,
      completed: [...this.completed],
    };
    this.host.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      detail,
    }));
  }
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
