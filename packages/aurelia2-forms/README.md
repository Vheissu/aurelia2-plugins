# aurelia2-forms

A simple forms plugin for Aurelia 2 with form state and validation helpers.

## Install

```
npm install aurelia2-forms
```

## Usage

Register the plugin:

```ts
import { AureliaFormsConfiguration } from 'aurelia2-forms';

Aurelia.register(AureliaFormsConfiguration);
```

### `<au-form>` and `au-field`

```html
<au-form submit.call="save($event)" form.bind="form">
  <input
    name="email"
    au-field="value.bind: email; validators.bind: [required(), email()]"
  />
  <button type="submit">Save</button>
</au-form>
```

The `FormController` is exposed via `form.bind` and provides:
- `validate()`
- `reset()`
- `valid`, `errors`, `value`

### Validators

Built-in helpers:
- `required()`, `email()`, `minLength(n)`, `maxLength(n)`, `min(n)`, `max(n)`, `pattern(regex)`

You can also provide custom validator functions.

### @aurelia/validation integration

You can opt-in to Aurelia validation rules by providing a validation model.
This activates when `ValidationConfiguration` is registered.

```ts
import { ValidationConfiguration, IValidationRules } from '@aurelia/validation';
import { ExpressionParser } from '@aurelia/expression-parser';

Aurelia.register(AureliaFormsConfiguration, ExpressionParser, ValidationConfiguration);

const validationRules = container.get(IValidationRules);
validationRules.on(person).ensure('email').required();
```

```html
<au-form form.bind="form" validation-model.bind="person" submit.call="save($event)">
  <input name="email" au-field="value.bind: person.email" />
</au-form>
```

By default, rules run alongside any `validators.bind` you provide. Use `validation-property` on `au-field`
if the field name differs from the model property.
