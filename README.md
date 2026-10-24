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
- `aurelia2-ssr` — Server rendering, prerendering, SEO, preboot, Shadow DOM serialization, and Aurelia hydration helpers
- `aurelia2-storage` — Storage service + `persist` attribute (memory/local/session/indexeddb)
- `aurelia2-table` — Table component (port of Aurelia Table)
- `aurelia2-tour` — Product tour and onboarding overlay
- `aurelia2-wizard` — Wizard and stepper component with linear gating, completion state, and slots

Each package README explains API, usage patterns, and configuration.

## Workflow and editor plugins

These packages use Aurelia composition, observation, DI, and lifecycle APIs to manage application behavior. All require Aurelia `^2.0.0-rc.2`.

| Package | Use case |
| --- | --- |
| [aurelia2-remote-template](packages/aurelia2-remote-template/README.md) | Trusted server templates with LRU caching, cancellation, and explicit binding contexts |
| [aurelia2-schema-form](packages/aurelia2-schema-form/README.md) | Schema-driven forms using registered Aurelia field templates |
| [aurelia2-undo-redo](packages/aurelia2-undo-redo/README.md) | Bounded document histories, grouped transactions, and editor keyboard shortcuts |
| [aurelia2-state-machine](packages/aurelia2-state-machine/README.md) | Guarded workflow transitions and observable context |
| [aurelia2-async-task](packages/aurelia2-async-task/README.md) | Restart, drop, or queue concurrent actions with lifecycle cancellation |
| [aurelia2-tree](packages/aurelia2-tree/README.md) | Lazy trees with keyboard navigation, selection, and accessible row metadata |
| [aurelia2-sortable](packages/aurelia2-sortable/README.md) | Keyboard/native drag reordering with previews and cancellable commits |
| [aurelia2-autosave](packages/aurelia2-autosave/README.md) | Observed drafts, bounded debounce, serialized writes, and manual retry |
| [aurelia2-pan-zoom](packages/aurelia2-pan-zoom/README.md) | Bounded canvas transforms, pointer pan, pinch, and keyboard zoom |
| [aurelia2-split-pane](packages/aurelia2-split-pane/README.md) | Constrained, accessible two-pane resizing with RTL support |

The [plugin lab](examples/plugin-lab/README.md) runs all ten together using their built package exports. See the [verification record](docs/plugin-verification.md) for test coverage, browser checks, and package checks.

## Shared state and editing

| Package | Use case |
| --- | --- |
| [aurelia2-filter-builder](packages/aurelia2-filter-builder/README.md) | Typed nested filters, field editors, validation, and safe in-memory predicates |
| [aurelia2-merge](packages/aurelia2-merge/README.md) | Three-way record merging with explicit conflict choices and custom values |
| [aurelia2-mentions](packages/aurelia2-mentions/README.md) | Async mentions in text inputs and textareas, with tracked text ranges |
| [aurelia2-transfer-list](packages/aurelia2-transfer-list/README.md) | Assign and order keyed items using two accessible lists |
| [aurelia2-url-state](packages/aurelia2-url-state/README.md) | Typed query parameters, debounced writes, router integration, and browser history |

The [workspace lab](examples/workspace-lab/README.md) combines these five plugins. See the [verification record](docs/workspace-plugin-verification.md) for regression tests and browser checks.

## Using a plugin

Install the package you want and register its configuration:

```ts
import { AureliaXConfiguration } from 'aurelia2-x';

Aurelia.register(AureliaXConfiguration);
```

Refer to the package README in `packages/<name>/README.md` for concrete examples and advanced usage.

## Local development

```bash
npm ci
npm test -- --runInBand
npm run build
```


See [dependency compatibility](docs/dependency-compatibility.md) for the current toolchain pins and unresolved upstream advisories.
