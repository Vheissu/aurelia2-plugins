# aurelia2-schema-form

Render forms from field definitions while keeping field markup in registered Aurelia templates. This fits settings editors and admin forms whose fields vary by tenant or entity type. It adds schema-to-view composition; it doesn't replace Aurelia's validation packages or the form-state API in `aurelia2-forms`.

```sh
npm install aurelia2-schema-form
```

```ts
import Aurelia from 'aurelia';
import { AureliaSchemaFormConfiguration, type SchemaField } from 'aurelia2-schema-form';

Aurelia.register(AureliaSchemaFormConfiguration);

export class Profile {
  model = { name: '', email: '', newsletter: false };
  fields: SchemaField[] = [
    { key: 'name', type: 'text', label: 'Name', required: true },
    { key: 'newsletter', type: 'checkbox', label: 'Email updates' },
    {
      key: 'email', type: 'email', label: 'Email', required: true,
      visible: model => model.newsletter === true,
    },
  ];
  save(model: Record<string, unknown>) { /* send to your API */ }
  showErrors(errors: Record<string, string>) { /* show a form-level summary */ }
}
```

```html
<au-schema-form schema.bind="fields" model.bind="model"
  schema-submit.trigger="save($event.detail.model)"
  schema-invalid.trigger="showErrors($event.detail.errors)">
  <button type="submit">Save profile</button>
</au-schema-form>
```

The default slot replaces the submit button. The component owns its `<form>`; don't nest it inside another form.

## Fields and validation

Keys are literal top-level model properties. Empty, duplicate, and prototype-mutating keys are rejected. Use a flat model or a registered renderer to adapt nested structures. Initialize the model's expected properties before binding; replace the model when its shape changes.

Built-in types are `text`, `email`, `number`, `textarea`, `checkbox`, and `select`. Number inputs bind `valueAsNumber`; `null` and `undefined` render blank while zero stays visible; an empty number input produces `NaN` and is valid for an optional field. Required number fields reject it. Boolean and whitespace values are not accepted as numbers. Select fields use `options: [{ label, value }]` with string values. Labels are text bindings, so schema text is never interpolated into template source.

Fields accept `required`, `disabled`, `visible(model)`, and a synchronous `validate(value, model)` callback returning an error string or `undefined`. Hidden and disabled fields are excluded from validation and keep their values. Visibility predicates use Aurelia's computed-method observation and can depend on initialized model properties. Keep them pure.

Validation runs on blur/change and submit. Once a field has been touched or submitted, its error updates as values or cross-field dependencies change. Untouched fields do not display errors prematurely. `validate()` is also available through `component.ref`; it returns a boolean and updates field errors. Submission prevents navigation, focuses the first invalid built-in control, and emits either `schema-submit` or `schema-invalid` with `{ model, errors }`. These events contain the live model, not a clone. Server validation remains necessary.

Replace the `schema` array when adding/removing fields or changing renderer types. Replacing the model rebuilds composition contexts and disconnects old bindings.

## Field constraints

Number fields support `min`, `max`, and a positive `step`, using `min` or zero as the step base. Decimal values are accepted by default. Text and textarea fields support non-negative integer `minLength` and `maxLength`; `placeholder` is also supported. These constraints are applied to native controls and checked by `validate()`, including programmatic model changes. Inverted or non-finite limits fail during schema setup.

Validators remain synchronous. Use an application submission handler or Aurelia's validation integration for asynchronous server checks.

## Register a renderer

```ts
Aurelia.register(AureliaSchemaFormConfiguration.configure({
  'long-text': {
    template: `<textarea id.bind="id" value.two-way="model[field.key]"
      disabled.bind="field.disabled" aria-invalid.bind="error ? 'true' : 'false'"
      aria-describedby.bind="error ? id + '-error' : null"
      blur.trigger="touch()"></textarea>`,
  },
}));
```

Each renderer receives a `FieldContext`: `field`, `model`, `id`, `error`, and `touch()`. The surrounding form provides the label and error text. Use the supplied ID on the focusable control and call `touch()` when it should be validated. Globally registered Aurelia resources can be used inside renderer templates.

`IFieldRenderers` exposes `get(type)` and `register(type, renderer)`. Registration returns an idempotent removal function. Existing type names cannot be overwritten. Renderer entries are copied and frozen per app container, so callers cannot mutate built-ins or registrations in another app. Configure custom types before mounting forms. Renderer templates are trusted application code; JSON schemas should choose registered types, never supply arbitrary template HTML.

Requires Aurelia `^2.0.0-rc.2`. Build with `npm run build -w aurelia2-schema-form`; test with `npm test -w aurelia2-schema-form -- --runInBand`.
