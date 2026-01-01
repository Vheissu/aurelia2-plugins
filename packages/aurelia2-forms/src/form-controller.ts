import { DI } from '@aurelia/kernel';
import { observable } from 'aurelia';
import { FieldState } from './field-state';
import type { IValidateable, IValidator } from '@aurelia/validation';
import type { ValidatorFn } from './validators';

export interface FormFieldRegistration<T = unknown> {
  name: string;
  value: T;
  validators?: ValidatorFn<T>[];
  validation?: FieldValidationOptions | null;
}

export interface FormValidationContext {
  validator: IValidator;
  model: IValidateable;
  objectTag?: string;
}

export interface FieldValidationOptions {
  model?: IValidateable;
  propertyName?: string | null;
}

export class FormController {
  private readonly fields = new Map<string, FieldState>();

  @observable public valid: boolean = true;
  @observable public errors: Record<string, string[]> = {};
  public validationContext: FormValidationContext | null = null;

  public registerField<T>(registration: FormFieldRegistration<T>): FieldState<T> {
    const validators = registration.validators ?? [];
    const field = new FieldState<T>(registration.name, this, validators, registration.value, registration.validation ?? null);
    this.fields.set(registration.name, field);
    return field;
  }

  public unregisterField(name: string): void {
    this.fields.delete(name);
  }

  public getField<T>(name: string): FieldState<T> | undefined {
    return this.fields.get(name) as FieldState<T> | undefined;
  }

  public get value(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const [name, field] of this.fields.entries()) {
      data[name] = field.value;
    }
    return data;
  }

  public async validate(): Promise<boolean> {
    const results = await Promise.all(
      Array.from(this.fields.values()).map((field) => field.validate())
    );

    const errors: Record<string, string[]> = {};
    for (const [name, field] of this.fields.entries()) {
      if (!field.valid) {
        errors[name] = field.errors;
      }
    }

    this.errors = errors;
    this.valid = results.every(Boolean);
    return this.valid;
  }

  public reset(): void {
    for (const field of this.fields.values()) {
      field.reset(field.value);
    }
    this.errors = {};
    this.valid = true;
  }

  public setValidationContext(context: FormValidationContext | null): void {
    this.validationContext = context;
  }
}

export const IFormController = DI.createInterface<IFormController>('IFormController');
export interface IFormController extends FormController {}
