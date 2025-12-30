import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { Configure } from "../src/configure";
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
    const config = new Configure();
    config.options({
      apiKey: "test-key",
      libraries: ["places", "geometry"],
    });

    const api = new GoogleMapsAPI(config);
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
});
