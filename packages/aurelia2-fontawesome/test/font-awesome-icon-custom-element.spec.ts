import { Registration } from '@aurelia/kernel';
import { createFixture } from '@aurelia/testing';
import { faGear } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIconCustomElement, FontAwesomeIconRegistry, IFontAwesomeIconRegistry } from './../src';

describe('font-awesome-icon custom element', () => {
  test('renders svg markup from a registered string icon', () => {
    const registry = new FontAwesomeIconRegistry();
    registry.register([faGear]);

    const sut = new FontAwesomeIconCustomElement(registry as any);
    sut.iconContainer = document.createElement('span');
    sut.icon = 'gear';

    sut.attached();

    expect(sut.iconContainer.innerHTML).toContain('<svg');
    expect(sut.iconContainer.querySelector('svg')?.getAttribute('data-icon')).toBe('gear');
  });

  test('supports spin and size classes', () => {
    const registry = new FontAwesomeIconRegistry();
    registry.register([faGear]);

    const sut = new FontAwesomeIconCustomElement(registry as any);
    sut.iconContainer = document.createElement('span');
    sut.icon = 'gear';
    sut.spin = true;
    sut.size = '2x' as any;

    sut.attached();

    const svg = sut.iconContainer.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg?.classList.contains('fa-spin')).toBe(true);
    expect(svg?.classList.contains('fa-2x')).toBe(true);
  });

  test('supports the bare spin attribute syntax', async () => {
    const registry = new FontAwesomeIconRegistry();
    registry.register([faGear]);

    const { appHost, startPromise, tearDown } = createFixture(
      '<font-awesome-icon icon="gear" spin></font-awesome-icon>',
      {},
      [FontAwesomeIconCustomElement, Registration.instance(IFontAwesomeIconRegistry, registry)]
    );

    await startPromise;

    expect(appHost.querySelector('svg')?.classList.contains('fa-spin')).toBe(true);

    await tearDown();
  });

  test('supports icon definition bindings', () => {
    const registry = new FontAwesomeIconRegistry();
    registry.register([faGear]);

    const sut = new FontAwesomeIconCustomElement(registry as any);
    sut.iconContainer = document.createElement('span');
    sut.icon = faGear;

    sut.attached();

    expect(sut.iconContainer.querySelector('svg')?.getAttribute('data-icon')).toBe(faGear.iconName);
  });

  test('throws for an unregistered icon', () => {
    const registry = new FontAwesomeIconRegistry();

    const sut = new FontAwesomeIconCustomElement(registry as any);
    sut.iconContainer = document.createElement('span');
    sut.icon = 'missing-icon';

    expect(() => sut.attached()).toThrow('is not registered');
  });
});
