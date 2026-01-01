# aurelia2-auth
A comprehensive Aurelia 2 rewrite inspired by the Aurelia v1 `aurelia-auth` plugin (https://github.com/paulvanbladel/aurelia-auth). It preserves the original capabilities while adding modern best practices, refresh tokens, PKCE, and additional provider support.

## Install

```
npm install aurelia2-auth
```

## Quick start

Register the plugin:

```
import { AureliaAuthConfiguration } from 'aurelia2-auth';

Aurelia.register(AureliaAuthConfiguration);
```

Override defaults:

```
import { AureliaAuthConfiguration } from 'aurelia2-auth';

const configOptions = {
  baseUrl: '/api',
  loginRedirect: '#/dashboard'
};

Aurelia.register(AureliaAuthConfiguration.configure(configOptions));
```

Use the service:

```
import { IAuthService } from 'aurelia2-auth';
import { resolve } from '@aurelia/kernel';

const auth = resolve(IAuthService);
await auth.login({ email: 'user@site.com', password: 'secret' });
```

## Router authorization

Use the `AuthorizeHook` and mark routes with `data.auth`:

```
import { AuthorizeHook } from 'aurelia2-auth';
import { route } from '@aurelia/router';

@route({
  routes: [
    { path: '', component: 'home' },
    { path: 'dashboard', component: 'dashboard', data: { auth: true } }
  ]
})
export class App {}

Aurelia.register(AuthorizeHook);
```

For nav filtering, the `auth-filter` value converter can be used with route lists:

```
${routes | auth-filter:isAuthenticated}
```

## AuthService API

Common calls:

```
auth.login({ email, password })
auth.signup({ email, password })
auth.logout()
auth.authenticate('google')
auth.getMe()
auth.isAuthenticated()
auth.getTokenPayload()
auth.setToken(token)
auth.refreshToken()
```

## OAuth providers

Default providers included: `apple`, `facebook`, `github`, `google`, `identSrv`, `instagram`, `linkedin`, `live`, `microsoft`, `x` (OAuth 2.0), and `yahoo`.

### OAuth 2.0 example (Google)

```
Aurelia.register(
  AureliaAuthConfiguration.configure({
    providers: {
      google: {
        clientId: 'your-client-id',
        redirectUri: 'https://app.example.com',
        scope: ['profile', 'email'],
        responseType: 'code',
        pkce: true
      }
    }
  })
);
```

### OAuth 2.0 example (X with PKCE)

```
Aurelia.register(
  AureliaAuthConfiguration.configure({
    providers: {
      x: {
        clientId: 'your-client-id',
        redirectUri: 'https://app.example.com',
        scope: ['tweet.read', 'users.read'],
        responseType: 'code',
        pkce: true
      }
    }
  })
);
```

### OAuth 2.0 example (Apple)

```
Aurelia.register(
  AureliaAuthConfiguration.configure({
    providers: {
      apple: {
        clientId: 'com.example.web',
        redirectUri: 'https://app.example.com',
        scope: ['name', 'email'],
        responseType: 'code'
      }
    }
  })
);
```

### OAuth 2.0 example (Microsoft)

```
Aurelia.register(
  AureliaAuthConfiguration.configure({
    providers: {
      microsoft: {
        clientId: 'your-client-id',
        redirectUri: 'https://app.example.com',
        scope: ['openid', 'profile', 'email'],
        responseType: 'code'
      }
    }
  })
);
```

Provider overrides merge with defaults, so you can tweak only the fields you need. OAuth 1.0 providers can still be configured manually if required, but are not included by default.

## Token refresh

Enable refresh tokens and configure the refresh endpoint:

```
Aurelia.register(
  AureliaAuthConfiguration.configure({
    refreshTokens: true,
    refreshUrl: '/auth/refresh',
    refreshTokenName: 'refresh_token',
    responseRefreshTokenProp: 'refresh_token'
  })
);
```

You can also trigger a refresh manually:

```
const auth = resolve(IAuthService);
await auth.refreshToken();
```

When `refreshTokens` is enabled, the HTTP interceptor attempts a refresh on token expiry and 401 responses, then retries the original request.

## PKCE (OAuth 2.0)

PKCE is supported for authorization code flows. Enable it globally or per provider:

```
Aurelia.register(
  AureliaAuthConfiguration.configure({
    pkce: true,
    pkceMethod: 'S256',
    providers: {
      google: {
        pkce: true,
        pkceMethod: 'S256'
      }
    }
  })
);
```

## Storage

Supported storage values:
- `localStorage`
- `sessionStorage`
- `memory`
- a custom `Storage` implementation

```
Aurelia.register(
  AureliaAuthConfiguration.configure({
    storage: 'memory'
  })
);
```

## Events

The plugin publishes events through Aurelia's `IEventAggregator`:

- `auth:login`
- `auth:signup`
- `auth:logout`
- `auth:authenticate`
- `auth:unlink`
- `auth:refresh`

## Configuration reference (selected)

- `baseUrl`: prefix for API calls
- `loginUrl`, `signupUrl`, `profileUrl`, `refreshUrl`
- `loginRedirect`, `logoutRedirect`, `signupRedirect`
- `tokenName`, `idTokenName`, `refreshTokenName`
- `responseTokenProp`, `responseIdTokenProp`, `responseRefreshTokenProp`
- `tokenPrefix`, `tokenExpirationLeeway`
- `authHeader`, `authToken`, `httpInterceptor`, `withCredentials`
- `refreshTokens`, `refreshTokenPayload`
- `pkce`, `pkceMethod`
- `providers`

## Differences from aurelia-auth v1

- Router pipeline steps are replaced by an Aurelia 2 lifecycle hook (`AuthorizeHook`).
- The package name is `aurelia2-auth`.

## Security note

Authentication and authorization decisions must be enforced on the server. Client-side checks are for UX only.
