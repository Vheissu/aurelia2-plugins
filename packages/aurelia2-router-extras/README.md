# aurelia2-router-extras

Router extras for Aurelia 2: breadcrumbs and meta tags.

## Install

```
npm install aurelia2-router-extras
```

## Register

```ts
import { AureliaRouterExtrasConfiguration } from 'aurelia2-router-extras';

Aurelia.register(AureliaRouterExtrasConfiguration);
```

## Breadcrumbs

`<au-breadcrumbs>` renders breadcrumbs derived from the active route tree.
It uses the primary viewport path (default viewport) and the route title.
If a title is not provided, it falls back to the component name.

```html
<au-breadcrumbs></au-breadcrumbs>
```

The element uses the router's `load` custom attribute internally, so links are
router-aware. Active state is surfaced as:
- `crumb.active` (from the router)
- `aria-current="page"` on the active link
- an `active` CSS class on the active link

You can also bind your own items:

```html
<au-breadcrumbs items.bind="customCrumbs"></au-breadcrumbs>
```

### Breadcrumb item shape

```ts
export interface BreadcrumbItem {
  title: string;
  path: string;
  params: Params | null;
  data: Record<string, unknown>;
  active?: boolean;
}
```

### Router options and active class

The router's `activeClass` option is still respected by the `load` attribute.
If you configure it, that class will be toggled on breadcrumb links as well.

## RouterExtras service

Inject `RouterExtras` if you need programmatic access:

```ts
import { RouterExtras } from 'aurelia2-router-extras';

export class Page {
  constructor(private readonly extras: RouterExtras) {}
}
```

It exposes:
- `breadcrumbs: BreadcrumbItem[]`
- `updateFromRouteTree(root: RouteNode)` to manually recompute

The service listens to `au:router:navigation-end` and updates automatically.
It also initializes once during app hydration.

## Meta tags

Define meta tags on route `data.meta`.

Supported shapes:

```ts
// Object map (name-based and property-based)
{
  data: {
    meta: {
      description: 'All users',
      'og:title': 'Users'
    }
  }
}

// Array of explicit entries
{
  data: {
    meta: [
      { name: 'description', content: 'All users' },
      { property: 'og:title', content: 'Users' }
    ]
  }
}
```

When multiple routes provide the same `name`/`property`, deeper routes override
higher-level ones. Meta tags are cleared and re-applied on each navigation end.
