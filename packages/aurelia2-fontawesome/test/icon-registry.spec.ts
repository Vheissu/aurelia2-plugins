import type { IconLookup } from '@fortawesome/fontawesome-svg-core';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faArrowDownShortWide, faGear } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIconRegistry } from './../src';

describe('fontawesome icon registry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('register deduplicates icon definitions before adding to library', () => {
    const addSpy = jest.spyOn(library, 'add');
    const sut = new FontAwesomeIconRegistry();

    sut.register([faGear, faGear]);

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(addSpy.mock.calls[0]).toHaveLength(1);
  });

  test('resolve supports alias registration and normalized keys', () => {
    const sut = new FontAwesomeIconRegistry();

    sut.register({
      gearAlias: faGear,
      arrow_down: faArrowDownShortWide,
    });

    expect(sut.resolve('gear-alias')).toEqual({
      prefix: faGear.prefix,
      iconName: faGear.iconName,
    });

    expect(sut.resolve('arrowDown')).toEqual({
      prefix: faArrowDownShortWide.prefix,
      iconName: faArrowDownShortWide.iconName,
    });
  });

  test('resolve supports tuple, icon definition, and icon lookup inputs', () => {
    const sut = new FontAwesomeIconRegistry();
    const lookup: IconLookup = { prefix: 'fas', iconName: 'gear' as any };

    expect(sut.resolve(['fas', 'gear' as any])).toEqual({
      prefix: 'fas',
      iconName: 'gear',
    });

    expect(sut.resolve(faGear)).toEqual({
      prefix: faGear.prefix,
      iconName: faGear.iconName,
    });

    expect(sut.resolve(lookup)).toBe(lookup);
  });

  test('resolve falls back to fas prefix for unknown string icons', () => {
    const sut = new FontAwesomeIconRegistry();

    expect(sut.resolve('does-not-exist')).toEqual({
      prefix: 'fas',
      iconName: 'does-not-exist',
    });
  });
});
