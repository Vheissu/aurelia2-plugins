import {
  faArrowDownShortWide,
  faArrowUpWideShort,
  faSort,
} from '@fortawesome/free-solid-svg-icons';
import { AutSortIconCustomAttribute, FontAwesomeIconRegistry } from './../src';

describe('aut-sort-icon custom attribute', () => {
  test('renders default sort icon', () => {
    const element = document.createElement('th');
    const registry = new FontAwesomeIconRegistry();
    registry.register([faSort, faArrowDownShortWide, faArrowUpWideShort]);

    const sut = new AutSortIconCustomAttribute(element, registry as any);

    (sut as any).updateIcon();

    expect(element.querySelector('.aut-sort-icon svg')?.getAttribute('data-icon')).toBe('sort');
  });

  test('renders ascending icon when aut-asc is present', () => {
    const element = document.createElement('th');
    element.classList.add('aut-asc');

    const registry = new FontAwesomeIconRegistry();
    registry.register([faSort, faArrowDownShortWide, faArrowUpWideShort]);

    const sut = new AutSortIconCustomAttribute(element, registry as any);

    (sut as any).updateIcon();

    expect(element.querySelector('.aut-sort-icon svg')?.getAttribute('data-icon')).toBe('arrow-down-short-wide');
  });

  test('renders descending icon when aut-desc is present', () => {
    const element = document.createElement('th');
    element.classList.add('aut-desc');

    const registry = new FontAwesomeIconRegistry();
    registry.register([faSort, faArrowDownShortWide, faArrowUpWideShort]);

    const sut = new AutSortIconCustomAttribute(element, registry as any);

    (sut as any).updateIcon();

    expect(element.querySelector('.aut-sort-icon svg')?.getAttribute('data-icon')).toBe('arrow-up-wide-short');
  });

  test('detached removes icon container from host element', () => {
    const element = document.createElement('th');
    const registry = new FontAwesomeIconRegistry();
    registry.register([faSort, faArrowDownShortWide, faArrowUpWideShort]);

    const sut = new AutSortIconCustomAttribute(element, registry as any);

    sut.attached();
    expect(element.querySelector('.aut-sort-icon')).not.toBeNull();

    sut.detached();
    expect(element.querySelector('.aut-sort-icon')).toBeNull();
  });

  test('throws when required icon is not registered', () => {
    const element = document.createElement('th');
    const sut = new AutSortIconCustomAttribute(element, {
      resolve: jest.fn().mockReturnValue({
        prefix: 'fas',
        iconName: '__missing_icon_for_test__',
      }),
    } as any);

    expect(() => (sut as any).updateIcon()).toThrow('is not registered');
  });
});
