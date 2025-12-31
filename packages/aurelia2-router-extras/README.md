# aurelia2-router-extras

Adds router extras for Aurelia 2: breadcrumbs and meta tags.

## Install

```
npm install aurelia2-router-extras
```

## Usage

Register the plugin:

```ts
import { AureliaRouterExtrasConfiguration } from 'aurelia2-router-extras';

Aurelia.register(AureliaRouterExtrasConfiguration);
```

### Breadcrumbs

```html
<au-breadcrumbs></au-breadcrumbs>
```

Breadcrumbs are built from the active route tree and use route titles.

### Meta tags

Add meta definitions to route `data`:

```ts
{
  path: 'users',
  title: 'Users',
  component: Users,
  data: {
    meta: {
      description: 'All users',
      'og:title': 'Users'
    }
  }
}
```

Meta entries are applied on navigation end.
