# aurelia2-filter-builder

Build saved customer segments, report filters, and admin search forms from typed field definitions. The editor publishes a plain-data filter document; the same document can drive a local predicate or be sent to an API for server-side validation and translation.

This package edits queries. It does not fetch data like `aurelia2-query`, render a data table, or replace Aurelia validation.

```ts
import Aurelia from 'aurelia';
import { AureliaFilterBuilderConfiguration, compileFilter,
  type FilterDocument, type FilterField } from 'aurelia2-filter-builder';

Aurelia.register(AureliaFilterBuilderConfiguration);

export class Customers {
  fields: FilterField[] = [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'seats', label: 'Seats', type: 'number' },
    { key: 'plan', label: 'Plan', type: 'enum', options: [
      { value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' },
    ] },
  ];
  segment: FilterDocument = {
    version: 1,
    root: { kind: 'group', id: 'root', combinator: 'all', children: [] },
  };
  valid = true;
  preview() {
    if (this.valid) {
      const matches = compileFilter(this.segment, this.fields);
      // this.visibleCustomers = this.customers.filter(matches);
    }
  }
}
```

```html
<au-filter-builder fields.bind="fields" filter.two-way="segment"
  valid.from-view="valid" label="Customer segment" max-depth="4" max-conditions="40"
  filter-change.trigger="preview()"></au-filter-builder>
```

Groups use `all`, `any`, or `none`. Conditions have `{ kind: 'condition', id, field, operator, value? }`. IDs must be unique and nonempty. The editor creates IDs for added nodes; saved documents must retain them.

## Fields and operators

| Type | Operators |
| --- | --- |
| text | `eq`, `neq`, `contains`, `starts-with`, `ends-with` |
| number | `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `between` |
| date | `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `between` |
| boolean | `eq`, `neq` |
| enum | `eq`, `neq`, `any-of`, `none-of` |

All types also support `is-empty` and `is-not-empty`. Empty means missing, `null`, or the empty string. Comparisons require a value of the declared type; missing or malformed values do not satisfy `neq` or `none-of`. Text comparisons are case-sensitive. Dates are valid calendar strings in `YYYY-MM-DD` form; date-times and relative dates are not supported. Range bounds are inclusive. Enum membership uses an array of option values.

An empty root matches every record. Empty nested groups and unfinished conditions are invalid until completed or removed. Changing a field or operator resets its value. Fields are literal top-level record keys, including keys containing periods; there is no implicit path traversal. Replace `fields` when the schema changes. Removed-field conditions stay visible and invalid so a saved segment is not silently weakened.

## Validation and evaluation

- `parseFilter(input, fields, limits?)` accepts a JSON string or document and returns `{ filter, issues }`. `filter` is null when invalid.
- `validateFilter(input, fields, limits?)` returns issues with a code, message and node ID where available.
- `copyFilter(input, limits?)` checks and copies structural data while allowing unfinished condition values. It throws for malformed structure and for anything beyond the limits it is given.
- `compileFilter(input, fields, limits?)` validates, snapshots the document and definitions, and returns a predicate. It throws for invalid filters and never generates executable source.
- `describeFilter(input, fields, limits?)` returns a text summary or validation messages, using the same limits as validation.
- `structuralLimits(limits?)` returns the hard bounds used for structural copies (see below).

Predicates read only own record properties. Aurelia-observed own properties are supported; a throwing data getter produces a nonmatch. Plain-data documents, finite scalar values, unique IDs and allowed field/operator combinations are required. Sparse arrays (children or values) and prototype-mutating field names are rejected.

Defaults limit depth to 6, conditions to 100, nodes to 200, value lists (`any-of`, `none-of`, `between`) to 100 entries (`maxValues`) and individual strings to 10,000 characters. Nodes, value-list length and string length are structural: exceeding them makes the document invalid (`invalid-document`). Depth is structurally capped at 32 and cannot be configured higher. `maxDepth` and `maxConditions` are policy limits: `parseFilter`, `validateFilter` and `compileFilter` report `depth-limit` and `condition-limit` issues instead of rejecting the structure, so an editor can still show a saved document after its limits are lowered. The JSON entrypoint also caps source length.

Validation here does not authorize backend queries. Translate the document through an allowlist on the server and enforce access rules there. No SQL, OData, Mongo or Elasticsearch serializer is included.

## Editing and events

`filter` is two-way; `valid` and `issues` are from-view outputs. `disabled` accepts bare syntax, boolean binding, and `disabled="false"`. `max-depth` and `max-conditions` constrain the editor. Fieldsets, labels, live announcements and focus after structural edits are included.

Each edit proposes a copied document in cancellable `filter-before-change`. Calling `preventDefault()` rejects it. A successful edit publishes a new document and emits `filter-change`; both events contain `{ filter, valid, issues }`. Source replacement or in-place changes during a before-change handler cancel the stale edit. Event payloads are separate copies of the committed document. When an edit is cancelled, goes stale, or exceeds a structural limit (for example a string over the length limit), nothing is published, the edited control is restored to the committed value, and the live region announces why.

External documents can be incomplete; the view reports issues instead of dropping conditions. A document over `max-depth` or `max-conditions` stays visible with `depth-limit` or `condition-limit` issues: Add is disabled while it is over a limit, and removing items makes it valid again. A group is only added when there is depth and condition budget for its first condition. Documents beyond the structural bounds, or malformed ones, display an error. Treat bound documents as immutable and replace them for external changes.

Until `fields` is bound to an array (for example while a schema loads and the binding is `undefined`), the document stays visible, Add is disabled, and `issues` contains `fields-unavailable`, so `valid` is false. Invalid field definitions display an error instead of the editor.

## Custom value editors

Register a field-specific editor before mounting the view:

```ts
Aurelia.register(AureliaFilterBuilderConfiguration.configure({
  seats: {
    template: `<button type="button" click.trigger="setValue(25)">25 seats</button>`,
  },
}));
```

The composed context contains `field` (undefined when the condition's field is not defined), `condition`, and `setValue(value, control?)`. Call `setValue`; do not mutate `condition`. `setValue` returns `true` when the edit was published and `false` when it was cancelled or invalid. Pass the originating control, as in `input.trigger="setValue($event.target.value, $event.target)"`, so a rejected value is written back to that input, textarea, select, checkbox or radio. The context object is stable for a condition ID while the view is bound, so the editor stays mounted (keeping focus and its own state) across edits; `condition` and `field` are reassigned after each committed edit and can be bound normally. Custom editors change presentation, while field types and validation retain their documented semantics. Templates are trusted application code. `IFilterEditors.register(key, editor)` returns an idempotent unregister function; duplicate registrations are rejected and entries are copied/frozen per application container. Registry changes are intended for startup configuration.

Requires Aurelia `^2.0.0-rc.2`. Run `npm run build -w aurelia2-filter-builder`, `npm test -w aurelia2-filter-builder -- --runInBand`, and `npm run lint -w aurelia2-filter-builder`.
