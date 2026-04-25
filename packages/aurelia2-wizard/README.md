# aurelia2-wizard

Wizard and stepper UI for Aurelia 2. It provides linear or non-linear step navigation, completed-step tracking, disabled/optional steps, navigation buttons, step events, and a slot for custom step content.

## Install

```bash
npm install aurelia2-wizard
```

## Register

```ts
import { AureliaWizardConfiguration } from 'aurelia2-wizard';

Aurelia.register(AureliaWizardConfiguration);
```

## Usage

```html
<au-wizard
  steps.bind="steps"
  index.two-way="wizardIndex"
  completed.two-way="completedSteps"
  wizard-complete.trigger="finish($event.detail)">
</au-wizard>
```

```ts
steps = [
  { id: 'profile', title: 'Profile', content: 'Tell us about yourself.' },
  { id: 'team', title: 'Team', optional: true },
  { id: 'billing', title: 'Billing' },
];
```

This package targets Aurelia 2 `>=2.0.0-rc.1`.
