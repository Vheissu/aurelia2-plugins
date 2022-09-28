import {
  bindable,
  customElement,
  ICustomElementViewModel,
  IObserverLocator,
  IPlatform,
} from "@aurelia/runtime-html";

import { IGoogleMapsConfiguration } from "./configure";
import { IGoogleMapsAPI } from "./google-maps-api";
import { IMarkerClustering } from "./marker-clustering";

import { Events } from "./events";
import { ILogger } from "@aurelia/kernel";

declare let google: any;
export interface Marker {
  icon?: string;
  label?: string;
  title?: string;
  draggable?: boolean;
  custom?: any;
  infoWindow?: {
    pixelOffset?: number;
    content: string;
    position?: number;
    maxWidth?: number;
  };
  latitude: number | string;
  longitude: number | string;
}

export interface IGoogleMaps extends GoogleMaps {}

@customElement({
  name: "google-map",
  template: "",
})
export class GoogleMaps implements ICustomElementViewModel {
  private _currentInfoWindow: any = null;

  @bindable longitude: number = 0;
  @bindable latitude: number = 0;
  @bindable zoom: number = 8;
  @bindable disableDefaultUi: boolean = false;
  @bindable markers: any = [];
  @bindable autoUpdateBounds: boolean = false;
  @bindable autoInfoWindow: boolean = true;
  @bindable mapType = "ROADMAP";
  @bindable options = {};
  @bindable mapLoaded: any;
  @bindable drawEnabled: boolean = false;
  @bindable drawMode = "MARKER";
  @bindable polygons: any = [];
  @bindable drawingControl: true;
  @bindable drawingControlOptions: {};

  public map: any = null;
  public _renderedMarkers: any[] = [];
  public _markersSubscription: any = null;
  public _scriptPromise: Promise<any> | any = null;
  public _mapPromise: Promise<any> | any = null;
  public _mapResolve: Promise<any> | any = null;
  public drawingManager: any = null;
  public _renderedPolygons: any = [];
  public _polygonsSubscription: any = null;

  constructor(
    readonly element: Element,
    @IGoogleMapsConfiguration readonly config: IGoogleMapsConfiguration,
    @IGoogleMapsAPI readonly googleMapsApi: IGoogleMapsAPI,
    @IMarkerClustering readonly markerClustering: IMarkerClustering,
    @IObserverLocator readonly observerLocator: IObserverLocator,
    @ILogger readonly logger: ILogger,
    @IPlatform readonly platform: IPlatform
  ) {
    this.logger.scopeTo("aurelia2-google-maps");

    if (!config.get("apiScript")) {
      this.logger.error("No API script is defined.");
    }

    if (
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
      return new Promise((resolve) => {
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
        let marker: any = self._renderedMarkers[data.detail.index];
        marker.setIcon(marker.custom.altIcon);
        marker.setZIndex((<any>window).google.maps.Marker.MAX_ZINDEX + 1);
      }
    );

    this.element.addEventListener(Events.STOP_MARKER_HIGHLIGHT, (data: any) => {
      let marker: any = self._renderedMarkers[data.detail.index];
      marker.setIcon(marker.custom.defaultIcon);
    });

    this.element.addEventListener(Events.PAN_TO_MARKER, (data: any) => {
      self.map.panTo(self._renderedMarkers[data.detail.index].position);
      self.map.setZoom(17);
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

    this._renderedMarkers.forEach(function (marker: any) {
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

    this._scriptPromise.then(() => {
      let latLng = new (<any>window).google.maps.LatLng(
        parseFloat(<any>this.latitude),
        parseFloat(<any>this.longitude)
      );
      let mapTypeId = this.getMapTypeId();

      let options: any = Object.assign(
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

      this.map = new (<any>window).google.maps.Map(this.element, options);
      if (this.mapLoaded) {
        this.mapLoaded(this.map);
      }
      this._mapResolve();

      // Add event listener for click event
      this.map.addListener("click", (e: Event) => {
        dispatchEvent(Events.MAPCLICK, e, this.element);

        // If there is an infoWindow open, close it
        if (!this.autoInfoWindow) return;

        if (this._currentInfoWindow) {
          this._currentInfoWindow.close();

          // Dispatch and event that the info window has been closed
          dispatchEvent(
            Events.INFOWINDOWCLOSE,
            { infoWindow: this._currentInfoWindow },
            this.element
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
    let bounds = this.map.getBounds();
    if (!bounds) return;

    dispatchEvent(Events.BOUNDSCHANGED, { bounds }, this.element);
  }

  /**
   * Render a marker on the map and add it to collection of rendered markers
   *
   * @param marker
   *
   */
  renderMarker(marker: Marker): Promise<void> {
    return this._mapPromise.then(() => {
      let markerLatLng = new (<any>window).google.maps.LatLng(
        parseFloat(<string>marker.latitude),
        parseFloat(<string>marker.longitude)
      );

      // Create the marker
      this.createMarker({
        map: this.map,
        position: markerLatLng,
      }).then((createdMarker: any) => {
        /* add event listener for click on the marker,
         * the event payload is the marker itself */
        createdMarker.addListener("click", () => {
          dispatchEvent(
            Events.MARKERCLICK,
            { marker, createdMarker },
            this.element
          );

          // Only continue if there autoInfoWindow is enabled
          if (!this.autoInfoWindow) return;

          if (this._currentInfoWindow) {
            this._currentInfoWindow.close();
          }

          if (!createdMarker.infoWindow) {
            this._currentInfoWindow = null;

            return;
          }

          this._currentInfoWindow = createdMarker.infoWindow;
          createdMarker.infoWindow.open(this.map, createdMarker);
        });

        /*add event listener for hover over the marker,
         *the event payload is the marker itself*/
        createdMarker.addListener("mouseover", () => {
          dispatchEvent(
            Events.MARKERMOUSEOVER,
            { marker: createdMarker },
            this.element
          );
          createdMarker.setZIndex(
            (<any>window).google.maps.Marker.MAX_ZINDEX + 1
          );
        });

        createdMarker.addListener("mouseout", () => {
          dispatchEvent(
            Events.MARKERMOUSEOUT,
            { marker: createdMarker },
            this.element
          );
        });

        createdMarker.addListener("dblclick", () => {
          this.map.setZoom(15);
          this.map.panTo(createdMarker.position);
        });

        // Set some optional marker properties if they exist
        if (marker.icon) {
          createdMarker.setIcon(marker.icon);
        }

        if (marker.label) {
          createdMarker.setLabel(marker.label);
        }

        if (marker.title) {
          createdMarker.setTitle(marker.title);
        }

        if (marker.draggable) {
          createdMarker.setDraggable(marker.draggable);
        }

        if (marker.infoWindow) {
          createdMarker.infoWindow = new (<any>window).google.maps.InfoWindow({
            content: marker.infoWindow.content,
            pixelOffset: marker.infoWindow.pixelOffset,
            position: marker.infoWindow.position,
            maxWidth: marker.infoWindow.maxWidth,
            parentMarker: { ...marker },
          });

          createdMarker.infoWindow.addListener("domready", () => {
            dispatchEvent(
              Events.INFOWINDOWSHOW,
              { infoWindow: createdMarker.infoWindow },
              this.element
            );
          });

          createdMarker.infoWindow.addListener("closeclick", () => {
            dispatchEvent(
              Events.INFOWINDOWCLOSE,
              { infoWindow: createdMarker.infoWindow },
              this.element
            );
          });
        }

        // Allows arbitrary data to be stored on the marker
        if (marker.custom) {
          createdMarker.custom = marker.custom;
        }

        // Add it the array of rendered markers
        this._renderedMarkers.push(createdMarker);

        // Send up and event to let the parent know a new marker has been rendered
        dispatchEvent(
          Events.MARKERRENDERED,
          { createdMarker, marker },
          this.element
        );
      });
    });
  }

  setOptions(options: any) {
    if (!this.map) {
      return;
    }

    this.map.setOptions(options);
  }

  createMarker(options: any) {
    return this._scriptPromise.then(() => {
      return Promise.resolve(new (<any>window).google.maps.Marker(options));
    });
  }

  getCenter() {
    this._mapPromise.then(() => {
      return Promise.resolve(this.map.getCenter());
    });
  }

  setCenter(latLong: any) {
    if (latLong) {
      this._mapPromise.then(() => {
        this.map.setCenter(latLong);
        this.sendBoundsEvent();
      });
    }
  }

  updateCenter() {
    if (this.latitude && this.longitude) {
      this._mapPromise.then(() => {
        let latLng = new (<any>window).google.maps.LatLng(
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
      this.platform.taskQueue.queueTask(() => {
        this.updateCenter();
      });
    });
  }

  longitudeChanged() {
    this._mapPromise.then(() => {
      this.platform.taskQueue.queueTask(() => {
        this.updateCenter();
      });
    });
  }

  zoomChanged(newValue: any) {
    this._mapPromise.then(() => {
      this.platform.taskQueue.queueTask(() => {
        let zoomValue = parseInt(newValue, 10);
        this.map.setZoom(zoomValue);
      });
    });
  }

  /**
   * Observing changes in the entire markers object. This is critical in case the user sets marker to a new empty Array,
   * where we need to resubscribe Observers and delete all previously rendered markers.
   *
   * @param newValue
   */
  markersChanged(newValue: Marker[]) {
    console.log("Markers changed", newValue);
    this.logger.debug("Markers changed", newValue);
    this.clearMarkers();

    // Add the subscription to markers
    // this._markersSubscription = this.bindingEngine
    //     .collectionObserver(this.markers)
    //     .subscribe((splices) => { this.markerCollectionChange(splices); });
    this.markerCollectionChange();

    if (!newValue.length) {
      return;
    }

    // Render all markers again
    let markerPromises = [];

    this._mapPromise
      .then(() => {
        markerPromises = newValue.map((marker) => {
          return this.renderMarker(marker);
        });
        return markerPromises;
      })
      .then((p) => {
        /**
         * Wait for all of the promises to resolve for rendering markers
         */
        Promise.all(p).then(() => {
          /**
           * We queue up a task to update the bounds, because in the case of multiple bound properties changing all at once,
           * we need to let Aurelia handle updating the other properties before we actually trigger a re-render of the map
           */
          this.platform.taskQueue.queueTask(() => {
            this.markerClustering.renderClusters(
              this.map,
              this._renderedMarkers
            );
            this.zoomToMarkerBounds();
          });
        });
      });
  }

  /**
   * Handle the change to the marker collection. Collection observer returns an array of splices which contains
   * information about the change to the collection.
   *
   */
  markerCollectionChange() {
    let renderPromises = [];

    this.clearMarkers();

    for (let addedMarker of this.markers) {
      renderPromises.push(this.renderMarker(addedMarker));
    }

    /**
     * Wait for all of the promises to resolve for rendering markers
     */
    Promise.all(renderPromises).then(() => {
      this.markerClustering.renderClusters(this.map, this._renderedMarkers);

      /**
       * We queue up a task to update the bounds, because in the case of multiple bound properties changing all at once,
       * we need to let Aurelia handle updating the other properties before we actually trigger a re-render of the map
       */
      this.platform.taskQueue.queueTask(() => {
        this.zoomToMarkerBounds();
      });
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
      let bounds = new (<any>window).google.maps.LatLngBounds();

      for (let marker of this._renderedMarkers) {
        // extend the bounds to include each marker's position

        let lat = parseFloat(<string>marker.position.lat());
        let lng = parseFloat(<string>marker.position.lng());

        if (isNaN(lat) || isNaN(lng)) {
          console.warn(`Marker returned NaN for lat/lng`, { marker, lat, lng });

          return;
        }

        let markerLatLng = new (<any>window).google.maps.LatLng(
          parseFloat(<string>marker.position.lat()),
          parseFloat(<string>marker.position.lng())
        );
        bounds.extend(markerLatLng);
      }

      for (let polygon of this._renderedPolygons) {
        polygon.getPath().forEach((element) => {
          bounds.extend(element);
        });
      }

      this.map.fitBounds(bounds);
    });
  }

  getMapTypeId() {
    if (this.mapType.toUpperCase() === "HYBRID") {
      return (<any>window).google.maps.MapTypeId.HYBRID;
    } else if (this.mapType.toUpperCase() === "SATELLITE") {
      return (<any>window).google.maps.MapTypeId.SATELLITE;
    } else if (this.mapType.toUpperCase() === "TERRAIN") {
      return (<any>window).google.maps.MapTypeId.TERRAIN;
    }

    return (<any>window).google.maps.MapTypeId.ROADMAP;
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
  initDrawingManager(options: any = {}) {
    return this._mapPromise.then(() => {
      // If its been initialized, we don't need to do so anymore
      if (this.drawingManager) return Promise.resolve();
      // Set the config defaults, and override if we were given any configs
      const config = Object.assign(
        {},
        {
          drawingMode: this.getOverlayType(this.drawMode),
          drawingControl: this.drawingControl,
          drawingControlOptions: this.drawingControlOptions,
        },
        options
      );
      this.drawingManager = new (<any>(
        window
      )).google.maps.drawing.DrawingManager(config);

      // Add Event listeners and forward them to as a custom event on the element
      this.drawingManager.addListener("overlaycomplete", (evt) => {
        // Add the encoded polyline to the event
        if (
          evt.type.toUpperCase() == "POLYGON" ||
          evt.type.toUpperCase() == "POLYLINE"
        ) {
          Object.assign(evt, {
            path: evt.overlay
              .getPath()
              .getArray()
              .map((x) => {
                return { latitude: x.lat(), longitude: x.lng() };
              }),
            encode: this.encodePath(evt.overlay.getPath()),
          });
        }

        dispatchEvent(Events.MAPOVERLAYCOMPLETE, evt, this.element);
      });
      return Promise.resolve();
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
  getOverlayType(type: any = "") {
    switch (type.toUpperCase()) {
      case "POLYGON":
        return (<any>window).google.maps.drawing.OverlayType.POLYGON;
      case "POLYLINE":
        return (<any>window).google.maps.drawing.OverlayType.POLYLINE;
      case "RECTANGLE":
        return (<any>window).google.maps.drawing.OverlayType.RECTANGLE;
      case "CIRCLE":
        return (<any>window).google.maps.drawing.OverlayType.CIRCLE;
      case "MARKER":
        return (<any>window).google.maps.drawing.OverlayType.MARKER;
      default:
        return null;
    }
  }

  /**
   * Update the editing state, called by aurelia binding
   * @param newval
   * @param oldval
   */
  drawEnabledChanged(newval: any, oldval: any) {
    this.initDrawingManager().then(() => {
      if (newval && !oldval) {
        this.drawingManager.setMap(this.map);
      } else if (oldval && !newval) {
        this.destroyDrawingManager();
      }
    });
  }

  /**
   * Update the drawing mode, called by aurelia binding
   * @param newval
   */
  drawModeChanged(newval: any = "") {
    this.initDrawingManager().then(() => {
      this.drawingManager.setOptions({
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
    return (<any>window).google.maps.geometry.encoding.encodePath(path);
  }

  /**
   * Decode the given Polyline encoded string to be an array of Paths
   * more info: https://developers.google.com/maps/documentation/utilities/polylineutility
   * @param polyline
   */
  decodePath(polyline: string) {
    return (<any>window).google.maps.geometry.encoding.decodePath(polyline);
  }

  /*************************************************************************
   * POLYGONS
   *************************************************************************/

  /**
   * Render a single polygon on the map and add it to the _renderedPolygons
   * array.
   * @param polygonObject - paths defining a polygon or a string
   */
  renderPolygon(polygonObject: any = []) {
    let paths = polygonObject.paths;

    if (!paths) return;

    if (Array.isArray(paths)) {
      paths = paths.map((x) => {
        return new (<any>window).google.maps.LatLng(x.latitude, x.longitude);
      });
    }

    let polygon = new (<any>window).google.maps.Polygon(
      Object.assign({}, polygonObject, { paths })
    );

    polygon.addListener("click", () => {
      dispatchEvent(Events.POLYGONCLICK, { polygon }, this.element);
    });

    polygon.setMap(this.map);

    if (polygonObject.infoWindow) {
      polygon.infoWindow = new (<any>window).google.maps.InfoWindow({
        content: polygonObject.infoWindow.content,
        pixelOffset: polygonObject.infoWindow.pixelOffset,
        position: polygonObject.infoWindow.position,
        maxWidth: polygonObject.infoWindow.maxWidth,
        parentPolygon: { ...polygonObject },
      });

      // polygonObject.infoWindow.addListener('domready', () => {
      //     dispatchEvent(Events.INFOWINDOWSHOW, { infoWindow: polygonObject.infoWindow }, this.element);
      // });
    }

    dispatchEvent(
      Events.POLYGONRENDERED,
      { polygon, polygonObject },
      this.element
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
  polygonsChanged(newValue: any) {
    for (let polygon of this._renderedPolygons) {
      polygon.setMap(null);
    }

    // And empty the renderMarkers collection
    this._renderedPolygons = [];

    this.polygonCollectionChange();

    if (!newValue.length) return;

    // Render all markers again
    this._mapPromise.then(() => {
      Promise.all(
        newValue.map((polygon) => {
          if (typeof polygon === "string") {
            return this.decodePath(polygon);
          }
          return polygon;
        })
      )
        .then((polygons) => {
          return Promise.all(polygons.map(this.renderPolygon.bind(this)));
        })
        .then(() => {
          /**
           * We queue up a task to update the bounds, because in the case of multiple bound properties changing all at once,
           * we need to let Aurelia handle updating the other properties before we actually trigger a re-render of the map
           */
          this.platform.taskQueue.queueTask(() => {
            this.zoomToMarkerBounds();
          });
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
      .then(() => {
        for (let addedPolygon of this.polygons) {
          this.renderPolygon(addedPolygon);
        }
      })
      .then(() => {
        /**
         * We queue up a task to update the bounds, because in the case of multiple bound properties changing all at once,
         * we need to let Aurelia handle updating the other properties before we actually trigger a re-render of the map
         */
        this.platform.taskQueue.queueTask(() => {
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
