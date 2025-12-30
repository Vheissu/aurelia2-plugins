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
import { ILogger, inject } from "@aurelia/kernel";
import type {
  GoogleMapsEvent,
  MarkerInput,
  OverlayCompleteDetail,
  PolygonInput,
} from "./types";

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
  @bindable drawingControlOptions: google.maps.drawing.DrawingControlOptions =
    {};

  public map: google.maps.Map | null = null;
  public _renderedMarkers: google.maps.Marker[] = [];
  public _markersSubscription: any = null;
  public _scriptPromise: Promise<void> | null = null;
  public _mapPromise: Promise<void> | null = null;
  public _mapResolve: (() => void) | null = null;
  public drawingManager: google.maps.drawing.DrawingManager | null = null;
  public _renderedPolygons: google.maps.Polygon[] = [];
  public _polygonsSubscription: any = null;

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
    this._scriptPromise = this.googleMapsApi.getMapsInstance();

    let self: GoogleMaps = this;
    this._mapPromise = this._scriptPromise.then(() => {
      return new Promise<void>((resolve) => {
        // Register the the resolve method for _mapPromise
        self._mapResolve = resolve;
      });
    });

    /**
     * Events which the element listens to
     */
    this.element.addEventListener(
      Events.START_MARKER_HIGHLIGHT,
      (data: any) => {
        const marker = self._renderedMarkers[data.detail.index];
        const custom = (marker as any)?.custom;
        if (custom?.altIcon) {
          marker.setIcon(custom.altIcon);
        }
        marker.setZIndex(google.maps.Marker.MAX_ZINDEX + 1);
      }
    );

    this.element.addEventListener(Events.STOP_MARKER_HIGHLIGHT, (data: any) => {
      const marker = self._renderedMarkers[data.detail.index];
      const custom = (marker as any)?.custom;
      if (custom?.defaultIcon) {
        marker.setIcon(custom.defaultIcon);
      }
    });

    this.element.addEventListener(Events.PAN_TO_MARKER, (data: any) => {
      const marker = self._renderedMarkers[data.detail.index];
      const position = marker.getPosition();
      if (position) {
        self.map?.panTo(position);
        self.map?.setZoom(17);
      }
    });

    this.element.addEventListener(Events.CLEAR_MARKERS, () => {
      this.clearMarkers();
    });
  }

  bound() {
    this.markersChanged(this.markers);
    this.polygonsChanged(this.polygons);
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
    this.element.addEventListener("dragstart", (evt) => {
      evt.preventDefault();
    });

    this.element.addEventListener("zoom_to_bounds", () => {
      this.zoomToMarkerBounds(true);
    });

    this._scriptPromise?.then(() => {
      let latLng = new google.maps.LatLng(
        parseFloat(<any>this.latitude),
        parseFloat(<any>this.longitude)
      );
      let mapTypeId = this.getMapTypeId();

      let options: google.maps.MapOptions = Object.assign(
        {},
        this.options,
        this.config.get("options"),
        {
          center: latLng,
          zoom: parseInt(<any>this.zoom, 10),
          disableDefaultUI: this.disableDefaultUi,
          mapTypeId: mapTypeId,
        }
      );

      this.map = new google.maps.Map(this.element, options);
      this.mapLoaded?.(this.map);
      this._mapResolve?.();

      // Add event listener for click event
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
      });

      /**
       * As a proxy for the very noisy bounds_changed event, we'll
       * listen to these two instead:
       *
       * dragend */
      this.map.addListener("dragend", () => {
        this.sendBoundsEvent();
      });
      /* zoom_changed */
      this.map.addListener("zoom_changed", () => {
        this.sendBoundsEvent();
      });
    });
  }

  /**
   * Send the map bounds as a DOM Event
   *
   * The `bounds` object is an instance of `LatLngBounds`
   * See https://developers.google.com/maps/documentation/javascript/reference#LatLngBounds
   */
  sendBoundsEvent() {
    let bounds = this.map?.getBounds();
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
    await this._mapPromise;
    if (!this.map) {
      return;
    }

    const position = this.resolveMarkerPosition(marker);
    if (!position) {
      return;
    }

    const { infoWindow, custom, latitude, longitude, ...markerOptions } =
      marker;
    const createdMarker = await this.createMarker({
      ...markerOptions,
      map: this.map,
      position,
    });
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
      if (createdMarker.position) {
        this.map?.panTo(createdMarker.position);
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
    detail: any
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
      this._mapPromise.then(() => {
        if (!this.map) {
          return;
        }
        this.map.setCenter(latLong);
        this.sendBoundsEvent();
      });
    }
  }

  updateCenter() {
    if (this.latitude && this.longitude) {
      this._mapPromise.then(() => {
        let latLng = new google.maps.LatLng(
          parseFloat(<any>this.latitude),
          parseFloat(<any>this.longitude)
        );
  
        if (latLng) {
          this.setCenter(latLng);
        }
      });
    }
  }

  latitudeChanged() {
    this._mapPromise.then(() => {
      queueTask(() => {
        this.updateCenter();
      });
    });
  }

  longitudeChanged() {
    this._mapPromise.then(() => {
      queueTask(() => {
        this.updateCenter();
      });
    });
  }

  zoomChanged(newValue: any) {
    this._mapPromise.then(() => {
      queueTask(() => {
        let zoomValue = parseInt(newValue, 10);
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

    await this._mapPromise;

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
    if (typeof force === "undefined") {
      force = false;
    }

    // Unless forced, if there's no markers, or not auto update bounds
    if (!force && (!this._renderedMarkers || !this.autoUpdateBounds)) {
      return;
    }

    this._mapPromise.then(() => {
      let bounds = new google.maps.LatLngBounds();

      for (let marker of this._renderedMarkers) {
        // extend the bounds to include each marker's position

        const position = marker.getPosition();
        if (!position) {
          continue;
        }

        let lat = parseFloat(<string>position.lat());
        let lng = parseFloat(<string>position.lng());

        if (isNaN(lat) || isNaN(lng)) {
          console.warn(`Marker returned NaN for lat/lng`, { marker, lat, lng });

          return;
        }

        let markerLatLng = new google.maps.LatLng(
          parseFloat(<string>position.lat()),
          parseFloat(<string>position.lng())
        );
        bounds.extend(markerLatLng);
      }

      for (let polygon of this._renderedPolygons) {
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
    options: google.maps.drawing.DrawingManagerOptions = {}
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
    this.drawingManager = new google.maps.drawing.DrawingManager(config);

    this.drawingManager.addListener("overlaycomplete", (evt) => {
      const overlayEvent = evt as google.maps.drawing.OverlayCompleteEvent &
        OverlayCompleteDetail;
      if (
        overlayEvent.type.toUpperCase() == "POLYGON" ||
        overlayEvent.type.toUpperCase() == "POLYLINE"
      ) {
        Object.assign(overlayEvent, {
          path: overlayEvent.overlay
            .getPath()
            .getArray()
            .map((x) => {
              return { latitude: x.lat(), longitude: x.lng() };
            }),
          encode: this.encodePath(overlayEvent.overlay.getPath()),
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
  encodePath(path: any = []) {
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
    let paths = polygonObject.paths;

    if (!paths) return;

    if (Array.isArray(paths)) {
      paths = paths.map((point: any) => {
        if (typeof point?.lat === "function" && typeof point?.lng === "function") {
          return point;
        }

        if ("lat" in point && "lng" in point) {
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

    this._renderedPolygons.push(polygon);
  }

  /**
   * Observing changes in the entire polygons object. This is critical in
   * case the user sets polygons to a new empty Array, where we need to
   * resubscribe Observers and delete all previously rendered polygons.
   *
   * @param newValue
   */
  polygonsChanged(newValue: Array<PolygonInput | string>) {
    for (let polygon of this._renderedPolygons) {
      polygon.setMap(null);
    }

    // And empty the renderMarkers collection
    this._renderedPolygons = [];

    this.polygonCollectionChange();

    if (!newValue.length) return;

    // Render all markers again
    this._mapPromise?.then(async () => {
      await this.googleMapsApi.importLibrary("geometry");

      const polygons = await Promise.all(
        newValue.map((polygon) => {
          if (typeof polygon === "string") {
            return {
              paths: this.decodePath(polygon),
            } as PolygonInput;
          }
          return polygon;
        })
      );

      await Promise.all(
        polygons.map((polygon, index) =>
          this.renderPolygon(polygon as PolygonInput, index)
        )
      );

      queueTask(() => {
        this.zoomToMarkerBounds();
      });
    });
  }

  /**
   * Handle the change to the polygon collection. Collection observer returns an array of splices which contains
   * information about the change to the collection.
   *
   */
  polygonCollectionChange() {
    for (const [i, renderedPolygon] of this._renderedPolygons.entries()) {
      renderedPolygon.setMap(null);
      this._renderedPolygons.splice(i, 1);
    }

    this._mapPromise
      ?.then(async () => {
        await this.googleMapsApi.importLibrary("geometry");
        for (const [index, addedPolygon] of this.polygons.entries()) {
          const polygonInput =
            typeof addedPolygon === "string"
              ? ({ paths: this.decodePath(addedPolygon) } as PolygonInput)
              : addedPolygon;
          this.renderPolygon(polygonInput, index);
        }
      })
      .then(() => {
        queueTask(() => {
          this.zoomToMarkerBounds();
        });
      });
  }
}

function dispatchEvent(
  name: string,
  detail: any,
  target: Element,
  bubbles = true
) {
  let changeEvent;

  if ((<any>window).CustomEvent) {
    changeEvent = new CustomEvent(name, { detail, bubbles });
  } else {
    changeEvent = document.createEvent("CustomEvent");
    changeEvent.initCustomEvent(name, bubbles, true, { data: detail });
  }

  target.dispatchEvent(changeEvent);
}
