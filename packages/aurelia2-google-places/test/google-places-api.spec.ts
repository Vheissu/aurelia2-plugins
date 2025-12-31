import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { Configure } from '../src/configure';
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
    const config = new Configure();
    config.options({
      apiKey: 'test-key',
      libraries: ['geometry'],
    });

    const api = new GooglePlacesAPI(config);
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
});
