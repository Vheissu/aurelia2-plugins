import { createFixture, onFixtureCreated } from '@aurelia/testing';
import { GooglePlacesConfiguration } from '../src/index';
import {
  AutocompleteMock,
  installGooglePlacesMock,
  teardownGooglePlacesMock,
} from './google-places.mock';

jest.mock('@googlemaps/js-api-loader', () => ({
  setOptions: jest.fn(),
  importLibrary: jest.fn(async () => ({})),
}));

const fixtures: any[] = [];

onFixtureCreated((fixture) => {
  fixtures.push(fixture);
});

const flushPromises = async (times = 1) => {
  for (let index = 0; index < times; index++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

function createPlacesFixture(
  componentOverrides: Record<string, unknown> = {},
  configOverrides: Record<string, unknown> = {}
) {
  const onPlaceChanged = jest.fn();

  const fixture = createFixture(
    `<input
      ref="input"
      google-places="place.bind: selectedPlace;
        autocomplete.bind: autocomplete;
        options.bind: options;
        fields.bind: fields;
        types.bind: types;
        bounds.bind: bounds;
        component-restrictions.bind: componentRestrictions;
        strict-bounds.bind: strictBounds;
        on-place-changed.bind: onPlaceChanged"
      place-changed.trigger="lastEvent = $event.detail">`,
    class App {
      input!: HTMLInputElement;
      selectedPlace: any = null;
      autocomplete: any = null;
      options: google.maps.places.AutocompleteOptions = { strictBounds: false };
      fields: string[] = ['place_id'];
      types: string[] = ['address'];
      bounds: google.maps.LatLngBoundsLiteral | null = null;
      componentRestrictions: google.maps.places.ComponentRestrictions | null = null;
      strictBounds: boolean | undefined = undefined;
      lastEvent: any = null;
      onPlaceChanged = onPlaceChanged;

      constructor() {
        Object.assign(this, componentOverrides);
      }
    },
    [
      GooglePlacesConfiguration.configure({
        apiKey: 'key',
        options: {
          strictBounds: true,
          fields: ['name'],
          types: ['geocode'],
        },
        ...configOverrides,
      }),
    ]
  );

  return { fixture, onPlaceChanged };
}

describe('GooglePlaces', () => {
  beforeEach(() => {
    installGooglePlacesMock();
    AutocompleteMock.instances = [];
    jest.clearAllMocks();
  });

  afterEach(async () => {
    for (const fixture of fixtures.splice(0)) {
      await fixture.stop(true);
    }

    teardownGooglePlacesMock();
  });

  test('stages an input, merges options, and emits place-changed', async () => {
    const { fixture, onPlaceChanged } = createPlacesFixture();
    const { appHost, component, startPromise } = fixture;

    await startPromise;
    await flushPromises(2);

    const input = appHost.querySelector('input') as HTMLInputElement;
    expect(input).toBe(component.input);

    const autocomplete = AutocompleteMock.instances[0];
    expect(autocomplete).toBeTruthy();
    expect(component.autocomplete).toBe(autocomplete);
    expect(autocomplete.options.strictBounds).toBe(false);
    expect(autocomplete.options.fields).toEqual(['place_id']);
    expect(autocomplete.options.types).toEqual(['address']);

    const place = { name: 'Test Place' } as google.maps.places.PlaceResult;
    autocomplete.getPlace = jest.fn(() => place);
    autocomplete.trigger('place_changed');

    await flushPromises();

    expect(component.selectedPlace).toBe(place);
    expect(onPlaceChanged).toHaveBeenCalledWith(place, autocomplete);
    expect(component.lastEvent.place).toBe(place);
    expect(component.lastEvent.autocomplete).toBe(autocomplete);
  });

  test('updates staged autocomplete options when bindables change', async () => {
    const { fixture } = createPlacesFixture();
    const { appHost, component, startPromise } = fixture;

    await startPromise;
    await flushPromises(2);

    expect(appHost.querySelector('input')).toBeTruthy();

    const autocomplete = AutocompleteMock.instances[0];
    autocomplete.setOptions.mockClear();
    autocomplete.setFields.mockClear();
    autocomplete.setTypes.mockClear();
    autocomplete.setBounds.mockClear();
    autocomplete.setComponentRestrictions.mockClear();

    const bounds = { north: 1, south: 0, east: 1, west: 0 };
    component.options = { strictBounds: true };
    component.fields = ['place_id', 'geometry'];
    component.types = ['establishment'];
    component.bounds = bounds;
    component.componentRestrictions = { country: 'us' };
    component.strictBounds = true;

    await flushPromises(2);

    expect(autocomplete.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        strictBounds: true,
        fields: ['place_id', 'geometry'],
        types: ['establishment'],
        bounds,
        componentRestrictions: { country: 'us' },
      })
    );
    expect(autocomplete.setFields).toHaveBeenCalledWith(['place_id', 'geometry']);
    expect(autocomplete.setTypes).toHaveBeenCalledWith(['establishment']);
    expect(autocomplete.setBounds).toHaveBeenCalledWith(bounds);
    expect(autocomplete.setComponentRestrictions).toHaveBeenCalledWith({
      country: 'us',
    });
  });
});
