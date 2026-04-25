export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  content?: string;
  optional?: boolean;
  disabled?: boolean;
}

export interface WizardState {
  steps: WizardStep[];
  index: number;
  completed: string[];
  activeStep: WizardStep | null;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

export interface WizardConfigurationOptions {
  nextLabel?: string;
  previousLabel?: string;
  completeLabel?: string;
  linear?: boolean;
}

export interface WizardStepDetail {
  index: number;
  step: WizardStep | null;
  completed: string[];
}
