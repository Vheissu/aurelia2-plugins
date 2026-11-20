import { DI } from 'aurelia';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { IGooglePlacesConfiguration } from '../src/configure';
import { GooglePlacesAPI } from '../src/google-places-api';
import {
  installGooglePlacesMock,
  teardownGooglePlacesMock,
} from './google-places.mock';

jest.mock('@googlemaps/js-api-loader', () => ({
  setOptions: jest.fn(),
  importLibrary: jest.fn(async () => ({})),
}));

describe('GooglePlacesAPI', () => {
  beforeEach(() => {
    installGooglePlacesMock();
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardownGooglePlacesMock();
  });

  test('configures loader and imports libraries once', async () => {
    const container = DI.createContainer();
    const config = container.get(IGooglePlacesConfiguration);
    config.options({
      apiKey: 'test-key',
      libraries: ['geometry'],
    });

    const api = container.get(GooglePlacesAPI);
    const first = api.getPlacesInstance();
    const second = api.getPlacesInstance();

    expect(second).toBe(first);

    await first;

    const mockedSetOptions = setOptions as jest.Mock;
    const mockedImportLibrary = importLibrary as jest.Mock;

    expect(mockedSetOptions).toHaveBeenCalledTimes(1);
    const options = mockedSetOptions.mock.calls[0][0];
    expect(options.key).toBe('test-key');
    expect(options.libraries).toEqual(
      expect.arrayContaining(['places', 'geometry'])
    );

    expect(mockedImportLibrary).toHaveBeenCalledWith('maps');
    expect(mockedImportLibrary).toHaveBeenCalledWith('places');
    expect(mockedImportLibrary).toHaveBeenCalledWith('geometry');
  });

  test('retries a failed library and loads additional libraries on later requests', async () => {
    const api = DI.createContainer().get(GooglePlacesAPI);
    const loader = jest.mocked(importLibrary);
    loader.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(api.getPlacesInstance()).rejects.toThrow('network unavailable');
    await api.getPlacesInstance();
    await api.getPlacesInstance(['geometry']);
    expect(loader.mock.calls.filter(([name]) => name === 'maps')).toHaveLength(2);
    expect(loader.mock.calls.filter(([name]) => name === 'geometry')).toHaveLength(1);
    expect(setOptions).toHaveBeenCalledTimes(1);
  });
});
