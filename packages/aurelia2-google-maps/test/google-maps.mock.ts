type Listener = (...args: any[]) => void;

class EventTargetStub {
  private listeners = new Map<string, Listener[]>();

  addListener(name: string, cb: Listener) {
    const list = this.listeners.get(name) ?? [];
    list.push(cb);
    this.listeners.set(name, list);
    return {
      remove: () => {
        const next = (this.listeners.get(name) ?? []).filter(
          (listener) => listener !== cb
        );
        this.listeners.set(name, next);
      },
    };
  }

  trigger(name: string, event?: any) {
    (this.listeners.get(name) ?? []).forEach((cb) => cb(event));
  }
}

export class LatLng {
  constructor(private _lat: number, private _lng: number) {}
  lat() {
    return this._lat;
  }
  lng() {
    return this._lng;
  }
}

export class LatLngBounds {
  public points: LatLng[] = [];
  extend(latLng: LatLng) {
    this.points.push(latLng);
  }
}

export class MVCArray<T> {
  constructor(private items: T[]) {}
  getArray() {
    return this.items;
  }
}

export class MapMock extends EventTargetStub {
  public options: any;
  public bounds = new LatLngBounds();
  public setOptions = jest.fn((options: any) => {
    this.options = { ...this.options, ...options };
  });
  public setCenter = jest.fn();
  public setZoom = jest.fn();
  public fitBounds = jest.fn();

  constructor(public element: HTMLElement, options: any) {
    super();
    this.options = options;
  }

  getBounds() {
    return this.bounds;
  }
}

export class MarkerMock extends EventTargetStub {
  public infoWindow?: InfoWindowMock;
  public custom?: unknown;
  private _position: LatLng | null = null;
  public setMap = jest.fn();
  public setIcon = jest.fn();
  public setLabel = jest.fn();
  public setTitle = jest.fn();
  public setDraggable = jest.fn();
  public setZIndex = jest.fn();

  constructor(public options: any) {
    super();
    if (options?.position) {
      const pos = options.position;
      if (pos instanceof LatLng) {
        this._position = pos;
      } else if (typeof pos?.lat === "function" && typeof pos?.lng === "function") {
        this._position = new LatLng(pos.lat(), pos.lng());
      } else {
        this._position = new LatLng(pos.lat, pos.lng);
      }
    }
  }

  getPosition() {
    return this._position;
  }
}

export class InfoWindowMock extends EventTargetStub {
  public open = jest.fn();
  public close = jest.fn();
  constructor(public options: any) {
    super();
  }
}

export class PolygonMock extends EventTargetStub {
  public setMap = jest.fn();
  private paths: any;

  constructor(public options: any) {
    super();
    this.paths = options.paths;
  }

  getPath() {
    return new MVCArray(this.paths);
  }
}

export class DrawingManagerMock extends EventTargetStub {
  public setMap = jest.fn();
  public setOptions = jest.fn();
  constructor(public options: any) {
    super();
  }
}

export class PlacesServiceMock {
  constructor(public map: any) {}
}

export class AutocompleteServiceMock {}

export class AutocompleteMock {
  constructor(public input: HTMLInputElement, public options: any) {}
}

export class GeocoderMock {}

export function installGoogleMapsMock() {
  const maps = {
    Map: MapMock,
    InfoWindow: InfoWindowMock,
    Polygon: PolygonMock,
    LatLng,
    LatLngBounds,
    MVCArray,
    MapTypeId: {
      HYBRID: "HYBRID",
      SATELLITE: "SATELLITE",
      TERRAIN: "TERRAIN",
      ROADMAP: "ROADMAP",
    },
    Marker: Object.assign(MarkerMock, {
      MAX_ZINDEX: 999,
    }),
    drawing: {
      DrawingManager: DrawingManagerMock,
      OverlayType: {
        POLYGON: "POLYGON",
        POLYLINE: "POLYLINE",
        RECTANGLE: "RECTANGLE",
        CIRCLE: "CIRCLE",
        MARKER: "MARKER",
      },
    },
    geometry: {
      encoding: {
        encodePath: jest.fn(() => "encoded"),
        decodePath: jest.fn(() => [new LatLng(1, 2)]),
      },
    },
    places: {
      PlacesService: PlacesServiceMock,
      AutocompleteService: AutocompleteServiceMock,
      Autocomplete: AutocompleteMock,
    },
    Geocoder: GeocoderMock,
  };

  (globalThis as any).google = { maps };

  return maps;
}

export function teardownGoogleMapsMock() {
  delete (globalThis as any).google;
}
