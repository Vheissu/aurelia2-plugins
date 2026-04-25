# aurelia2-tour

Product tour and onboarding UI for Aurelia 2. It provides a tour service plus `<au-tour>` overlay/card rendering, step navigation, target highlighting, placement, progress, and completion events.

## Install

```bash
npm install aurelia2-tour
```

## Register

```ts
import { AureliaTourConfiguration } from 'aurelia2-tour';

Aurelia.register(AureliaTourConfiguration);
```

## Usage

```html
<button click.trigger="tourOpen = true">Start tour</button>
<au-tour active.two-way="tourOpen" steps.bind="steps"></au-tour>
```

```ts
export class Dashboard {
  tourOpen = false;
  steps = [
    {
      id: 'search',
      title: 'Find anything',
      content: 'Search across projects, tasks, and comments.',
      target: '#global-search',
      placement: 'bottom',
    },
    {
      id: 'invite',
      title: 'Invite teammates',
      content: 'Bring the rest of your team into the workspace.',
      target: '#invite-button',
    },
  ];
}
```

This package targets Aurelia 2 `>=2.0.0-rc.1`.
