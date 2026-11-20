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

  test('cyclic dependencies are disabled and missing variations use the fallback', async () => {
    const fixture = await createFixture('<div></div>', class {}, [
      AureliaFeatureFlagsConfiguration.configure({
        flags: { a: { requires: ['b'] }, b: { requires: ['a'] } },
      }),
    ]).started;
    const flags = fixture.container.get(IFeatureFlags);

    expect(flags.evaluate('a')).toMatchObject({ enabled: false, reason: 'dependency' });
    expect(flags.evaluate('b')).toMatchObject({ enabled: false, reason: 'dependency' });
    expect(flags.variation('constructor', 'control')).toBe('control');
    await fixture.tearDown();
  });

  test('a slower provider response cannot restore a flag removed by a newer refresh', async () => {
    let finish!: (flags: FeatureFlagMap) => void;
    const load = jest.fn<Promise<FeatureFlagMap>, []>()
      .mockResolvedValueOnce({ reports: true })
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce({});
    const fixture = await createFixture(
      '<section feature-enabled="reports">Reports</section>',
      class {},
      [AureliaFeatureFlagsConfiguration.configure({ providers: [{ load }] })],
    ).started;
    const flags = fixture.container.get(IFeatureFlags);
    const reports = fixture.appHost.querySelector('section')!;
    await flags.refresh();
    expect(reports.hidden).toBe(false);

    const staleRefresh = flags.refresh();
    await flags.refresh();
    expect(reports.hidden).toBe(true);

    finish({ reports: true });
    await staleRefresh;
    expect(flags.isEnabled('reports')).toBe(false);
    expect(reports.hidden).toBe(true);
    await fixture.tearDown();
  });

  test('a removed node leaves no placeholder when its containing view is deactivated', async () => {
    const fixture = await createFixture(
      `<div><template if.bind="open">
        <section feature-enabled="value: missing; remove.bind: true">Reports</section>
      </template></div>`,
      class { open = true; },
      [AureliaFeatureFlagsConfiguration],
    ).started;
    expect(fixture.appHost.innerHTML).toContain('feature-enabled:missing');

    fixture.component.open = false;
    await flush();
    expect(fixture.appHost.innerHTML).not.toContain('feature-enabled:missing');
    await fixture.tearDown();
  });
});
