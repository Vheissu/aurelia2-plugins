import { observable } from 'aurelia';
import { ValidateInstruction } from '@aurelia/validation';
import type { ValidatorFn } from './validators';
import type { FieldValidationOptions, FormController } from './form-controller';

type ValidationResultLike = { valid: boolean; message?: string | undefined };

export class FieldState<T = unknown> {
  @observable public value: T;
  @observable public touched: boolean = false;
  @observable public dirty: boolean = false;
  @observable public errors: string[] = [];
  @observable public valid: boolean = true;

  public constructor(
    public readonly name: string,
    private readonly form: FormController,
    private readonly validators: ValidatorFn<T>[],
    initialValue: T,
    private readonly validation: FieldValidationOptions | null = null
  ) {
    this.value = initialValue;
  }

  public async validate(): Promise<boolean> {
    const errors: string[] = [];

    for (const validator of this.validators) {
      const result = await validator(this.value, this, this.form);
      if (typeof result === 'string' && result.length > 0) {
        errors.push(result);
      }
    }

    const validationContext = this.form.validationContext;
    if (validationContext?.validator) {
      const model = this.validation?.model ?? validationContext.model;
      const propertyName = this.validation?.propertyName ?? this.name;
      if (model && propertyName) {
        const instruction = new ValidateInstruction(
          model,
          propertyName,
          undefined,
          validationContext.objectTag
        );
        const results = await validationContext.validator.validate(instruction);
        for (const result of results as ValidationResultLike[]) {
          if (result && result.valid === false && result.message) {
            errors.push(result.message);
          }
        }
      }
    }

    this.errors = errors;
    this.valid = errors.length === 0;
    return this.valid;
  }

  public reset(value: T): void {
    this.value = value;
    this.touched = false;
    this.dirty = false;
    this.errors = [];
    this.valid = true;
  }
}
