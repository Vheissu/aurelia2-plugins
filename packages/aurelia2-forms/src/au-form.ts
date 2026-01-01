import { bindable, BindingMode, customElement, inject } from 'aurelia';
import { IContainer, Registration } from '@aurelia/kernel';
import { IValidator, type IValidateable } from '@aurelia/validation';
import template from './au-form.html';
import { FormController, IFormController } from './form-controller';

export interface FormSubmitContext {
  form: FormController;
  value: Record<string, unknown>;
  event: SubmitEvent;
}

@customElement({
  name: 'au-form',
  template,
})
@inject(IContainer)
export class AuFormCustomElement {
  @bindable public submit?: (context: FormSubmitContext) => void;
  @bindable public validateOnSubmit: boolean = true;
  @bindable({ mode: BindingMode.twoWay }) public form: FormController | null = null;
  @bindable public validationModel: IValidateable | null = null;
  @bindable public validationObjectTag: string | null = null;

  private controller: FormController = new FormController();

  public constructor(private readonly container: IContainer) {}

  public binding(): void {
    if (this.form == null) {
      this.form = this.controller;
    }

    this.container.register(Registration.instance(IFormController, this.form));
    this.updateValidationContext();
  }

  public formChanged(): void {
    this.updateValidationContext();
  }

  public validationModelChanged(): void {
    this.updateValidationContext();
  }

  public validationObjectTagChanged(): void {
    this.updateValidationContext();
  }

  public async handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    this.updateValidationContext();

    if (this.validateOnSubmit) {
      const valid = await this.form?.validate();
      if (!valid) return;
    }

    this.submit?.({
      form: this.form as FormController,
      value: (this.form as FormController).value,
      event,
    });
  }

  private updateValidationContext(): void {
    if (!this.form) return;

    if (!this.validationModel) {
      this.form.setValidationContext(null);
      return;
    }

    if (this.container.has(IValidator, true)) {
      const validator = this.container.get(IValidator);
      this.form.setValidationContext({
        validator,
        model: this.validationModel,
        objectTag: this.validationObjectTag ?? undefined,
      });
      return;
    }

    this.form.setValidationContext(null);
  }
}
