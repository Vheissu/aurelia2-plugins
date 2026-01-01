# Aurelia 2 Bootstrap

Bootstrap 5 helpers for Aurelia 2. This package provides Aurelia custom elements/attributes that wrap Bootstrap’s JavaScript behaviors and some additional UI helpers.

## Install

```bash
npm install aurelia2-bootstrap bootstrap
```

Include Bootstrap’s CSS in your app (e.g. in `main.ts`):

```ts
import 'bootstrap/dist/css/bootstrap.min.css';
```

## Register

```ts
import Aurelia from 'aurelia';
import { BootstrapConfiguration } from 'aurelia2-bootstrap';

Aurelia.register(BootstrapConfiguration).app(MyApp).start();
```

## Components

Custom elements:
- `aubs-accordion`, `aubs-accordion-group`
- `aubs-tabset`, `aubs-tab`
- `aubs-pagination`

Custom attributes:
- Buttons: `aubs-btn-checkbox`, `aubs-btn-radio`, `aubs-btn-loading`, `aubs-button-toggle`
- Behavior: `aubs-collapse`, `aubs-dropdown`, `aubs-dropdown-toggle`
- Overlays: `aubs-tooltip`, `aubs-popover`
- Bootstrap JS wrappers: `aubs-alert`, `aubs-modal`, `aubs-offcanvas`, `aubs-toast`, `aubs-carousel`, `aubs-scrollspy`, `aubs-tab-toggle`

## Slot usage (Aurelia 2)

Replaceable parts from Aurelia 1 are now `au-slot`. Here are the supported slots in this plugin:

### Accordion header slot

```html
<aubs-accordion>
  <aubs-accordion-group title="Default title">
    <h5 au-slot="header" class="mb-0">Custom header</h5>
    Body content
  </aubs-accordion-group>
</aubs-accordion>
```

### Pagination slot

```html
<aubs-pagination total-pages.bind="total" current-page.bind="page">
  <template au-slot="pagination">
    <!-- your custom pagination template -->
  </template>
</aubs-pagination>
```

## Bootstrap JS wrappers

These attributes instantiate Bootstrap’s JS classes and expose simple bindings.

### Collapse

```html
<div class="collapse" aubs-collapse="collapsed.bind: isCollapsed; options.bind: collapseOptions">
  Collapsible content
</div>
```

### Dropdown

```html
<div class="dropdown" aubs-dropdown="is-open.bind: open; auto-close.bind: 'outside'">
  <button class="btn dropdown-toggle" type="button" aubs-dropdown-toggle>
    Toggle
  </button>
  <div class="dropdown-menu">
    <a class="dropdown-item">Item</a>
  </div>
</div>
```

### Modal

```html
<div class="modal" tabindex="-1" aubs-modal="is-open.bind: showModal; options.bind: modalOptions">
  ...
</div>
```

### Alert

```html
<div class="alert alert-warning alert-dismissible fade show" role="alert"
     aubs-alert="is-open.bind: showAlert; on-closed.bind: alertClosed">
  Warning message
  <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
</div>
```

### Offcanvas

```html
<div class="offcanvas offcanvas-start" aubs-offcanvas="is-open.bind: showPanel">
  ...
</div>
```

### Toast

```html
<div class="toast" aubs-toast="is-open.bind: showToast; options.bind: toastOptions">
  ...
</div>
```

### Carousel

```html
<div class="carousel slide" aubs-carousel="active.bind: activeIndex; options.bind: carouselOptions">
  ...
</div>
```

### ScrollSpy

```html
<div class="scrollspy-example" aubs-scrollspy="options.bind: { target: '#nav' }">
  ...
</div>
```

### Button toggle

```html
<button class="btn btn-outline-primary" type="button" aubs-button-toggle="active.bind: isToggled">
  Toggle
</button>
```

### Tab toggle (Bootstrap markup)

```html
<ul class="nav nav-tabs">
  <li class="nav-item">
    <button class="nav-link active"
            type="button"
            data-bs-target="#tab-home"
            aubs-tab-toggle="active.bind: isHomeActive">
      Home
    </button>
  </li>
  <li class="nav-item">
    <button class="nav-link"
            type="button"
            data-bs-target="#tab-profile"
            aubs-tab-toggle="active.bind: isProfileActive">
      Profile
    </button>
  </li>
</ul>

<div class="tab-content">
  <div class="tab-pane fade show active" id="tab-home">Home content</div>
  <div class="tab-pane fade" id="tab-profile">Profile content</div>
</div>
```

## Notes

- This plugin does **not** use Shadow DOM, so Bootstrap’s global styles work as expected.
- The plugin is designed to work with Bootstrap 5.3.x.
