import { DI } from 'aurelia';
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { IGoogleMapsConfiguration } from "../src/configure";
import { GoogleMapsAPI } from "../src/google-maps-api";
import { installGoogleMapsMock, teardownGoogleMapsMock } from "./google-maps.mock";

jest.mock("@googlemaps/js-api-loader", () => ({
  setOptions: jest.fn(),
  importLibrary: jest.fn(async () => ({})),
}));

describe("GoogleMapsAPI", () => {
  beforeEach(() => {
    installGoogleMapsMock();
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardownGoogleMapsMock();
  });

  test("configures loader and imports libraries once", async () => {
    const container = DI.createContainer();
    const config = container.get(IGoogleMapsConfiguration);
    config.options({
      apiKey: "test-key",
      libraries: ["places", "geometry"],
    });

    const api = container.get(GoogleMapsAPI);
    const first = api.getMapsInstance();
    const second = api.getMapsInstance();

    expect(second).toBe(first);

    await first;

    const mockedSetOptions = setOptions as jest.Mock;
    const mockedImportLibrary = importLibrary as jest.Mock;

    expect(mockedSetOptions).toHaveBeenCalledTimes(1);
    const options = mockedSetOptions.mock.calls[0][0];
    expect(options.key).toBe("test-key");
    expect(options.libraries).toEqual(
      expect.arrayContaining(["places", "geometry"])
    );

    expect(mockedImportLibrary).toHaveBeenCalledWith("maps");
    expect(mockedImportLibrary).toHaveBeenCalledWith("places");
    expect(mockedImportLibrary).toHaveBeenCalledWith("geometry");
  });

  test('retries a failed library and loads additional libraries on later requests', async () => {
    const api = DI.createContainer().get(GoogleMapsAPI);
    const loader = jest.mocked(importLibrary);
    loader.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(api.getMapsInstance()).rejects.toThrow('network unavailable');
    await api.getMapsInstance();
    await api.getMapsInstance(['geometry']);
    expect(loader.mock.calls.filter(([name]) => name === 'maps')).toHaveLength(2);
    expect(loader.mock.calls.filter(([name]) => name === 'geometry')).toHaveLength(1);
    expect(setOptions).toHaveBeenCalledTimes(1);
  });
});
