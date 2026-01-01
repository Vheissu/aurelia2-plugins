import { bindable, BindingMode, customAttribute, inject, INode } from 'aurelia';
import { IContainer } from '@aurelia/kernel';
import { FormController, IFormController } from './form-controller';
import { FieldState } from './field-state';
import type { IValidateable } from '@aurelia/validation';
import type { ValidatorFn } from './validators';

export type ValidateOn = 'change' | 'blur' | 'submit';

@customAttribute('au-field')
@inject(INode, IContainer)
export class AuFieldCustomAttribute {
  @bindable({ primary: true }) public name: string | null = null;
  @bindable({ mode: BindingMode.twoWay }) public value: unknown = undefined;
  @bindable public validators: ValidatorFn[] = [];
  @bindable public validateOn: ValidateOn = 'submit';
  @bindable public form: FormController | null = null;
  @bindable public validationModel: IValidateable | null = null;
  @bindable public validationProperty: string | null = null;

  private field: FieldState | null = null;
  private handlingInput = false;

  public constructor(private readonly element: HTMLElement, private readonly container: IContainer) {}

  public binding(): void {
    if (!this.name) {
      this.name = this.element.getAttribute('name') ?? this.element.id ?? 'field';
    }

    const form = this.form ?? this.tryResolveForm();
    this.form = form;

    const validation = this.createValidationConfig(form);
    this.field = form.registerField({
      name: this.name,
      value: this.value as unknown,
      validators: this.validators,
      validation,
    });

    if (this.value === undefined) {
      this.value = this.readElementValue();
    }

    this.writeElementValue(this.value);
  }

  public attached(): void {
    this.element.addEventListener('input', this.onInput);
    this.element.addEventListener('change', this.onInput);
    this.element.addEventListener('blur', this.onBlur, true);
  }

  public detached(): void {
    this.element.removeEventListener('input', this.onInput);
    this.element.removeEventListener('change', this.onInput);
    this.element.removeEventListener('blur', this.onBlur, true);

    if (this.field && this.form) {
      this.form.unregisterField(this.field.name);
    }
  }

  public valueChanged(newValue: unknown): void {
    if (!this.field || this.handlingInput) return;

    if (newValue !== this.field.value) {
      this.field.value = newValue;
      this.field.dirty = true;
    }

    this.writeElementValue(newValue);

    if (this.validateOn === 'change') {
      void this.field.validate();
    }
  }

  private onInput = (): void => {
    this.handlingInput = true;
    const newValue = this.readElementValue();
    this.value = newValue;

    if (this.field) {
      this.field.value = newValue;
      this.field.dirty = true;
      if (this.validateOn === 'change') {
        void this.field.validate();
      }
    }

    this.handlingInput = false;
  };

  private onBlur = (): void => {
    if (!this.field) return;
    this.field.touched = true;
    if (this.validateOn === 'blur') {
      void this.field.validate();
    }
  };

  private tryResolveForm(): FormController {
    if (this.container.has(IFormController, true)) {
      return this.container.get(IFormController) as FormController;
    }

    return new FormController();
  }

  private createValidationConfig(form: FormController) {
    const model = this.validationModel ?? form.validationContext?.model ?? null;
    const propertyName = this.validationProperty ?? this.name ?? null;

    if (!model && !propertyName) {
      return null;
    }

    return {
      model: model ?? undefined,
      propertyName,
    };
  }

  private readElementValue(): unknown {
    if (this.element instanceof HTMLInputElement) {
      if (this.element.type === 'checkbox') {
        return this.element.checked;
      }
      if (this.element.type === 'radio') {
        return this.element.checked ? this.element.value : null;
      }
      return this.element.value;
    }

    if (this.element instanceof HTMLSelectElement) {
      if (this.element.multiple) {
        return Array.from(this.element.selectedOptions).map(option => option.value);
      }
      return this.element.value;
    }

    if (this.element instanceof HTMLTextAreaElement) {
      return this.element.value;
    }

    return (this.element as any).value ?? null;
  }

  private writeElementValue(value: unknown): void {
    if (this.element instanceof HTMLInputElement) {
      if (this.element.type === 'checkbox') {
        this.element.checked = Boolean(value);
        return;
      }
      if (this.element.type === 'radio') {
        this.element.checked = this.element.value === String(value);
        return;
      }
      this.element.value = value == null ? '' : String(value);
      return;
    }

    if (this.element instanceof HTMLSelectElement) {
      if (this.element.multiple && Array.isArray(value)) {
        const values = new Set(value.map(String));
        for (const option of Array.from(this.element.options)) {
          option.selected = values.has(option.value);
        }
        return;
      }
      this.element.value = value == null ? '' : String(value);
      return;
    }

    if (this.element instanceof HTMLTextAreaElement) {
      this.element.value = value == null ? '' : String(value);
      return;
    }

    (this.element as any).value = value;
  }
}
