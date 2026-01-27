import { describe, expect, it } from 'vitest';
import { createFixture } from '@aurelia/testing';
import { MyApp } from '../src/my-app';
import { AureliaAurafallConfiguration } from 'aurelia2-aurafall';

describe('aurelia2-aurafall example', () => {
  it('renders the header and aurafall component', async () => {
    const { appHost } = await createFixture(
      '<my-app></my-app>',
      {},
      [AureliaAurafallConfiguration, MyApp],
    ).started;

    const header = appHost.querySelector('h1');
    expect(header?.textContent).toContain('Au-ra-fall');

    const waterfall = appHost.querySelector('au-aurafall');
    expect(waterfall).not.toBeNull();
  });
});
