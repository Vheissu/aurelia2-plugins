import { DI, Registration } from '@aurelia/kernel';
import { dom } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowDownShortWide,
  faArrowUpWideShort,
  faGear,
  faPlus,
  faSort,
} from '@fortawesome/free-solid-svg-icons';
import {
  Configure,
  FontAwesomeConfiguration,
  IFontAwesomeIconRegistry,
} from './../src';

describe('fontawesome configuration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('injects Font Awesome core styles by default', () => {
    const insertCss = jest.spyOn(dom, 'insertCss').mockReturnValue('');
    const container = createContainerWithRegistry();

    FontAwesomeConfiguration.configure({ icons: [faGear] }).register(container);

    expect(insertCss).toHaveBeenCalledTimes(1);
  });

  test('does not inject styles when injectStyles is false', () => {
    const insertCss = jest.spyOn(dom, 'insertCss').mockReturnValue('');
    const container = createContainerWithRegistry();

    FontAwesomeConfiguration.configure({
      icons: [faGear],
      injectStyles: false,
    }).register(container);

    expect(insertCss).not.toHaveBeenCalled();
  });

  test('merges icon arrays across options calls', () => {
    const sut = new Configure();

    sut.options({ icons: [faGear] });
    sut.options({ icons: [faPlus] });

    const options = sut.getOptions();

    expect(Array.isArray(options.icons)).toBe(true);
    expect(options.icons).toEqual([faGear, faPlus]);
  });

  test('merges icon maps across options calls', () => {
    const sut = new Configure();

    sut.options({ icons: { gear: faGear } });
    sut.options({ icons: { plus: faPlus } });

    const options = sut.getOptions();

    expect(Array.isArray(options.icons)).toBe(false);
    expect(options.icons).toEqual({
      gear: faGear,
      plus: faPlus,
    });
  });

  test('registers default sort icons unless disabled', () => {
    const container = DI.createContainer();
    const register = jest.fn();

    container.register(
      Registration.instance(IFontAwesomeIconRegistry, {
        register,
        resolve: jest.fn(),
      } as any)
    );

    FontAwesomeConfiguration.configure({ icons: [faGear] }).register(container);

    const registeredIcons = register.mock.calls[0][0] as Array<{ iconName: string }>;
    const iconNames = registeredIcons.map((x) => x.iconName);

    expect(iconNames).toEqual(expect.arrayContaining([
      faSort.iconName,
      faArrowDownShortWide.iconName,
      faArrowUpWideShort.iconName,
      faGear.iconName,
    ]));
  });

  test('does not register default sort icons when disabled', () => {
    const container = DI.createContainer();
    const register = jest.fn();

    container.register(
      Registration.instance(IFontAwesomeIconRegistry, {
        register,
        resolve: jest.fn(),
      } as any)
    );

    FontAwesomeConfiguration.configure({
      icons: [faGear],
      registerDefaultSortIcons: false,
    }).register(container);

    const registeredIcons = register.mock.calls[0][0] as Array<{ iconName: string }>;
    const iconNames = registeredIcons.map((x) => x.iconName);

    expect(iconNames).toEqual([faGear.iconName]);
  });
});

function createContainerWithRegistry() {
  const container = DI.createContainer();

  container.register(
    Registration.instance(IFontAwesomeIconRegistry, {
      register: jest.fn(),
      resolve: jest.fn(),
    } as any)
  );

  return container;
}
