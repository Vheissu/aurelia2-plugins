# aurelia2-plugins

A monorepo of Aurelia 2 plugins maintained and published as individual packages. Each plugin lives in `packages/` with its own README, tests, and build output.

## Packages

- `aurelia2-auth` — Auth helpers and integration (port of Aurelia Auth)
- `aurelia2-autocomplete` — Autocomplete and combobox component with async search, keyboard navigation, and multi-select
- `aurelia2-bootstrap` — Bootstrap-based UI components
- `aurelia2-cookie` — Cookie utilities and custom attribute(s)
- `aurelia2-chartjs` — Chart.js wrapper (`<au-chart>`, typed chart elements)
- `aurelia2-clipboard` — Clipboard service + `copy` attribute
- `aurelia2-command-palette` — Command palette UI + command registry
- `aurelia2-date-picker` — Date picker component with locale-aware calendar grids and min/max constraints
- `aurelia2-feature-flags` — Feature flag targeting, rollouts, variants, provider refresh, and template gates
- `aurelia2-aurafall` — Virtual waterfall (masonry) list (`<au-aurafall>`)
- `aurelia2-file-upload` — File upload/dropzone component with validation and progress
- `aurelia2-focus-trap` — Focus trapping for modals, drawers, and overlays
- `aurelia2-froala-editor` — Froala editor integration
- `aurelia2-google-analytics` — Google Analytics integration
- `aurelia2-google-maps` — Google Maps integration (port of Aurelia Google Maps)
- `aurelia2-google-places` — Google Places integration
- `aurelia2-head` — Document title/meta/link management (`<au-head>`, `HeadManager`)
- `aurelia2-hotkeys` — Keyboard shortcut service + `hotkey` attribute
- `aurelia2-hooks` — App lifecycle hooks helpers
- `aurelia2-intersection` — IntersectionObserver service + `intersect` attribute
- `aurelia2-media` — matchMedia service + `media` attribute
- `aurelia2-notification` — Notification system (port of Aurelia Notification)
- `aurelia2-offline-sync` — Offline mutation queue with persistence, retry limits, dedupe, and network-aware sync
- `aurelia2-outclick` — `outclick` custom attribute
- `aurelia2-query` — Query + caching helpers (`.query`, `<au-query>`, `QueryClient`)
- `aurelia2-realtime` — Realtime channel service with transport abstraction, subscriptions, queued sends, and reconnects
- `aurelia2-resize` — ResizeObserver service + `resize` attribute
- `aurelia2-forms` — Form state + validation (`<au-form>`, `au-field`, `FormController`)
- `aurelia2-router-extras` — Breadcrumbs + meta tags (`<au-breadcrumbs>`, `RouterExtras`)
- `aurelia2-storage` — Storage service + `persist` attribute (memory/local/session/indexeddb)
- `aurelia2-table` — Table component (port of Aurelia Table)
- `aurelia2-tour` — Product tour and onboarding overlay
- `aurelia2-wizard` — Wizard and stepper component with linear gating, completion state, and slots

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
