import { createFixture, onFixtureCreated } from '@aurelia/testing';
import { importLibrary } from '@googlemaps/js-api-loader';
import { Events } from '../src/events';
import { GoogleMaps } from '../src/google-maps';
import { GoogleMapsConfiguration } from '../src/index';
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
} from './google-maps.mock';

jest.mock('@googlemaps/js-api-loader', () => ({
  setOptions: jest.fn(),
  importLibrary: jest.fn(async () => ({})),
}));

jest.mock('@googlemaps/markerclusterer', () => ({
  MarkerClusterer: jest.fn().mockImplementation(() => ({
    clearMarkers: jest.fn(),
  })),
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

function createMapsFixture(
  componentOverrides: Record<string, unknown> = {},
  configOverrides: Record<string, unknown> = {}
) {
  const mapLoaded = jest.fn();

  const fixture = createFixture(
    `<google-map
      component.ref="mapVm"
      latitude.bind="lat"
      longitude.bind="lng"
      zoom.bind="zoom"
      options.bind="options"
      markers.bind="markers"
      polygons.bind="polygons"
      auto-info-window.bind="autoInfoWindow"
      auto-update-bounds.bind="autoUpdateBounds"
      draw-enabled.bind="drawEnabled"
      draw-mode.bind="drawMode"
      drawing-control.bind="drawingControl"
      drawing-control-options.bind="drawingControlOptions"
      map-loaded.bind="mapLoaded"
      on-event.bind="onEvent"></google-map>`,
    class App {
      lat = 51.5;
      lng = -0.1;
      zoom = 8;
      options: google.maps.MapOptions = {};
      markers: any[] = [];
      polygons: any[] = [];
      autoInfoWindow = true;
      autoUpdateBounds = false;
      drawEnabled = false;
      drawMode = 'MARKER';
      drawingControl = true;
      drawingControlOptions: google.maps.drawing.DrawingControlOptions = {};
      events: string[] = [];
      mapVm!: GoogleMaps;
      mapLoaded = mapLoaded;
      onEvent = (event: { type: string }) => {
        this.events.push(event.type);
      };

      constructor() {
        Object.assign(this, componentOverrides);
      }
    },
    [
      GoogleMapsConfiguration.configure({
        apiKey: 'key',
        ...configOverrides,
      }),
    ]
  );

  return { fixture, mapLoaded };
}

describe('GoogleMaps', () => {
  beforeEach(() => {
    installGoogleMapsMock();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    for (const fixture of fixtures.splice(0)) {
      await fixture.stop(true);
    }

    teardownGoogleMapsMock();
  });

  test('stages a map element and merges configuration into the rendered map', async () => {
    const { fixture, mapLoaded } = createMapsFixture(
      {
        lat: 10,
        lng: 20,
        options: { mapTypeControl: false },
      },
      {
        options: { mapTypeControl: true },
      }
    );
    const { appHost, component, startPromise } = fixture;

    await startPromise;
    await flushPromises(2);

    const element = appHost.querySelector('google-map') as HTMLElement;
    expect(element).toBeTruthy();

    const mapVm = component.mapVm as GoogleMaps;
    const map = mapVm.map as MapMock;
    expect(mapLoaded).toHaveBeenCalledWith(map);
    expect(map.options.mapTypeControl).toBe(true);
    expect(map.options.center.lat()).toBe(10);
    expect(map.options.center.lng()).toBe(20);
  });

  test('emits staged map click events through DOM and on-event bindings', async () => {
    const { fixture } = createMapsFixture();
    const { appHost, component, startPromise } = fixture;

    await startPromise;
    await flushPromises(2);

    const element = appHost.querySelector('google-map') as HTMLElement;
    const domEventSpy = jest.fn();
    element.addEventListener(Events.MAPCLICK, domEventSpy);

    const map = component.mapVm.map as MapMock;
    map.trigger('click', { latLng: new LatLng(1, 2) });

    await flushPromises();

    expect(domEventSpy).toHaveBeenCalledTimes(1);
    expect(component.events).toContain(Events.MAPCLICK);
  });

  test('renders staged markers, opens info windows, and emits marker events', async () => {
    const { fixture } = createMapsFixture(
      {
        markers: [
          {
            latitude: 1,
            longitude: 2,
            title: 'Test',
            infoWindow: { content: '<strong>Hello</strong>' },
          },
        ],
      },
      {
        markerCluster: { enable: true },
      }
    );
    const { appHost, component, startPromise } = fixture;

    await startPromise;
    await flushPromises(3);

    expect(appHost.querySelector('google-map')).toBeTruthy();

    const mapVm = component.mapVm as GoogleMaps;
    expect(mapVm._renderedMarkers).toHaveLength(1);

    const marker = mapVm._renderedMarkers[0] as MarkerMock;
    marker.trigger('click');

    await flushPromises();

    expect(marker.infoWindow?.open).toHaveBeenCalled();
    expect(component.events).toContain(Events.MARKERCLICK);
  });

  test('reacts to staged bindable changes for map options and center', async () => {
    const { fixture } = createMapsFixture();
    const { appHost, component, startPromise } = fixture;

    await startPromise;
    await flushPromises(2);

    expect(appHost.querySelector('google-map')).toBeTruthy();

    const map = component.mapVm.map as MapMock;
    map.setOptions.mockClear();
    map.setCenter.mockClear();

    component.options = { tilt: 45 };
    component.lat = 40;
    component.lng = -73;

    await flushPromises(3);

    expect(map.setOptions).toHaveBeenCalledWith({ tilt: 45 });
    expect(map.setCenter).toHaveBeenCalled();
  });

  test('exposes helper services from a staged map instance', async () => {
    const { fixture } = createMapsFixture();
    const { appHost, component, startPromise } = fixture;

    await startPromise;
    await flushPromises(2);

    expect(appHost.querySelector('google-map')).toBeTruthy();

    const mapVm = component.mapVm as GoogleMaps;
    const geocoder = await mapVm.getGeocoder();
    const places = await mapVm.getPlacesService();
    const autocompleteService = await mapVm.getAutocompleteService();
    const autocomplete = await mapVm.createAutocomplete(
      document.createElement('input'),
      { types: ['establishment'] }
    );

    const mockedImportLibrary = importLibrary as jest.Mock;
    expect(mockedImportLibrary).toHaveBeenCalledWith('geocoding');
    expect(mockedImportLibrary).toHaveBeenCalledWith('places');
    expect(geocoder).toBeInstanceOf(GeocoderMock);
    expect(places).toBeInstanceOf(PlacesServiceMock);
    expect(autocompleteService).toBeInstanceOf(AutocompleteServiceMock);
    expect(autocomplete).toBeInstanceOf(AutocompleteMock);
  });

  test('emits drawing overlay events from the staged custom element', async () => {
    const { fixture } = createMapsFixture();
    const { appHost, component, startPromise } = fixture;

    await startPromise;
    await flushPromises(2);

    const element = appHost.querySelector('google-map') as HTMLElement;
    const domEventSpy = jest.fn();
    element.addEventListener(Events.MAPOVERLAYCOMPLETE, domEventSpy);

    const mapVm = component.mapVm as GoogleMaps;
    await mapVm.initDrawingManager();

    const overlay = {
      getPath: () => new MVCArray([new LatLng(1, 2)]),
    };

    (mapVm.drawingManager as any).trigger('overlaycomplete', {
      type: 'POLYGON',
      overlay,
    });

    await flushPromises();

    expect(domEventSpy).toHaveBeenCalledTimes(1);
    expect((domEventSpy.mock.calls[0][0] as CustomEvent).detail.encode).toBe(
      'encoded'
    );
    expect(component.events).toContain(Events.MAPOVERLAYCOMPLETE);
  });

  test('renders polygons through staged bindings and reports polygon events', async () => {
    const { fixture } = createMapsFixture({
      polygons: [
        {
          paths: [{ latitude: 1, longitude: 2 }],
        },
      ],
    });
    const { appHost, component, startPromise } = fixture;

    await startPromise;
    await flushPromises(3);

    expect(appHost.querySelector('google-map')).toBeTruthy();

    const mapVm = component.mapVm as GoogleMaps;
    expect(mapVm._renderedPolygons.length).toBeGreaterThanOrEqual(1);
    expect(component.events).toContain(Events.POLYGONRENDERED);
  });
});
