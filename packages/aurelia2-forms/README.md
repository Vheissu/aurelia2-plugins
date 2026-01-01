# aurelia2-forms

Form state and validation helpers for Aurelia 2. Provides:
- `<au-form>` custom element
- `au-field` custom attribute
- `FormController` + `FieldState` models
- Built-in validators
- Integration with `@aurelia/validation`

## Install

```
npm install aurelia2-forms
```

`@aurelia/validation` is a dependency of this package; register its configuration
when you want rule-based validation.

## Register

```ts
import { AureliaFormsConfiguration } from 'aurelia2-forms';
import { ValidationConfiguration } from '@aurelia/validation';

Aurelia.register(AureliaFormsConfiguration, ValidationConfiguration);
```

## Quick start

```html
<au-form submit.call="save($event)" form.bind="form">
  <input
    name="email"
    au-field="value.bind: email; validators.bind: [required(), email()]"
  />
  <button type="submit">Save</button>
</au-form>
```

```ts
import { FormController, required, email } from 'aurelia2-forms';

export class Page {
  email = '';
  form: FormController | null = null;

  save({ value }: { value: Record<string, unknown> }) {
    console.log(value);
  }
}
```

## `<au-form>` API

Bindings:
- `submit.call` or `submit.bind`: callback invoked after validation
- `validate-on-submit.bind` (default `true`): run `form.validate()` on submit
- `form.bind`: two-way binding to the `FormController`
- `validation-model.bind`: object to validate with `@aurelia/validation`
- `validation-object-tag.bind`: optional tag for ruleset selection

`submit` receives `{ form, value, event }`.

`<au-form>` registers the `FormController` in DI so nested components can inject it:

```ts
import { IFormController } from 'aurelia2-forms';

export class Child {
  constructor(@IFormController private readonly form) {}
}
```

## `au-field` API

`au-field` wires an input to a `FieldState` and synchronizes value + validation.

Bindings:
- `value.bind`: two-way field value
- `validators.bind`: array of validator functions
- `validate-on.bind`: `'submit' | 'change' | 'blur'` (default `submit`)
- `form.bind`: attach to a specific form (optional)
- `validation-model.bind`: override validation model (optional)
- `validation-property.bind`: property name for rule-based validation (optional)

The field name defaults to the element's `name` attribute, then `id`, then `"field"`.
You can also set `au-field="fieldName"` if you want to set it explicitly.

Example:

```html
<input
  name="firstName"
  au-field="value.bind: person.firstName; validate-on.bind: 'change'"
/>
```

## Built-in validators

- `required()`
- `email()`
- `minLength(n)` / `maxLength(n)`
- `min(n)` / `max(n)`
- `pattern(regex)`

Custom validators are simple functions:

```ts
import type { ValidatorFn } from 'aurelia2-forms';

const startsWithA: ValidatorFn<string> = (value) =>
  value?.startsWith('A') ? null : 'Must start with A';
```

## FormController

`FormController` tracks aggregate state.

- `validate()` -> `Promise<boolean>`
- `reset()`
- `value` (object of field values)
- `valid` (boolean)
- `errors` (map of field -> string[])
- `getField(name)`

## FieldState

`FieldState` exposes:
- `value`, `touched`, `dirty`, `errors`, `valid`
- `validate()`
- `reset()`

## @aurelia/validation integration

If you register `ValidationConfiguration` and pass a `validation-model`, field
validation will also run Aurelia validation rules (in addition to local validators).

```ts
import { IValidationRules } from '@aurelia/validation';

validationRules.on(person).ensure('email').required();
```

```html
<au-form validation-model.bind="person" form.bind="form">
  <input name="email" au-field="value.bind: person.email" />
</au-form>
```

If the field name does not match the model property, use `validation-property`:

```html
<input
  name="emailAddress"
  au-field="value.bind: person.email"
  validation-property.bind="'email'"
/>
```
