import type { FieldState } from './field-state';
import type { FormController } from './form-controller';

export type ValidatorFn<T = unknown> = (value: T, field: FieldState<T>, form: FormController) => string | null | Promise<string | null>;

export function required(message = 'This field is required'): ValidatorFn {
  return (value) => {
    if (value === null || value === undefined) return message;
    if (typeof value === 'string' && value.trim().length === 0) return message;
    if (Array.isArray(value) && value.length === 0) return message;
    return null;
  };
}

export function minLength(length: number, message?: string): ValidatorFn<string> {
  return (value) => {
    if (value == null) return null;
    return value.length < length ? (message ?? `Minimum length is ${length}`) : null;
  };
}

export function maxLength(length: number, message?: string): ValidatorFn<string> {
  return (value) => {
    if (value == null) return null;
    return value.length > length ? (message ?? `Maximum length is ${length}`) : null;
  };
}

export function min(minValue: number, message?: string): ValidatorFn<number> {
  return (value) => {
    if (value == null) return null;
    return value < minValue ? (message ?? `Minimum value is ${minValue}`) : null;
  };
}

export function max(maxValue: number, message?: string): ValidatorFn<number> {
  return (value) => {
    if (value == null) return null;
    return value > maxValue ? (message ?? `Maximum value is ${maxValue}`) : null;
  };
}

export function pattern(regex: RegExp, message = 'Invalid format'): ValidatorFn<string> {
  return (value) => {
    if (value == null || value === '') return null;
    return regex.test(value) ? null : message;
  };
}

export function email(message = 'Invalid email address'): ValidatorFn<string> {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern(regex, message);
}
