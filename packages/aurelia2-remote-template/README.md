# aurelia2-remote-template

Load application-owned HTML fragments from a server and compile their Aurelia bindings against an explicit context. Useful for CMS-controlled layouts, tenant-specific screens, and server-selected UI fragments.

Aurelia's `au-compose` handles compilation and component lifecycle. This package adds source restrictions, HTTP checks, an LRU cache, cancellation, and protection against stale responses.

```sh
npm install aurelia2-remote-template
```

Requires Aurelia `2.0.0-rc.2` or a compatible 2.x release with the runtime template compiler. An AOT-only build cannot compile arbitrary server responses.

## Register and render

```ts
import Aurelia from 'aurelia';
import { AureliaRemoteTemplateConfiguration } from 'aurelia2-remote-template';

Aurelia.register(AureliaRemoteTemplateConfiguration.configure({
  allowedOrigins: ['https://templates.example.com'],
  ttl: 60_000,
  capacity: 32,
  maxBytes: 256_000,
  timeout: 15_000,
}));
```

```html
<au-remote-template
  src.bind="templateUrl"
  context.bind="screen"
  pending.from-view="isLoading"
  error.from-view="loadError"
  component.ref="fragment">
  <p au-slot="loading">Loading screen…</p>
  <p au-slot="error">This screen couldn't be loaded.</p>
</au-remote-template>
<button click.trigger="fragment.reload()">Reload</button>
```

A response such as `<button click.trigger="save()">Save ${name}</button>` binds to `screen.save` and `screen.name`. Keep callback functions bound to the object they use. Custom elements and converters must already be registered in the application. `context` is an object, not a module name.

## Trust boundary

Templates are executable application code. Only fetch HTML authored by people who can already ship code to your app. Do not pass user comments, uploaded HTML, or untrusted CMS content through this component. Neither an origin check nor an isolated binding context is a sandbox or HTML sanitizer.

The default allowlist is empty. HTTP(S) URLs must match a configured origin exactly; credentials embedded in URLs are rejected. Relative URLs resolve against the document base URI. Redirects are rejected, credentials use `same-origin`, and responses must be successful with a `text/html` content type. Cross-origin servers need appropriate CORS headers.

## Loading and cache behavior

- Changing `src` aborts the previous request and clears its view. Late responses cannot replace the current view.
- Removing the component aborts its request. `settled` exposes the current load promise; HTTP failures are recorded in `error` rather than rejecting that promise.
- `reload()` rechecks the cache. To force a network refresh, clear the service cache first.
- `timeout` bounds the request and body read in milliseconds (default 15,000; zero disables it). Timeouts populate `error` and clear `pending`.
- Successful responses are cached by normalized URL. `capacity` limits entries; `ttl` is milliseconds. Set either to zero to disable caching. Concurrent cache misses make independent requests so each consumer owns its cancellation. An older response cannot overwrite the cache after a newer request for the same URL.
- `maxBytes` is enforced while reading a streamed response. Oversized bodies are cancelled before the remaining chunks are consumed; UTF-8 characters split across chunks are decoded correctly. Response-like test adapters without a body stream use a text-size check.
- A custom `fetch` can be configured for authentication or tests. It must honour the redirect policy. Honour the abort signal to stop underlying work; callers still settle on cancellation if an adapter ignores it.

```ts
import { resolve } from 'aurelia';
import { IRemoteTemplates } from 'aurelia2-remote-template';

export class Session {
  private readonly templates = resolve(IRemoteTemplates);
  logout() {
    this.templates.clear();
  }
}
```

Clear cached HTML on logout or tenant changes if template responses contain personalized markup. Clearing also prevents older in-flight requests from repopulating the cache. Templates are parsed with Aurelia's runtime compiler before publication. Malformed expressions populate `error` without inserting the fragment. Errors thrown later by application component constructors or lifecycle hooks still belong to Aurelia's application error handling.

## Development

From the repository root: `npm run build -w aurelia2-remote-template` and `npm test -w aurelia2-remote-template -- --runInBand`.
