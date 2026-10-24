# aurelia2-url-state

Keep filters, search terms, pagination, tabs, and other view state in a shareable URL. Typed parameter definitions validate incoming values, choose defaults, debounce writes, and decide which changes create history entries.

```ts
import Aurelia from 'aurelia';
import { AureliaUrlStateConfiguration, param } from 'aurelia2-url-state';
Aurelia.register(AureliaUrlStateConfiguration);

export class Search {
  filters = { q: '', page: 1, status: 'all', tags: [] as string[] };
  params = {
    q: param.string({ debounce: 250 }),
    page: param.int({ min: 1, history: 'push' }),
    status: param.enum(['all', 'open', 'closed']),
    tags: param.list(param.string()),
  };
}
```

```html
<section url-state="model.bind: filters; params.bind: params; handle.from-view: state">
  <input value.bind="filters.q" aria-label="Search">
  <button click.trigger="filters.page = filters.page + 1">Next page</button>
</section>
```

URL values are applied during binding, before the view attaches. The initial model supplies defaults unless a parameter defines `default`. Default values are omitted from the URL. Invalid incoming values fall back to the default and are corrected with a replacement history entry. Unknown query keys are preserved. Repeated list values use `?tags=a&tags=b`.

The attribute disconnects on unbinding, cancels pending writes, and reconnects when its model or parameter map is replaced. Replace nested custom values and `Date` objects to signal edits; primitive changes and list array mutations are observed.

## Aurelia router

Applications using `@aurelia/router` must register the router adapter. Importing the main package alone does not load the optional router dependency.

```ts
import { RouterConfiguration } from '@aurelia/router';
import { AureliaUrlStateConfiguration } from 'aurelia2-url-state';
import { RouterUrlStateAdapter } from 'aurelia2-url-state/router';

Aurelia.register(
  RouterConfiguration,
  AureliaUrlStateConfiguration.configure({ adapter: RouterUrlStateAdapter }),
);
```

Set the correct `<base href="/">` (or application subdirectory) in the document, as required by the router. The adapter updates queries through the router, preserving nested and sibling viewport instructions, fragments, and the router's history policy. The router may canonicalize paths to include viewport names. Query-only writes reuse routed components and do not repeat their loading hooks. Incoming queries are read from the route tree during activation. Back/Forward also works when the router ignores a navigation because only its query differs.

Pending edits are cancelled when an external navigation starts. A rejected or failed write restores values from the URL and reports an error. The default history adapter refuses to run with a registered router; `ignoreRouter: true` is an explicit opt-out for applications whose router does not own query state.

## Parameters

Builders are `param.string`, `number`, `int`, `boolean`, `enum`, `date`, `datetime`, `list`, and `custom`. All accept the applicable `default`, `key`, `debounce` (milliseconds), and `history: 'replace' | 'push'` options. Replacement is the default. Use push for discrete navigation such as pages or tabs, and replacement for typing.

Strings accept `maxLength` (default 1,000). Numbers and integers accept `min` and `max`. Dates are UTC calendar dates serialized as `YYYY-MM-DD`; datetimes are instants serialized as ISO timestamps. Both accept date bounds. Lists accept a scalar parameter and `maxItems` (default 50); invalid incoming entries are dropped. Set history/default/debounce options on the list, not its item.

Custom parameters supply `parse(raw)`, `serialize(value)`, optional `validate(value)`, and `maxLength` (default 2,000). Throw or return `undefined` from parse to reject a value. Validate structured data against an application schema; JSON parsing alone is not validation. `examples/workspace-lab` uses the filter-builder parser for a saved filter document.

Do not store secrets in query parameters. URLs appear in browser history and may be copied, logged, or sent as referrers. Keep values small enough for the browsers and servers your application uses.

## Service and adapters

```ts
import { resolve } from 'aurelia';
import { IUrlState, param } from 'aurelia2-url-state';

export class Results {
  private readonly urls = resolve(IUrlState);
  view = { page: 1 };
  handle = this.urls.connect(this.view, { page: param.int({ min: 1 }) });
  unbinding() { this.handle.dispose(); }
}
```

Each query key has one owner per app container. Shell and route models can own different keys without overwriting each other. Duplicate ownership and unsafe property names throw. Dispose manual connections when their view is no longer used; recreate them in `binding` if the same instance can bind again.

Handles expose pending/error/disposed state, refresh/flush operations, subscriptions, and disposal. `IUrlState.settled()` waits for pending work; `sync()` rereads URL changes made outside the adapter. `dispose()` disconnects all models and permits later connections.

`url-state-apply`, `url-state-commit`, and `url-state-error` bubble from the attribute with the corresponding `UrlStateEvent` detail. Use the error event to report rejected navigation or serialization failures.

`MemoryUrlStateAdapter` supports embedded views, tests, and server requests. Construct one per request, seed it with the query, and register it with `configure({ adapter })`. The history adapter is inert when the platform has no browser history. Custom adapters implement `read`, `write`, and `subscribe`, with optional `busy` and `dispose`; see the exported `UrlStateAdapter` contract for event semantics.
