export type LatLngInput = google.maps.LatLng | google.maps.LatLngLiteral;

export interface InfoWindowConfig
  extends Omit<google.maps.InfoWindowOptions, "content"> {
  content: string;
}

export interface MarkerInput
  extends Omit<google.maps.MarkerOptions, "position"> {
  latitude?: number | string;
  longitude?: number | string;
  position?: LatLngInput;
  infoWindow?: InfoWindowConfig;
  custom?: unknown;
}

export type PolygonPathInput =
  | google.maps.LatLngLiteral[]
  | google.maps.LatLng[]
  | google.maps.MVCArray<google.maps.LatLng>
  | google.maps.MVCArray<google.maps.LatLngLiteral>
  | Array<{ latitude: number; longitude: number }>;

export interface PolygonInput
  extends Omit<google.maps.PolygonOptions, "paths"> {
  paths: PolygonPathInput;
  infoWindow?: InfoWindowConfig;
}

export interface OverlayCompleteDetail {
  path?: Array<{ latitude: number; longitude: number }>;
  encode?: string;
}

/**
 * The Maps JavaScript API deprecated the drawing library in 3.65, and
 * @types/google.maps 3.65 stripped `DrawingManager` down to a bare `MVCObject`,
 * dropping its options and event types. The runtime API is still shipped, so
 * the shapes this plugin depends on are mirrored here.
 */
export interface DrawingControlOptions {
  drawingModes?: google.maps.drawing.OverlayType[];
  position?: google.maps.ControlPosition;
}

export interface DrawingManagerOptions {
  circleOptions?: google.maps.CircleOptions;
  drawingControl?: boolean;
  drawingControlOptions?: DrawingControlOptions;
  drawingMode?: google.maps.drawing.OverlayType | null;
  map?: google.maps.Map | null;
  markerOptions?: google.maps.MarkerOptions;
  polygonOptions?: google.maps.PolygonOptions;
  polylineOptions?: google.maps.PolylineOptions;
  rectangleOptions?: google.maps.RectangleOptions;
}

export type DrawingOverlay =
  | google.maps.Circle
  | google.maps.Marker
  | google.maps.Polygon
  | google.maps.Polyline
  | google.maps.Rectangle;

export interface OverlayCompleteEvent {
  overlay: DrawingOverlay;
  type: google.maps.drawing.OverlayType;
}

export interface DrawingManager extends google.maps.MVCObject {
  getDrawingMode(): google.maps.drawing.OverlayType | null;
  getMap(): google.maps.Map | null;
  setDrawingMode(drawingMode: google.maps.drawing.OverlayType | null): void;
  setMap(map: google.maps.Map | null): void;
  setOptions(options: DrawingManagerOptions): void;
}

export type DrawingManagerConstructor = new (
  options?: DrawingManagerOptions
) => DrawingManager;

export type GoogleMapsEvent =
  | { type: "bounds-change"; bounds: google.maps.LatLngBounds }
  | { type: "map-click"; event: google.maps.MapMouseEvent }
  | {
      type: "map-overlay-complete";
      event: OverlayCompleteEvent & OverlayCompleteDetail;
    }
  | {
      type: "marker-render";
      marker: MarkerInput;
      markerInstance: google.maps.Marker;
      index: number;
    }
  | {
      type: "marker-click";
      marker: MarkerInput;
      markerInstance: google.maps.Marker;
      index: number;
    }
  | {
      type: "marker-mouse-over";
      markerInstance: google.maps.Marker;
      index: number;
    }
  | {
      type: "marker-mouse-out";
      markerInstance: google.maps.Marker;
      index: number;
    }
  | {
      type: "polygon-render";
      polygon: google.maps.Polygon;
      polygonInput: PolygonInput;
      index: number;
    }
  | {
      type: "polygon-click";
      polygon: google.maps.Polygon;
      polygonInput: PolygonInput;
      index: number;
    }
  | {
      type: "info-window-show";
      infoWindow: google.maps.InfoWindow;
      markerInstance?: google.maps.Marker;
    }
  | {
      type: "info-window-close";
      infoWindow: google.maps.InfoWindow;
      markerInstance?: google.maps.Marker;
    };
