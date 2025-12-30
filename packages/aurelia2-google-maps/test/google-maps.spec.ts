import { createFixture } from "@aurelia/testing";
import { importLibrary } from "@googlemaps/js-api-loader";
import { Configure } from "../src/configure";
import { Events } from "../src/events";
import { GoogleMaps } from "../src/google-maps";
import { GoogleMapsAPI } from "../src/google-maps-api";
import { GoogleMapsConfiguration } from "../src/index";
import { MarkerClustering } from "../src/marker-clustering";
import {
  AutocompleteMock,
  AutocompleteServiceMock,
  GeocoderMock,
  LatLng,
  MapMock,
  MarkerMock,
  MVCArray,
  PlacesServiceMock,
  installGoogleMapsMock,
  teardownGoogleMapsMock,
} from "./google-maps.mock";

jest.mock("@googlemaps/js-api-loader", () => ({
  setOptions: jest.fn(),
  importLibrary: jest.fn(async () => ({})),
}));

jest.mock("@googlemaps/markerclusterer", () => ({
  MarkerClusterer: jest.fn().mockImplementation(() => ({
    clearMarkers: jest.fn(),
  })),
}));

const flushPromises = async () =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe("GoogleMaps", () => {
  const logger = {
    scopeTo: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    installGoogleMapsMock();
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardownGoogleMapsMock();
  });

  test("creates a map on attach and merges options", async () => {
    const config = new Configure();
    config.options({
      apiKey: "key",
      options: {
        mapTypeControl: true,
      },
    });

    const googleMapsApi = new GoogleMapsAPI(config);
    const clustering = new MarkerClustering(config);
    const element = document.createElement("google-map");
    const mapLoaded = jest.fn();

    const sut = new GoogleMaps(
      element,
      config,
      googleMapsApi,
      clustering,
      logger as any
    );
    sut.latitude = 10;
    sut.longitude = 20;
    sut.options = { mapTypeControl: false };
    sut.mapLoaded = mapLoaded;

    sut.attached();
    await flushPromises();

    const map = sut.map as MapMock;
    expect(map).toBeTruthy();
    expect(mapLoaded).toHaveBeenCalledWith(map);
    expect(map.options.mapTypeControl).toBe(true);
    expect(map.options.center.lat()).toBe(10);
    expect(map.options.center.lng()).toBe(20);
  });

  test("emits map click events via CustomEvent and onEvent", async () => {
    const config = new Configure();
    config.options({ apiKey: "key" });

    const sut = new GoogleMaps(
      document.createElement("google-map"),
      config,
      new GoogleMapsAPI(config),
      new MarkerClustering(config),
      logger as any
    );
    const onEvent = jest.fn();
    sut.onEvent = onEvent;

    const domEventSpy = jest.fn();
    sut.element.addEventListener(Events.MAPCLICK, domEventSpy);

    sut.attached();
    await flushPromises();

    (sut.map as unknown as MapMock).trigger("click", { latLng: new LatLng(1, 2) });

    expect(domEventSpy).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: Events.MAPCLICK })
    );
  });

  test("renders markers, opens info window, and emits marker events", async () => {
    const config = new Configure();
    config.options({
      apiKey: "key",
      markerCluster: { enable: true },
    });

    const markerClustering = new MarkerClustering(config);
    const clusteringSpy = jest.spyOn(markerClustering, "renderClusters");

    const sut = new GoogleMaps(
      document.createElement("google-map"),
      config,
      new GoogleMapsAPI(config),
      markerClustering,
      logger as any
    );
    sut.autoInfoWindow = true;
    sut.markers = [
      {
        latitude: 1,
        longitude: 2,
        title: "Test",
        infoWindow: { content: "<strong>Hello</strong>" },
      },
    ];
    const onEvent = jest.fn();
    sut.onEvent = onEvent;

    sut.attached();
    await flushPromises();

    await sut.markerCollectionChange();

    expect(sut._renderedMarkers).toHaveLength(1);
    expect(clusteringSpy).toHaveBeenCalled();

    const marker = sut._renderedMarkers[0] as MarkerMock;
    marker.trigger("click");

    expect(marker.infoWindow?.open).toHaveBeenCalled();
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: Events.MARKERCLICK })
    );
  });

  test("updates map options when optionsChanged is called", async () => {
    const config = new Configure();
    config.options({ apiKey: "key" });

    const sut = new GoogleMaps(
      document.createElement("google-map"),
      config,
      new GoogleMapsAPI(config),
      new MarkerClustering(config),
      logger as any
    );

    sut.attached();
    await flushPromises();

    sut.optionsChanged({ tilt: 45 });

    const map = sut.map as MapMock;
    expect(map.setOptions).toHaveBeenCalledWith({ tilt: 45 });
  });

  test("exposes places, geocoder, and autocomplete helpers", async () => {
    const config = new Configure();
    config.options({ apiKey: "key" });

    const sut = new GoogleMaps(
      document.createElement("google-map"),
      config,
      new GoogleMapsAPI(config),
      new MarkerClustering(config),
      logger as any
    );

    sut.attached();
    await flushPromises();

    const geocoder = await sut.getGeocoder();
    const places = await sut.getPlacesService();
    const autocompleteService = await sut.getAutocompleteService();
    const input = document.createElement("input");
    const autocomplete = await sut.createAutocomplete(input, { types: ["establishment"] });

    const mockedImportLibrary = importLibrary as jest.Mock;
    expect(mockedImportLibrary).toHaveBeenCalledWith("geocoding");
    expect(mockedImportLibrary).toHaveBeenCalledWith("places");
    expect(geocoder).toBeInstanceOf(GeocoderMock);
    expect(places).toBeInstanceOf(PlacesServiceMock);
    expect(autocompleteService).toBeInstanceOf(AutocompleteServiceMock);
    expect(autocomplete).toBeInstanceOf(AutocompleteMock);
  });

  test("emits drawing overlay events with encoded paths", async () => {
    const config = new Configure();
    config.options({
      apiKey: "key",
      libraries: ["drawing", "geometry"],
    });

    const sut = new GoogleMaps(
      document.createElement("google-map"),
      config,
      new GoogleMapsAPI(config),
      new MarkerClustering(config),
      logger as any
    );
    const onEvent = jest.fn();
    sut.onEvent = onEvent;

    sut.attached();
    await flushPromises();

    await sut.initDrawingManager();

    const overlay = {
      getPath: () => new MVCArray([new LatLng(1, 2)]),
    };

    (sut.drawingManager as any).trigger("overlaycomplete", {
      type: "POLYGON",
      overlay,
    });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: Events.MAPOVERLAYCOMPLETE,
        event: expect.objectContaining({
          encode: "encoded",
        }),
      })
    );
  });

  test("renders polygons and dispatches polygon events", async () => {
    const config = new Configure();
    config.options({ apiKey: "key" });

    const sut = new GoogleMaps(
      document.createElement("google-map"),
      config,
      new GoogleMapsAPI(config),
      new MarkerClustering(config),
      logger as any
    );

    const polygonEventSpy = jest.fn();
    sut.element.addEventListener(Events.POLYGONRENDERED, polygonEventSpy);

    sut.attached();
    await flushPromises();

    sut.polygons = [
      {
        paths: [{ latitude: 1, longitude: 2 }],
      },
    ];
    sut.polygonCollectionChange();
    await flushPromises();

    expect(sut._renderedPolygons).toHaveLength(1);
    expect(polygonEventSpy).toHaveBeenCalledTimes(1);
  });
});

describe("GoogleMaps Aurelia fixture", () => {
  beforeEach(() => {
    installGoogleMapsMock();
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardownGoogleMapsMock();
  });

  test("renders the custom element, binds properties, and reacts to events", async () => {
    const mapLoaded = jest.fn();

    const { appHost, component, startPromise, tearDown } = await createFixture(
      "<google-map component.ref='mapVm' latitude.bind='lat' longitude.bind='lng' markers.bind='markers' map-loaded.bind='mapLoaded' on-event.bind='onEvent'></google-map>",
      class App {
        lat = 51.5;
        lng = -0.1;
        markers = [{ latitude: 1, longitude: 2, title: "Marker" }];
        mapLoaded = mapLoaded;
        events: string[] = [];
        mapVm!: GoogleMaps;
        onEvent = (event: { type: string }) => {
          this.events.push(event.type);
        };
      },
      [
        GoogleMapsConfiguration.configure({
          apiKey: "key",
        }),
      ]
    );

    await startPromise;
    await flushPromises();

    const element = appHost.querySelector("google-map") as HTMLElement;
    expect(element).toBeTruthy();
    expect(element.childElementCount).toBe(0);
    expect(mapLoaded).toHaveBeenCalled();

    const mapVm = (component as any).mapVm as GoogleMaps;
    expect(mapVm).toBeTruthy();
    expect(mapVm.map).toBeTruthy();

    await flushPromises();
    expect(mapVm._renderedMarkers).toHaveLength(1);

    const mapInstance = mapVm.map as MapMock;
    const setCenterSpy = jest.spyOn(mapInstance, "setCenter");
    setCenterSpy.mockClear();
    component.lat = 40;
    component.lng = -73;
    await flushPromises();
    expect(setCenterSpy).toHaveBeenCalled();

    mapInstance.trigger("click", { latLng: new LatLng(1, 2) });
    await flushPromises();
    expect(component.events).toContain(Events.MAPCLICK);

    await tearDown();
  });
});
