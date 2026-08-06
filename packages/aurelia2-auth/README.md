# aurelia2-auth

Authentication and client-side authorization for Aurelia 2. It handles bearer tokens, cookie sessions, API keys, OAuth/OIDC, refresh races, router guards and authorization-aware views without tying the app to one backend shape.

Server checks still decide whether a request is allowed. The guards, decorators and attributes in this package keep the browser UI honest; they aren't a security boundary.

## Install

```sh
npm install aurelia2-auth
```

`@aurelia/router` is an optional peer dependency. Install it when the app uses the router guard.

## Register the plugin

```ts
import Aurelia from 'aurelia';
import { AureliaAuthConfiguration } from 'aurelia2-auth';

Aurelia
  .register(AureliaAuthConfiguration.configure({
    baseUrl: 'https://api.example.com',
    trustedOrigins: ['https://api.example.com'],
  }))
  .app(MyApp)
  .start();
```

The default mode is `bearer`. Tokens are kept in `sessionStorage`, the authorization header is `Bearer`, and redirects are opt-in. Requests only receive credentials when their origin appears in `trustedOrigins`.

Resolve the service where it's needed:

```ts
import { resolve } from 'aurelia';
import { IAuthService } from 'aurelia2-auth';

export class LoginPage {
  private readonly auth = resolve(IAuthService);

  public login(email: string, password: string) {
    return this.auth.login({ email, password });
  }
}
```

## Authentication modes

### Bearer tokens

The login response can contain `access_token`, `id_token`, `refresh_token`, `expires_in` and `scope`. Property names and nested response roots are configurable.

```ts
AureliaAuthConfiguration.configure({
  mode: 'bearer',
  loginUrl: '/auth/login',
  tokenRoot: 'tokens',
  responseTokenProp: 'access_token',
  refreshTokens: true,
  refreshUrl: '/auth/refresh',
});
```

Opaque access tokens work too. If the response includes `expires_in` or `expires_at`, the plugin uses it for expiry and automatic refresh.

### Cookie sessions

Use `cookie` mode for an HTTP-only session or a backend-for-frontend setup. The browser never needs to read the session cookie.

```ts
AureliaAuthConfiguration.configure({
  mode: 'cookie',
  withCredentials: true,
  autoInitialize: true,
  sessionUrl: '/auth/session',
  loginUrl: '/auth/login',
  logoutUrl: '/auth/logout',
});
```

`autoInitialize` checks `sessionUrl` as the app starts. A successful login or session response can include a `user` or `profile` property.

For browser-based OAuth apps, a backend-for-frontend is the strongest default when the deployment can support one. The IETF's browser app guidance explains the trade-offs between backend and browser-held tokens: [RFC 10017](https://www.rfc-editor.org/rfc/rfc10017.html).

### API keys

```ts
AureliaAuthConfiguration.configure({
  mode: 'api-key',
  apiKey: () => currentApiKey,
  apiKeyHeader: 'X-API-Key',
  trustedOrigins: ['https://api.example.com'],
});
```

### Custom request signing

`custom` mode leaves the request format to the app. This is the extension point for DPoP proofs, vendor signatures or another request-bound credential.

```ts
AureliaAuthConfiguration.configure({
  mode: 'custom',
  trustedOrigins: ['https://api.example.com'],
  async transformRequest({ request, accessToken, session }) {
    request.headers.set('X-Custom-Auth', await signRequest(request, accessToken, session));
    return request;
  },
});
```

## Refresh and request replay

Refresh calls are single-flight. If five requests notice an expired token together, one refresh request runs and the other callers await it. A 401 response can refresh and replay its original request once, including a clone of a POST body.

```ts
AureliaAuthConfiguration.configure({
  refreshTokens: true,
  refreshOnUnauthorized: true,
  autoRefresh: true,
  autoRefreshBuffer: 60,
});
```

Refresh endpoints are marked so they can't recursively trigger refresh. A rejected refresh with status 400, 401 or 403 clears the local session; a network failure doesn't.

## OAuth 2.0 and OpenID Connect

Authorization Code with S256 PKCE is the default. Every transaction gets cryptographic `state`; OpenID Connect providers also get a one-time `nonce`. Discovery documents are fetched once and cached by URL.

Provider presets supply public endpoints and sensible scopes, but they don't supply a `clientId`. Override only what the app owns:

```ts
AureliaAuthConfiguration.configure({
  baseUrl: 'https://api.example.com',
  trustedOrigins: ['https://api.example.com'],
  providers: {
    google: {
      name: 'google',
      clientId: 'your-browser-client-id',
      redirectUri: 'https://app.example.com/auth/callback',
      url: '/auth/google',
      display: 'redirect',
      exchange: 'backend',
    },
  },
});
```

Start the flow:

```ts
await auth.authenticate('google');
```

Complete it on the callback route:

```ts
await auth.completeOAuthCallback(window.location.href, 'google');
```

`exchange: 'backend'` posts the code, PKCE verifier and redirect URI to the configured provider `url`. Client secrets stay on the server. Public clients can use `exchange: 'direct'` with a CORS-enabled `tokenEndpoint`; the plugin sends form-encoded OAuth parameters and never accepts a client secret.

Popup flows use the same transaction checks:

```ts
providers: {
  google: {
    name: 'google',
    clientId: 'your-browser-client-id',
    display: 'popup',
  },
}
```

The implicit flow remains available as `flow: 'implicit', exchange: 'none'` for an old provider that can't be moved yet. It isn't a preset. OAuth 1.0a is also explicit and server-assisted; signing secrets never enter the browser.

These defaults follow the OAuth security BCP: code flow, PKCE S256, one-time state and no implicit grant by default. See [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html).

## Router authorization

The plugin registers its `@aurelia/router` lifecycle hook. Routes can use modern TC39 class decorators:

```ts
import {
  authenticated,
  authorize,
  permissions,
  roles,
} from 'aurelia2-auth';

@authenticated()
export class AccountPage {}

@roles('admin')
@permissions('reports:read')
export class ReportsPage {}

@authorize({ policies: ['ownsInvoice'] })
export class InvoicePage {}
```

The available decorators are `@authenticated()`, `@anonymousOnly()`, `@roles(...)`, `@permissions(...)`, `@policy(...)`, `@claims(...)` and the general `@authorize(...)`. Decorators compose, so a class can state each concern separately.

Route data works when a shared route table is a better fit:

```ts
@route({
  routes: [
    {
      path: 'billing',
      component: import('./billing-page'),
      data: {
        authorization: {
          authenticated: true,
          roles: ['owner', 'billing'],
          match: 'any',
        },
      },
    },
  ],
})
export class MyApp {}
```

`data.auth: true`, `data.roles` and `data.permissions` are still understood for older route tables. Guards return router instructions rather than starting a nested navigation.

Set these routes to control guard redirects:

```ts
AureliaAuthConfiguration.configure({
  loginRoute: '/login',
  unauthorizedRoute: '/forbidden',
  authenticatedRoute: '/',
  preserveReturnUrl: true,
});
```

Stored return URLs must stay on the current origin. External redirect values are ignored.

## Policies and claims

Policies can be synchronous or asynchronous. They receive the current session, the requirement and the resource passed by the guard or caller.

```ts
AureliaAuthConfiguration.configure({
  policies: {
    paidAccount: ({ session }) => session.claims?.plan === 'paid',
    ownsInvoice: async ({ session, resource }) => {
      return invoices.isOwner(String(resource), String(session.claims?.sub));
    },
  },
});

const decision = await auth.authorize(
  { policies: ['ownsInvoice'] },
  invoiceId,
);
```

Roles and permissions can be read from more than one claim path:

```ts
AureliaAuthConfiguration.configure({
  rolesProperty: ['roles', 'realm.roles'],
  permissionsProperty: ['permissions', 'scope'],
});
```

Space-delimited OAuth `scope` values are split into individual permissions.

## View attributes

`if-authenticated` and `if-roles` are compatibility-friendly shortcuts:

```html
<a if-authenticated load="account">Account</a>
<a if-authenticated.bind="false" load="login">Sign in</a>
<button if-roles="admin">Manage users</button>
```

The `auth` attribute accepts the same requirement object as the router. It can hide or disable an element:

```html
<button auth="value.bind: invoiceRule; mode: disable">
  Refund invoice
</button>
```

Hidden elements use the native `hidden` property and `aria-hidden`. Disabled controls use their `disabled` property and `aria-disabled`. Original state is restored when the attribute unbinds.

## Session and events

```ts
auth.session.status; // 'anonymous' | 'authenticated' | 'refreshing'
auth.session.user;
auth.session.claims;
auth.session.tokens;

auth.isAuthenticated();
auth.getTokenPayload();
auth.getUserRoles();
auth.hasPermission('posts:write');
```

The package publishes string channels through `IEventAggregator`, including `auth:state-changed`, `auth:login`, `auth:logout`, `auth:refresh`, `auth:unauthorized` and `auth:forbidden`. `AuthStateChangedEvent` is also published as a typed event.

## Storage and JWT claims

Available storage values are `sessionStorage`, `localStorage`, `memory` and any object with `getItem`, `setItem` and `removeItem`. If browser storage is blocked, the default fallback is memory. Set `storageFallback: 'error'` when silent fallback would be misleading.

`decodeJwt()` and `getTokenPayload()` decode claims for browser UX. They do not verify the JWT signature. The resource server must validate the signature, issuer, audience, expiry and authorization rules. Browser-side issuer, audience, `nbf`, `exp` and custom claim checks are useful early rejection only. JWT implementation guidance is in [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html).

## Changes from the old port

This is a breaking modernization of the Aurelia 1-era API.

- Storage defaults to `sessionStorage`, not `localStorage`.
- Automatic location redirects are off until a redirect option is set.
- Access tokens are never attached outside `trustedOrigins`.
- OAuth defaults to code flow with S256 PKCE. Fixed state values and insecure randomness are gone.
- The router hook is registered with the plugin and returns redirect instructions.
- Authorization decorators use the current TC39 decorator proposal. There is no parameter-decorator DI.
- `if-authenticated` and `if-roles` use `hidden` instead of rewriting inline display styles.
- The global `Auth.container` escape hatch has been removed. Resolve `IAuthService` through Aurelia DI.

The old `OAuth2`, `OAuth1`, `IFetchConfig`, `IAuthentication`, `if-authenticated`, `if-roles`, `data.auth`, role helpers and common endpoint options remain available where their behavior is still sound.
