# aurelia2-fontawesome

Selective Font Awesome integration for Aurelia 2.

Main benefit: much smaller bundle size by registering only the icons your app actually uses.

This plugin lets an Aurelia app:

- register only the icons it imports
- use a reusable `font-awesome-icon` custom element
- optionally use the `aut-sort-icon` custom attribute
- avoid repeating `library.add(...)` boilerplate in every app

## Installation

npm install aurelia2-fontawesome @fortawesome/fontawesome-svg-core @fortawesome/free-solid-svg-icons

## Recommended usage: simple mode

Simple mode is the recommended approach.

It lets the app register only the imported icons while continuing to use normal Font Awesome icon names in templates such as `icon="gear"`.

### Register the plugin

```typescript
import { Aurelia } from 'aurelia';
import { FontAwesomeConfiguration } from 'aurelia2-fontawesome';
import { faGear, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';

new Aurelia().register(
  FontAwesomeConfiguration.configure({
	icons: [
	  faGear,
	  faPlus,
	  faTrash
	]
  })
);
```

### Use icons in templates

```html
<font-awesome-icon icon="gear"></font-awesome-icon>
<font-awesome-icon icon="plus"></font-awesome-icon>
<font-awesome-icon icon="trash"></font-awesome-icon>
```

### Why `faGear` in TypeScript but `"gear"` in HTML?

That is normal Font Awesome behavior:

- `faGear` is the JavaScript export name from `@fortawesome/free-solid-svg-icons`
- `"gear"` is the icon's Font Awesome `iconName`

The plugin reads `faGear.iconName` internally, registers it, and makes `<font-awesome-icon icon="gear">` work.

## Optional usage: alias mode

Alias mode is useful when an app wants a central icon manifest or wants custom names.

```typescript
import { defineIcons } from 'aurelia2-fontawesome';
import { faGear, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';

export const icons = defineIcons({
  settings: faGear,
  create: faPlus,
  remove: faTrash
});
```

Register the plugin with that manifest:

```typescript
import { Aurelia } from 'aurelia';
import { FontAwesomeConfiguration } from 'aurelia2-fontawesome';
import { icons } from './icons';

new Aurelia().register(
  FontAwesomeConfiguration.configure({
	icons
  })
);
```

Templates can still use string names:

```html
<font-awesome-icon icon="settings"></font-awesome-icon>
<font-awesome-icon icon="create"></font-awesome-icon>
<font-awesome-icon icon="remove"></font-awesome-icon>
```

Or bind the icon definition directly:

```html
<font-awesome-icon icon.bind="icons.settings"></font-awesome-icon>
```

## `font-awesome-icon` custom element

The custom element supports:

- `icon`
- `title`
- `spin`
- `size`

Example:

```html
<font-awesome-icon icon="spinner" spin></font-awesome-icon>
<font-awesome-icon icon="gear" title="Settings"></font-awesome-icon>
<font-awesome-icon icon="plus" size="2x"></font-awesome-icon>
```

## `aut-sort-icon` custom attribute

When enabled, the plugin registers the `aut-sort-icon` custom attribute.

It automatically renders:

- `sort` by default
- `arrow-down-short-wide` when the element has `aut-asc`
- `arrow-up-wide-short` when the element has `aut-desc`

Example:

```html
<th aut-sort-icon class="aut-asc">Name</th>
```

By default, the plugin also registers the required sort icons automatically.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `icons` | `IconDefinition[] \| Record<string, IconDefinition>` | `[]` | Icons to register with Font Awesome |
| `registerSortAttribute` | `boolean` | `true` | Registers `aut-sort-icon` |
| `registerDefaultSortIcons` | `boolean` | `true` | Registers `sort`, `arrow-down-short-wide`, and `arrow-up-wide-short` |

## API summary

### `FontAwesomeConfiguration.configure(...)`

Use when configuration is known up front.

```typescript
FontAwesomeConfiguration.configure({
  icons: [faGear, faPlus]
});
```

### `FontAwesomeConfiguration.customize(...)`

Use when callback-style setup is preferred.

```typescript
FontAwesomeConfiguration.customize((config) => {
  config.options({
	icons: [faGear, faPlus]
  });
});
```

### `defineIcons(...)`

Optional helper for alias mode.

```typescript
const icons = defineIcons({
  settings: faGear
});
```

## Example: consuming this plugin in an app

```typescript
import { Aurelia } from 'aurelia';
import { FontAwesomeConfiguration } from 'aurelia2-fontawesome';
import {
  faAddressCard,
  faGear,
  faPlus,
  faSpinner,
  faTrash
} from '@fortawesome/free-solid-svg-icons';

new Aurelia().register(
  FontAwesomeConfiguration.configure({
	icons: [
	  faAddressCard,
	  faGear,
	  faPlus,
	  faSpinner,
	  faTrash
	]
  })
);
```

Then use them in templates:

```html
<font-awesome-icon icon="address-card"></font-awesome-icon>
<font-awesome-icon icon="gear"></font-awesome-icon>
<font-awesome-icon icon="plus"></font-awesome-icon>
<font-awesome-icon icon="spinner" spin></font-awesome-icon>
<font-awesome-icon icon="trash"></font-awesome-icon>
```

## Migrating from local Font Awesome boilerplate

When replacing a local setup, remove:

- the `library` import from `@fortawesome/fontawesome-svg-core`
- the direct `library.add(...)` call
- local registration of `FontAwesomeIconCustomElement`
- local registration of `AutSortIconCustomAttribute`

Replace that with a single plugin registration:

```typescript
FontAwesomeConfiguration.configure({
  icons: [
	faGear,
	faPlus,
	faTrash
  ]
})
```

## Notes

- Simple mode is the preferred mode for most apps.
- Alias mode exists for apps that want a central manifest or custom icon aliases.
- Only imported icons are registered, so bundle size stays selective.