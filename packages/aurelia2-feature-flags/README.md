# aurelia2-feature-flags

Feature flag evaluation for Aurelia 2 applications. It supports local flags, provider-loaded flags, targeting rules, dependency gates, percentage rollouts, variants, and template gating.

```ts
import { AureliaFeatureFlagsConfiguration } from 'aurelia2-feature-flags';

Aurelia.register(AureliaFeatureFlagsConfiguration.configure({
  context: { userId: 'user-123', traits: { plan: 'pro' } },
  flags: {
    billingV2: {
      rollout: 25,
      rules: [
        { when: 'traits.plan', value: 'enterprise', enabled: true },
      ],
    },
    checkoutCopy: {
      variants: [
        { value: 'control', weight: 50 },
        { value: 'short', weight: 50 },
      ],
    },
  },
}));
```

```ts
const flags = container.get(IFeatureFlags);

flags.isEnabled('billingV2');
flags.variation('checkoutCopy', 'control');
flags.setContext({ userId: account.id, roles: account.roles });
```

```html
<section feature-enabled="billingV2">...</section>
<button disabled.bind="!('billingV2' | feature)">Upgrade</button>
```
