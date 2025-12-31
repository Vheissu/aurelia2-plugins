# aurelia2-hooks

A WordPress-inspired hooks and filters system for Aurelia 2 applications.

## Install

```
npm install aurelia2-hooks
```

## Register

```ts
import { Aurelia } from 'aurelia';
import { AureliaHooksConfiguration } from 'aurelia2-hooks';

Aurelia.register(AureliaHooksConfiguration);
```

## Actions

Actions are fire-and-forget callbacks.

```ts
hooks.addAction('afterSave', (entityId: string) => {
  console.log(entityId);
});

hooks.doAction('afterSave', 'abc-123');
```

## Filters

Filters transform a value as it passes through the pipeline.

```ts
hooks.addFilter('slugify', (value: string) => value.toLowerCase());
hooks.addFilter('slugify', (value: string) => value.replace(/\s+/g, '-'));

const slug = hooks.applyFilter('slugify', 'Hello Aurelia');
```

Async filters are executed sequentially, awaiting each step.

```ts
hooks.addFilter('enrich', async (value: string) => `${value}-one`);
hooks.addFilter('enrich', async (value: string) => `${value}-two`);

const enriched = await hooks.applyFilterAsync('enrich', 'start');
```

## Priority

Lower priority runs first. Hooks with the same priority run in registration order.

```ts
hooks.addAction('load', () => console.log('second'));
hooks.addAction('load', () => console.log('first'), 5);
```
