import { createFixture } from '@aurelia/testing';
import {
  AureliaFeatureFlagsConfiguration,
  IFeatureFlags,
  type FeatureFlagMap,
  type FeatureFlagProvider,
} from './../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-feature-flags', () => {
  test('evaluates dependencies, rules, rollout gates, and variants', async () => {
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaFeatureFlagsConfiguration.configure({
        context: {
          userId: 'user-1',
          roles: ['admin'],
          traits: { plan: 'enterprise' },
        },
        flags: {
          base: true,
          adminBilling: {
            requires: ['base'],
            rules: [
              { when: 'roles', operator: 'includes', value: 'admin', enabled: true },
            ],
          },
          rolloutOff: { rollout: 0 },
          experiment: {
            variants: [
              { value: 'checkout-a', weight: 100, payload: { headline: 'Control' } },
            ],
          },
        },
      })]
    );

    await startPromise;

    const flags = container.get(IFeatureFlags);

    expect(flags.evaluate('adminBilling')).toMatchObject({
      enabled: true,
      reason: 'rule',
    });
    expect(flags.isEnabled('rolloutOff')).toBe(false);
    expect(flags.evaluate('experiment')).toMatchObject({
      enabled: true,
      value: 'checkout-a',
      reason: 'variant',
    });

    flags.setFlags({ base: false });
    expect(flags.evaluate('adminBilling')).toMatchObject({
      enabled: false,
      reason: 'dependency',
    });

    await tearDown();
  });

  test('refreshes provider-backed flags and notifies listeners', async () => {
    let providerFlags: FeatureFlagMap = { reports: false };
    let notify: (() => void) | null = null;
    const provider: FeatureFlagProvider = {
      load: jest.fn(async () => providerFlags),
      subscribe(listener) {
        notify = listener;
        return { dispose: jest.fn() };
      },
    };

    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaFeatureFlagsConfiguration.configure({ providers: [provider] })]
    );

    await startPromise;
    const flags = container.get(IFeatureFlags);
    const seen: boolean[] = [];
    flags.onChange((evaluation) => {
      if (evaluation.key === 'reports') {
        seen.push(evaluation.enabled);
      }
    });

    await flags.refresh();
    expect(flags.isEnabled('reports')).toBe(false);

    providerFlags = { reports: true };
    notify?.();
    await flush();

    expect(provider.load).toHaveBeenCalledTimes(2);
    expect(flags.isEnabled('reports')).toBe(true);
    expect(seen).toEqual([false, true]);

    await tearDown();
  });

  test('feature-enabled attribute hides, restores, and removes elements as flags change', async () => {
    const fixture = createFixture(
      `<section id="kept" feature-enabled="reports">Reports</section>
       <section id="removed" feature-enabled="value.bind: 'admin'; remove.bind: true">Admin</section>`,
      class {},
      [AureliaFeatureFlagsConfiguration.configure({
        flags: {
          reports: false,
          admin: false,
        },
      })]
    );

    await fixture.startPromise;
    const flags = fixture.container.get(IFeatureFlags);

    const kept = fixture.appHost.querySelector<HTMLElement>('#kept');
    expect(kept?.hidden).toBe(true);
    expect(fixture.appHost.querySelector('#removed')).toBeNull();

    flags.setFlags({ reports: true, admin: true });
    await flush();

    expect(fixture.appHost.querySelector<HTMLElement>('#kept')?.hidden).toBe(false);
    expect(fixture.appHost.querySelector('#removed')?.textContent).toContain('Admin');

    await fixture.tearDown();
  });
});
