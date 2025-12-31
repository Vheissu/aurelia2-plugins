import { createFixture } from '@aurelia/testing';
import { Configure } from '../src/configure';
import { GooglePlaces } from '../src/google-places';
import { GooglePlacesAPI } from '../src/google-places-api';
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

const flushPromises = async () =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe('GooglePlaces', () => {
  const logger = {
    scopeTo: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    installGooglePlacesMock();
    AutocompleteMock.instances = [];
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardownGooglePlacesMock();
  });

  test('creates autocomplete, merges options, and emits place-changed', async () => {
    const config = new Configure();
    config.options({
      apiKey: 'key',
      options: {
        strictBounds: true,
        fields: ['name'],
        types: ['geocode'],
      },
    });

    const api = new GooglePlacesAPI(config);
    const input = document.createElement('input');
    const onPlaceChanged = jest.fn();

    const sut = new GooglePlaces(input, config, api, logger as any);
    sut.options = { strictBounds: false };
    sut.fields = ['place_id'];
    sut.types = ['address'];
    sut.onPlaceChanged = onPlaceChanged;

    const eventSpy = jest.fn();
    input.addEventListener('place-changed', eventSpy);

    sut.attached();
    await flushPromises();

    const autocomplete = sut.autocomplete as AutocompleteMock;
    expect(autocomplete).toBeTruthy();
    expect(autocomplete.options.strictBounds).toBe(false);
    expect(autocomplete.options.fields).toEqual(['place_id']);
    expect(autocomplete.options.types).toEqual(['address']);

    const place = { name: 'Test Place' } as any;
    autocomplete.getPlace = jest.fn(() => place);
    autocomplete.trigger('place_changed');

    expect(sut.place).toBe(place);
    expect(onPlaceChanged).toHaveBeenCalledWith(place, autocomplete);
    expect(eventSpy).toHaveBeenCalledTimes(1);
    const event = eventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.place).toBe(place);
    expect(event.detail.autocomplete).toBe(autocomplete);
  });

  test('updates autocomplete options when bindables change', async () => {
    const config = new Configure();
    config.options({ apiKey: 'key' });

    const api = new GooglePlacesAPI(config);
    const input = document.createElement('input');

    const sut = new GooglePlaces(input, config, api, logger as any);
    sut.attached();
    await flushPromises();

    const autocomplete = sut.autocomplete as AutocompleteMock;

    sut.options = { strictBounds: true };
    sut.fields = ['place_id'];
    sut.types = ['address'];
    sut.bounds = { north: 1, south: 0, east: 1, west: 0 } as any;
    sut.componentRestrictions = { country: 'us' } as any;

    sut.optionsChanged();

    expect(autocomplete.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        strictBounds: true,
        fields: ['place_id'],
        types: ['address'],
        bounds: sut.bounds,
        componentRestrictions: { country: 'us' },
      })
    );
    expect(autocomplete.setFields).toHaveBeenCalledWith(['place_id']);
    expect(autocomplete.setTypes).toHaveBeenCalledWith(['address']);
    expect(autocomplete.setBounds).toHaveBeenCalledWith(sut.bounds);
    expect(autocomplete.setComponentRestrictions).toHaveBeenCalledWith({
      country: 'us',
    });
  });
});

describe('GooglePlaces Aurelia fixture', () => {
  beforeEach(() => {
    installGooglePlacesMock();
    AutocompleteMock.instances = [];
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardownGooglePlacesMock();
  });

  test('binds place two-way and handles place-changed event', async () => {
    const onPlaceChanged = jest.fn();

    const { component, startPromise, tearDown } = await createFixture(
      '<input google-places.bind="selectedPlace" place-changed.trigger="onPlaceChanged($event.detail.place)">',
      class App {
        selectedPlace: any = null;
        onPlaceChanged = onPlaceChanged;
      },
      [
        GooglePlacesConfiguration.configure({
          apiKey: 'key',
        }),
      ]
    );

    await startPromise;
    await flushPromises();

    const autocomplete = AutocompleteMock.instances[0];
    const place = { name: 'Fixture Place' } as any;
    autocomplete.getPlace = jest.fn(() => place);
    autocomplete.trigger('place_changed');

    await flushPromises();

    expect(component.selectedPlace).toBe(place);
    expect(onPlaceChanged).toHaveBeenCalledWith(place);

    await tearDown();
  });
});
