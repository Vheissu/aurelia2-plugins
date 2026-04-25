# aurelia2-command-palette

A complete command palette for Aurelia 2 apps. It provides a command registry service and `<au-command-palette>` UI with search, keyboard navigation, grouped metadata, shortcuts, and selection events.

## Install

```bash
npm install aurelia2-command-palette
```

## Register

```ts
import { AureliaCommandPaletteConfiguration } from 'aurelia2-command-palette';

Aurelia.register(
  AureliaCommandPaletteConfiguration.configure({
    maxResults: 20,
    placeholder: 'Search actions',
  })
);
```

## Usage

```html
<au-command-palette
  open.two-way="paletteOpen"
  commands.bind="commands"
  command-palette-select.trigger="trackCommand($event.detail)">
</au-command-palette>
```

```ts
export class AppShell {
  paletteOpen = false;
  commands = [
    {
      id: 'new-project',
      title: 'Create project',
      section: 'Projects',
      shortcut: 'N',
      keywords: ['new', 'workspace'],
      action: () => this.createProject(),
    },
  ];
}
```

You can also register commands globally through `ICommandPaletteService.register(...)`.

This package targets Aurelia 2 `>=2.0.0-rc.1`.
