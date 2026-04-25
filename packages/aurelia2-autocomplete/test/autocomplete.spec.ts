import { createFixture } from '@aurelia/testing';
import { AureliaAutocompleteConfiguration, IAutocompleteService } from './../src/index';
import type { AutocompleteOption } from './../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const options: AutocompleteOption<number>[] = [
  { value: 1, label: 'Ada Lovelace', description: 'Mathematician', keywords: ['analytical engine'] },
  { value: 2, label: 'Grace Hopper', description: 'Compiler pioneer', keywords: ['cobol'] },
  { value: 3, label: 'Katherine Johnson', description: 'Orbital mechanics', keywords: ['nasa'] },
  { value: 4, label: 'Disabled Person', disabled: true },
];

describe('aurelia2-autocomplete', () => {
  test('service filters by label, description, and keywords while skipping disabled options', async () => {
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaAutocompleteConfiguration.configure({ maxResults: 2 })]
    );

    await startPromise;

    const service = container.get(IAutocompleteService);
    expect(service.filter(options, 'grace').map((option) => option.label)).toEqual(['Grace Hopper']);
    expect(service.filter(options, 'compiler').map((option) => option.label)).toEqual(['Grace Hopper']);
    expect(service.filter(options, 'nasa').map((option) => option.label)).toEqual(['Katherine Johnson']);
    expect(service.filter(options, '').map((option) => option.label)).toEqual(['Ada Lovelace', 'Grace Hopper']);
    expect(service.filter(options, 'disabled')).toEqual([]);

    await tearDown();
  });

  test('component filters local options and selects with click', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<au-autocomplete
        options.bind="options"
        selected.two-way="selected"
        query.two-way="query"
        autocomplete-select.trigger="selection = $event.detail">
      </au-autocomplete>`,
      class App {
        public options = options;
        public query = '';
        public selected: AutocompleteOption<number> | null = null;
        public selection: any = null;
      },
      [AureliaAutocompleteConfiguration]
    );

    await startPromise;

    const input = appHost.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    component.query = 'ada';
    await flush();

    const buttons = Array.from(appHost.querySelectorAll<HTMLButtonElement>('.au-ac-option'));
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain('Ada Lovelace');

    buttons[0].click();
    await flush();

    expect(component.selected?.label).toBe('Ada Lovelace');
    expect(component.query).toBe('Ada Lovelace');
    expect(component.selection.option.label).toBe('Ada Lovelace');
    expect(appHost.querySelector('.au-ac-list')).toBeNull();

    await tearDown();
  });

  test('component supports keyboard navigation and async search', async () => {
    const remote = jest.fn(async ({ query }) => {
      return options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
    });

    const { appHost, component, startPromise, tearDown } = createFixture(
      `<au-autocomplete
        search.bind="remote"
        selected.two-way="selected"
        query.two-way="query">
      </au-autocomplete>`,
      class App {
        public remote = remote;
        public query = '';
        public selected: AutocompleteOption<number> | null = null;
      },
      [AureliaAutocompleteConfiguration]
    );

    await startPromise;

    const input = appHost.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    component.query = 'a';
    await flush();
    await flush();

    expect(remote).toHaveBeenCalledWith({ query: 'a', options: [] });

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await flush();

    expect(component.selected?.label).toBe('Katherine Johnson');

    await tearDown();
  });

  test('multiple mode renders chips and removes selected values from results', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<au-autocomplete
        multiple.bind="true"
        options.bind="options"
        selected.two-way="selected">
      </au-autocomplete>`,
      class App {
        public options = options;
        public selected: AutocompleteOption<number>[] = [];
      },
      [AureliaAutocompleteConfiguration]
    );

    await startPromise;

    const input = appHost.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();

    (appHost.querySelector('.au-ac-option') as HTMLButtonElement).click();
    await flush();

    expect(component.selected.map((option) => option.label)).toEqual(['Ada Lovelace']);
    expect(appHost.textContent).toContain('Ada Lovelace');
    expect(Array.from(appHost.querySelectorAll('.au-ac-option')).map((node) => node.textContent)).not.toContain('Ada Lovelace');

    (appHost.querySelector('.au-ac-chip button') as HTMLButtonElement).click();
    await flush();

    expect(component.selected).toEqual([]);

    await tearDown();
  });
});
