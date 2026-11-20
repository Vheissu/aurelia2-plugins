import {
  bindable,
  customElement,
  ICustomElementViewModel,
  INode,
} from "@aurelia/runtime-html";

import { queueTask } from "@aurelia/runtime";
import { IGoogleMapsConfiguration } from "./configure";
import { IGoogleMapsAPI } from "./google-maps-api";
import { IMarkerClustering } from "./marker-clustering";

import { Events } from "./events";
import { ILogger, inject, type IDisposable } from "@aurelia/kernel";
import type {
  DrawingControlOptions,
  DrawingManager,
  DrawingManagerConstructor,
  DrawingManagerOptions,
  GoogleMapsEvent,
  MarkerInput,
  OverlayCompleteDetail,
  OverlayCompleteEvent,
  PolygonInput,
} from "./types";

type MarkerWithIcons = google.maps.Marker & {
  custom?: { altIcon?: google.maps.MarkerOptions['icon']; defaultIcon?: google.maps.MarkerOptions['icon'] };
};

export interface IGoogleMaps extends GoogleMaps {}

@customElement({
  name: "google-map",
  template: "",
})
@inject(INode, IGoogleMapsConfiguration, IGoogleMapsAPI, IMarkerClustering, ILogger)
export class GoogleMaps implements ICustomElementViewModel {
  private _currentInfoWindow: google.maps.InfoWindow | null = null;

  @bindable longitude: number = 0;
  @bindable latitude: number = 0;
  @bindable zoom: number = 8;
  @bindable disableDefaultUi: boolean = false;
  @bindable markers: MarkerInput[] = [];
  @bindable autoUpdateBounds: boolean = false;
  @bindable autoInfoWindow: boolean = true;
  @bindable mapType = "ROADMAP";
  @bindable options: google.maps.MapOptions = {};
  @bindable mapLoaded?: (map: google.maps.Map) => void;
  @bindable onEvent?: (event: GoogleMapsEvent) => void;
  @bindable drawEnabled: boolean = false;
  @bindable drawMode = "MARKER";
  @bindable polygons: Array<PolygonInput | string> = [];
  @bindable drawingControl = true;
  @bindable drawingControlOptions: DrawingControlOptions = {};

  public map: google.maps.Map | null = null;
  public _renderedMarkers: google.maps.Marker[] = [];
  public _markersSubscription: IDisposable | null = null;
  public _scriptPromise: Promise<void> | null = null;
  public _mapPromise: Promise<void> | null = null;
  public _mapResolve: (() => void) | null = null;
  public drawingManager: DrawingManager | null = null;
  public _renderedPolygons: google.maps.Polygon[] = [];
  public _polygonsSubscription: IDisposable | null = null;

  /** Bound element event handlers for proper cleanup */
  private _onStartMarkerHighlight = (data: Event) => {
    const detail = (data as CustomEvent).detail;
    const marker = this._renderedMarkers[detail.index];
    if (!marker) return;
    const custom = (marker as MarkerWithIcons).custom;
    if (custom?.altIcon) {
      marker.setIcon(custom.altIcon);
    }
    marker.setZIndex(google.maps.Marker.MAX_ZINDEX + 1);
  };

  private _onStopMarkerHighlight = (data: Event) => {
    const detail = (data as CustomEvent).detail;
    const marker = this._renderedMarkers[detail.index];
    if (!marker) return;
    const custom = (marker as MarkerWithIcons).custom;
    if (custom?.defaultIcon) {
      marker.setIcon(custom.defaultIcon);
    }
  };

  private _onPanToMarker = (data: Event) => {
    const detail = (data as CustomEvent).detail;
    const marker = this._renderedMarkers[detail.index];
    if (!marker) return;
    const position = marker.getPosition();
    if (position) {
      this.map?.panTo(position);
      this.map?.setZoom(17);
    }
  };

  private _onClearMarkers = () => {
    this.clearMarkers();
  };

  private _onDragStart = (evt: Event) => {
    evt.preventDefault();
  };

  private _onZoomToBounds = () => {
    this.zoomToMarkerBounds(true);
  };

  /** Google Maps event listeners for cleanup */
  private _mapListeners: google.maps.MapsEventListener[] = [];
  private _polygonRevision = 0;

  constructor(
    readonly element: HTMLElement,
    readonly config: IGoogleMapsConfiguration,
    readonly googleMapsApi: IGoogleMapsAPI,
    readonly markerClustering: IMarkerClustering,
    readonly logger: ILogger
  ) {
    this.logger.scopeTo("aurelia2-google-maps");

    const loaderOptions = this.config.getLoaderOptions();
    if (
      !loaderOptions.key &&
      !config.get("apiKey") &&
      config.get("apiKey") !== false &&
      !config.get("client") &&
      config.get("client") !== false
    ) {
      this.logger.error("No API key or client ID has been specified.");
    }

    this.markerClustering.loadScript();
  }

  binding() {
    this._scriptPromise = this.googleMapsApi.getMapsInstance();
    this._mapPromise = new Promise<void>((resolve) => {
      this._mapResolve = resolve;
    });
  }

  bound() {
    this.markersChanged(this.markers);
    this.polygonsChanged(this.polygons);
  }

  private addElementListeners() {
    this.element.addEventListener(
      Events.START_MARKER_HIGHLIGHT,
      this._onStartMarkerHighlight
    );

    this.element.addEventListener(
      Events.STOP_MARKER_HIGHLIGHT,
      this._onStopMarkerHighlight
    );

    this.element.addEventListener(
      Events.PAN_TO_MARKER,
      this._onPanToMarker
    );

    this.element.addEventListener(
      Events.CLEAR_MARKERS,
      this._onClearMarkers
    );
  }

  clearMarkers() {
    if (!this._renderedMarkers) {
      return;
    }

    this._renderedMarkers.forEach(function (marker) {
      marker.setMap(null);
    });

    this._renderedMarkers = [];

    if (this.markerClustering) {
      this.markerClustering.clearMarkers();
    }
  }

  attached() {
    this.addElementListeners();
    this.element.addEventListener("dragstart", this._onDragStart);
    this.element.addEventListener("zoom_to_bounds", this._onZoomToBounds);

    const ready = this._mapPromise;
    this._scriptPromise?.then(() => {
      if (this._mapPromise !== ready) return;

      const latLng = new google.maps.LatLng(
        Number(this.latitude),
        Number(this.longitude)
      );

      const options: google.maps.MapOptions = Object.assign(
        {},
        this.options,
        this.config.get("options"),
        {
          center: latLng,
          zoom: parseInt(this.zoom as unknown as string, 10),
          disableDefaultUI: this.disableDefaultUi,
          mapTypeId: this.getMapTypeId(),
        }
      );

      this.map = new google.maps.Map(this.element, options);

      // Add event listener for click event
      this._mapListeners.push(
        this.map.addListener("click", (e: google.maps.MapMouseEvent) => {
          this.emitEvent(
            { type: Events.MAPCLICK, event: e },
            Events.MAPCLICK,
            e
          );

          // If there is an infoWindow open, close it
          if (!this.autoInfoWindow) return;

          if (this._currentInfoWindow) {
            this._currentInfoWindow.close();

            // Dispatch and event that the info window has been closed
            this.emitEvent(
              {
                type: Events.INFOWINDOWCLOSE,
                infoWindow: this._currentInfoWindow,
              },
              Events.INFOWINDOWCLOSE,
              { infoWindow: this._currentInfoWindow }
            );
          }
        })
      );

      /**
       * As a proxy for the very noisy bounds_changed event, we'll
       * listen to these two instead:
       *
       * dragend */
      this._mapListeners.push(
        this.map.addListener("dragend", () => {
          this.sendBoundsEvent();
        })
      );
      /* zoom_changed */
      this._mapListeners.push(
        this.map.addListener("zoom_changed", () => {
          this.sendBoundsEvent();
        })
      );
      this.mapLoaded?.(this.map);
    }).catch((error: unknown) => {
      if (this._mapPromise === ready) {
        this.logger.error("Failed to initialize Google Maps.", error);
      }
    }).finally(() => {
      if (this._mapPromise === ready) this._mapResolve?.();
    });
  }

  detaching() {
    this._mapResolve?.();
    this._mapResolve = null;
    this._mapPromise = null;
    // Remove element event listeners
    this.element.removeEventListener(Events.START_MARKER_HIGHLIGHT, this._onStartMarkerHighlight);
    this.element.removeEventListener(Events.STOP_MARKER_HIGHLIGHT, this._onStopMarkerHighlight);
    this.element.removeEventListener(Events.PAN_TO_MARKER, this._onPanToMarker);
    this.element.removeEventListener(Events.CLEAR_MARKERS, this._onClearMarkers);
    this.element.removeEventListener("dragstart", this._onDragStart);
    this.element.removeEventListener("zoom_to_bounds", this._onZoomToBounds);

    // Remove Google Maps event listeners
    for (const listener of this._mapListeners) {
      listener.remove();
    }
    this._mapListeners = [];

    // Clean up markers and polygons
    this.clearMarkers();
    this.clearPolygons();

    // Destroy drawing manager
    this.destroyDrawingManager();

    // Close any open info window
    this._currentInfoWindow?.close();
    this._currentInfoWindow = null;

    this.map = null;
  }

  /**
   * Send the map bounds as a DOM Event
   *
   * The `bounds` object is an instance of `LatLngBounds`
   * See https://developers.google.com/maps/documentation/javascript/reference#LatLngBounds
   */
  sendBoundsEvent() {
    const bounds = this.map?.getBounds();
    if (!bounds) return;

    this.emitEvent(
      { type: Events.BOUNDSCHANGED, bounds },
      Events.BOUNDSCHANGED,
      { bounds }
    );
  }

  /**
   * Render a marker on the map and add it to collection of rendered markers
   *
   * @param marker
   *
   */
  async renderMarker(marker: MarkerInput, index = 0): Promise<void> {
    const ready = this._mapPromise;
    await ready;
    const map = this.map;
    if (!map || this._mapPromise !== ready) {
      return;
    }

    const position = this.resolveMarkerPosition(marker);
    if (!position) {
      return;
    }

    const { infoWindow, custom, latitude: _latitude, longitude: _longitude, ...markerOptions } =
      marker;
    const createdMarker = await this.createMarker({
      ...markerOptions,
      map,
      position,
    });
    if (this.map !== map) {
      createdMarker.setMap(null);
      return;
    }
    const createdMarkerAny = createdMarker as google.maps.Marker & {
      infoWindow?: google.maps.InfoWindow;
      custom?: unknown;
    };

    createdMarker.addListener("click", () => {
      this.emitEvent(
        {
          type: Events.MARKERCLICK,
          marker,
          markerInstance: createdMarker,
          index,
        },
        Events.MARKERCLICK,
        { marker, createdMarker, index }
      );

      if (!this.autoInfoWindow) return;

      if (this._currentInfoWindow) {
        this._currentInfoWindow.close();
      }

      if (!createdMarkerAny.infoWindow) {
        this._currentInfoWindow = null;

        return;
      }

      this._currentInfoWindow = createdMarkerAny.infoWindow;
      createdMarkerAny.infoWindow.open(this.map, createdMarker);
    });

    createdMarker.addListener("mouseover", () => {
      this.emitEvent(
        {
          type: Events.MARKERMOUSEOVER,
          markerInstance: createdMarker,
          index,
        },
        Events.MARKERMOUSEOVER,
        { marker: createdMarker, index }
      );
      createdMarker.setZIndex(google.maps.Marker.MAX_ZINDEX + 1);
    });

    createdMarker.addListener("mouseout", () => {
      this.emitEvent(
        {
          type: Events.MARKERMOUSEOUT,
          markerInstance: createdMarker,
          index,
        },
        Events.MARKERMOUSEOUT,
        { marker: createdMarker, index }
      );
    });

    createdMarker.addListener("dblclick", () => {
      this.map?.setZoom(15);
      const position = createdMarker.getPosition();
      if (position) {
        this.map?.panTo(position);
      }
    });

    if (marker.icon) {
      createdMarker.setIcon(marker.icon);
    }

    if (marker.label) {
      createdMarker.setLabel(marker.label);
    }

    if (marker.title) {
      createdMarker.setTitle(marker.title);
    }

    if (marker.draggable !== undefined) {
      createdMarker.setDraggable(marker.draggable);
    }

    if (infoWindow) {
      createdMarkerAny.infoWindow = new google.maps.InfoWindow({
        content: infoWindow.content,
        pixelOffset: infoWindow.pixelOffset,
        position: infoWindow.position,
        maxWidth: infoWindow.maxWidth,
      });

      createdMarkerAny.infoWindow.addListener("domready", () => {
        this.emitEvent(
          {
            type: Events.INFOWINDOWSHOW,
            infoWindow: createdMarkerAny.infoWindow,
            markerInstance: createdMarker,
          },
          Events.INFOWINDOWSHOW,
          { infoWindow: createdMarkerAny.infoWindow }
        );
      });

      createdMarkerAny.infoWindow.addListener("closeclick", () => {
        this.emitEvent(
          {
            type: Events.INFOWINDOWCLOSE,
            infoWindow: createdMarkerAny.infoWindow,
            markerInstance: createdMarker,
          },
          Events.INFOWINDOWCLOSE,
          { infoWindow: createdMarkerAny.infoWindow }
        );
      });
    }

    if (custom) {
      createdMarkerAny.custom = custom;
    }

    this._renderedMarkers.push(createdMarker);

    this.emitEvent(
      {
        type: Events.MARKERRENDERED,
        marker,
        markerInstance: createdMarker,
        index,
      },
      Events.MARKERRENDERED,
      { createdMarker, marker, index }
    );
  }

  setOptions(options: google.maps.MapOptions) {
    if (!this.map) {
      return;
    }

    this.map.setOptions(options);
  }

  optionsChanged(newValue: google.maps.MapOptions) {
    if (newValue) {
      this.setOptions(newValue);
    }
  }

  private emitEvent(
    event: GoogleMapsEvent,
    domEvent: string,
    detail: unknown
  ) {
    dispatchEvent(domEvent, detail, this.element);
    this.onEvent?.(event);
  }

  private resolveMarkerPosition(marker: MarkerInput) {
    if (marker.position) {
      return marker.position;
    }

    if (marker.latitude !== undefined && marker.longitude !== undefined) {
      const lat = Number(marker.latitude);
      const lng = Number(marker.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        this.logger.warn("Marker returned NaN for lat/lng", {
          marker,
          lat,
          lng,
        });
        return null;
      }
      return { lat, lng };
    }

    this.logger.warn("Marker is missing position or latitude/longitude", {
      marker,
    });
    return null;
  }

  async getGeocoder() {
    await this._mapPromise;
    await this.googleMapsApi.importLibrary("geocoding");
    if (!this.map) {
      throw new Error("Map has not been initialized yet.");
    }
    return new google.maps.Geocoder();
  }

  async getPlacesService() {
    await this._mapPromise;
    await this.googleMapsApi.importLibrary("places");
    if (!this.map) {
      throw new Error("Map has not been initialized yet.");
    }
    return new google.maps.places.PlacesService(this.map);
  }

  async getAutocompleteService() {
    await this._mapPromise;
    await this.googleMapsApi.importLibrary("places");
    return new google.maps.places.AutocompleteService();
  }

  async createAutocomplete(
    input: HTMLInputElement,
    options?: google.maps.places.AutocompleteOptions
  ) {
    await this._mapPromise;
    await this.googleMapsApi.importLibrary("places");
    return new google.maps.places.Autocomplete(input, options);
  }

  createMarker(options: google.maps.MarkerOptions) {
    const ready = this._scriptPromise ?? Promise.resolve();
    return ready.then(() => new google.maps.Marker(options));
  }

  getCenter() {
    return this._mapPromise?.then(() => this.map?.getCenter()) ?? Promise.resolve(undefined);
  }

  setCenter(latLong: google.maps.LatLng | google.maps.LatLngLiteral) {
    if (latLong) {
      this._mapPromise?.then(() => {
        if (!this.map) {
          return;
        }
        this.map.setCenter(latLong);
        this.sendBoundsEvent();
      });
    }
  }

  updateCenter() {
    const latitude = Number(this.latitude);
    const longitude = Number(this.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      this.setCenter({ lat: latitude, lng: longitude });
    }
  }

  latitudeChanged() {
    this._mapPromise?.then(() => {
      queueTask(() => {
        this.updateCenter();
      });
    });
  }

  longitudeChanged() {
    this._mapPromise?.then(() => {
      queueTask(() => {
        this.updateCenter();
      });
    });
  }

  zoomChanged(newValue: number | string) {
    this._mapPromise?.then(() => {
      queueTask(() => {
        const zoomValue = parseInt(newValue as string, 10);
        this.map?.setZoom(zoomValue);
      });
    });
  }

  /**
   * Observing changes in the entire markers object. This is critical in case the user sets marker to a new empty Array,
   * where we need to resubscribe Observers and delete all previously rendered markers.
   *
   * @param newValue
   */
  markersChanged(newValue: MarkerInput[]) {
    this.logger.debug("Markers changed", newValue);
    this.clearMarkers();
    this.markerCollectionChange();

    if (!newValue?.length) {
      return;
    }
  }

  /**
   * Handle the change to the marker collection. Collection observer returns an array of splices which contains
   * information about the change to the collection.
   *
   */
  async markerCollectionChange() {
    if (!this.markers?.length) {
      this.clearMarkers();
      return;
    }

    const ready = this._mapPromise;
    await ready;
    if (!this.map || this._mapPromise !== ready) return;

    this.clearMarkers();

    await Promise.all(
      this.markers.map((marker, index) => this.renderMarker(marker, index))
    );

    if (this.map) {
      this.markerClustering.renderClusters(this.map, this._renderedMarkers);
    }

    queueTask(() => {
      this.zoomToMarkerBounds();
    });
  }

  zoomToMarkerBounds(force = false) {
    if (!force && (!this.autoUpdateBounds || (!this._renderedMarkers.length && !this._renderedPolygons.length))) {
      return;
    }

    this._mapPromise?.then(() => {
      const bounds = new google.maps.LatLngBounds();

      for (const marker of this._renderedMarkers) {
        // extend the bounds to include each marker's position

        const position = marker.getPosition();
        if (!position) {
          continue;
        }

        const lat = position.lat();
        const lng = position.lng();

        if (isNaN(lat) || isNaN(lng)) {
          this.logger.warn("Marker returned NaN for lat/lng", { marker, lat, lng });

          return;
        }

        const markerLatLng = new google.maps.LatLng(position.lat(), position.lng());
        bounds.extend(markerLatLng);
      }

      for (const polygon of this._renderedPolygons) {
        polygon.getPath().forEach((element) => {
          bounds.extend(element);
        });
      }

      this.map?.fitBounds(bounds);
    });
  }

  getMapTypeId() {
    if (this.mapType.toUpperCase() === "HYBRID") {
      return google.maps.MapTypeId.HYBRID;
    } else if (this.mapType.toUpperCase() === "SATELLITE") {
      return google.maps.MapTypeId.SATELLITE;
    } else if (this.mapType.toUpperCase() === "TERRAIN") {
      return google.maps.MapTypeId.TERRAIN;
    }

    return google.maps.MapTypeId.ROADMAP;
  }

  /*************************************************************************
   * Google Maps Drawing Manager
   * The below methods are related to the drawing manager, and exposing some
   * of the Google Maps Drawing API out
   *************************************************************************/

  /**
   * Initialize the drawing manager
   *
   * @param options - the option object passed into the drawing manager
   */
  async initDrawingManager(
    options: DrawingManagerOptions = {}
  ) {
    await this._mapPromise;
    await this.googleMapsApi.importLibrary("drawing");
    await this.googleMapsApi.importLibrary("geometry");

    if (this.drawingManager) return;

    const config = Object.assign(
      {},
      {
        drawingMode: this.getOverlayType(this.drawMode),
        drawingControl: this.drawingControl,
        drawingControlOptions: this.drawingControlOptions,
      },
      options
    );
    // `DrawingManager` lost its typings in @types/google.maps 3.65; the
    // constructor still accepts options at runtime.
    const DrawingManagerCtor = google.maps.drawing
      .DrawingManager as unknown as DrawingManagerConstructor;
    this.drawingManager = new DrawingManagerCtor(config);

    this.drawingManager.addListener("overlaycomplete", (evt) => {
      const overlayEvent = evt as OverlayCompleteEvent &
        OverlayCompleteDetail;
      if (
        overlayEvent.type.toUpperCase() === "POLYGON" ||
        overlayEvent.type.toUpperCase() === "POLYLINE"
      ) {
        const path = (overlayEvent.overlay as google.maps.Polygon | google.maps.Polyline).getPath();
        Object.assign(overlayEvent, {
          path: path.getArray().map((x) => {
            return { latitude: x.lat(), longitude: x.lng() };
          }),
          encode: this.encodePath(path),
        });
      }

      this.emitEvent(
        { type: Events.MAPOVERLAYCOMPLETE, event: overlayEvent },
        Events.MAPOVERLAYCOMPLETE,
        overlayEvent
      );
    });
  }

  /**
   * Destroy the drawing manager when no longer required
   */
  destroyDrawingManager() {
    // Has not been initialized or has been destroyed, just ignore
    if (!this.drawingManager) return;
    // Remove the map and then remove the reference
    this.drawingManager.setMap(null);
    this.drawingManager = null;
  }

  /**
   * Get the given constant that Google's library uses. Defaults to MARKER
   * @param type
   */
  getOverlayType(type: string = "") {
    switch (type.toUpperCase()) {
      case "POLYGON":
        return google.maps.drawing.OverlayType.POLYGON;
      case "POLYLINE":
        return google.maps.drawing.OverlayType.POLYLINE;
      case "RECTANGLE":
        return google.maps.drawing.OverlayType.RECTANGLE;
      case "CIRCLE":
        return google.maps.drawing.OverlayType.CIRCLE;
      case "MARKER":
        return google.maps.drawing.OverlayType.MARKER;
      default:
        return null;
    }
  }

  /**
   * Update the editing state, called by aurelia binding
   * @param newval
   * @param oldval
   */
  drawEnabledChanged(newval: boolean, oldval: boolean) {
    this.initDrawingManager().then(() => {
      if (newval && !oldval) {
        this.drawingManager?.setMap(this.map);
      } else if (oldval && !newval) {
        this.destroyDrawingManager();
      }
    });
  }

  /**
   * Update the drawing mode, called by aurelia binding
   * @param newval
   */
  drawModeChanged(newval: string = "") {
    this.initDrawingManager().then(() => {
      this.drawingManager?.setOptions({
        drawingMode: this.getOverlayType(newval),
      });
    });
  }

  /*************************************************************************
   * POLYLINE ENCODING
   *************************************************************************/

  /**
   * Encode the given path to be a Polyline encoded string
   * more info: https://developers.google.com/maps/documentation/utilities/polylineutility
   * @param path
   */
  encodePath(path: Parameters<typeof google.maps.geometry.encoding.encodePath>[0] = []) {
    return google.maps.geometry.encoding.encodePath(path);
  }

  /**
   * Decode the given Polyline encoded string to be an array of Paths
   * more info: https://developers.google.com/maps/documentation/utilities/polylineutility
   * @param polyline
   */
  decodePath(polyline: string) {
    return google.maps.geometry.encoding.decodePath(polyline);
  }

  /*************************************************************************
   * POLYGONS
   *************************************************************************/

  /**
   * Render a single polygon on the map and add it to the _renderedPolygons
   * array.
   * @param polygonObject - paths defining a polygon or a string
   */
  renderPolygon(polygonObject: PolygonInput, index = 0) {
    const rawPaths = polygonObject.paths;

    if (!rawPaths) return;

    // `PolygonPathInput` accepts the plugin's `{ latitude, longitude }` shape,
    // which Google's own options type does not; normalising below produces a
    // value the API accepts.
    let paths = rawPaths as google.maps.PolygonOptions["paths"];

    if (Array.isArray(rawPaths)) {
      paths = rawPaths.map(point => {
        if ("lat" in point && "lng" in point) {
          if (typeof point.lat === "function") return point;
          return {
            lat: Number(point.lat),
            lng: Number(point.lng),
          };
        }

        if ("latitude" in point && "longitude" in point) {
          return {
            lat: Number(point.latitude),
            lng: Number(point.longitude),
          };
        }

        return point;
      });
    }

    const polygon = new google.maps.Polygon(
      Object.assign({}, polygonObject, { paths })
    );
    const polygonAny = polygon as google.maps.Polygon & {
      infoWindow?: google.maps.InfoWindow;
    };

    polygon.addListener("click", () => {
      this.emitEvent(
        {
          type: Events.POLYGONCLICK,
          polygon,
          polygonInput: polygonObject,
          index,
        },
        Events.POLYGONCLICK,
        { polygon, polygonObject, index }
      );
    });

    polygon.setMap(this.map);

    if (polygonObject.infoWindow) {
      polygonAny.infoWindow = new google.maps.InfoWindow({
        content: polygonObject.infoWindow.content,
        pixelOffset: polygonObject.infoWindow.pixelOffset,
        position: polygonObject.infoWindow.position,
        maxWidth: polygonObject.infoWindow.maxWidth,
      });
    }

    this._renderedPolygons.push(polygon);
    this.emitEvent(
      {
        type: Events.POLYGONRENDERED,
        polygon,
        polygonInput: polygonObject,
        index,
      },
      Events.POLYGONRENDERED,
      { polygon, polygonObject, index }
    );
  }

  polygonsChanged(newValue: Array<PolygonInput | string>) {
    this.polygonCollectionChange(newValue);
  }

  private clearPolygons() {
    for (const polygon of this._renderedPolygons) {
      polygon.setMap(null);
    }
    this._renderedPolygons = [];
  }

  polygonCollectionChange(polygons = this.polygons) {
    const revision = ++this._polygonRevision;
    const ready = this._mapPromise;
    this.clearPolygons();
    if (!ready || !polygons?.length) return;

    const isCurrent = () => this._mapPromise === ready && this._polygonRevision === revision;
    void ready.then(async () => {
      if (!isCurrent() || !this.map) return;
      if (polygons.some((polygon) => typeof polygon === "string")) {
        await this.googleMapsApi.importLibrary("geometry");
      }
      for (const [index, polygon] of polygons.entries()) {
        if (!isCurrent()) return;
        this.renderPolygon(
          typeof polygon === "string" ? { paths: this.decodePath(polygon) } : polygon,
          index
        );
      }
      this.zoomToMarkerBounds();
    }).catch((error: unknown) => {
      if (isCurrent()) this.logger.error("Failed to render map polygons.", error);
    });
  }
}

function dispatchEvent(
  name: string,
  detail: unknown,
  target: Element,
  bubbles = true
) {
  let changeEvent;

  if (typeof window.CustomEvent === "function") {
    changeEvent = new CustomEvent(name, { detail, bubbles });
  } else {
    changeEvent = document.createEvent("CustomEvent");
    changeEvent.initCustomEvent(name, bubbles, true, { data: detail });
  }

  target.dispatchEvent(changeEvent);
}
