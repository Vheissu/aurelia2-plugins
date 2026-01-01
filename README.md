# aurelia2-plugins

A monorepo of Aurelia 2 plugins maintained and published as individual packages. Each plugin lives in `packages/` with its own README, tests, and build output.

## Packages

- `aurelia2-auth` — Auth helpers and integration (port of Aurelia Auth)
- `aurelia2-bootstrap` — Bootstrap-based UI components
- `aurelia2-cookie` — Cookie utilities and custom attribute(s)
- `aurelia2-froala-editor` — Froala editor integration
- `aurelia2-google-analytics` — Google Analytics integration
- `aurelia2-google-maps` — Google Maps integration (port of Aurelia Google Maps)
- `aurelia2-google-places` — Google Places integration
- `aurelia2-hooks` — App lifecycle hooks helpers
- `aurelia2-notification` — Notification system (port of Aurelia Notification)
- `aurelia2-outclick` — `outclick` custom attribute
- `aurelia2-query` — Query + caching helpers (`.query`, `<au-query>`, `QueryClient`)
- `aurelia2-forms` — Form state + validation (`<au-form>`, `au-field`, `FormController`)
- `aurelia2-router-extras` — Breadcrumbs + meta tags (`<au-breadcrumbs>`, `RouterExtras`)
- `aurelia2-storage` — Storage service + `persist` attribute (memory/local/session/indexeddb)
- `aurelia2-table` — Table component (port of Aurelia Table)

Each package README explains API, usage patterns, and configuration.

## Using a plugin

Install the package you want and register its configuration:

```ts
import { AureliaXConfiguration } from 'aurelia2-x';

Aurelia.register(AureliaXConfiguration);
```

Refer to the package README in `packages/<name>/README.md` for concrete examples and advanced usage.

## Local development

```bash
npm install
npm test --workspaces --if-present
npm run build --workspaces
```
