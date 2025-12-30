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

export type GoogleMapsEvent =
  | { type: "bounds-change"; bounds: google.maps.LatLngBounds }
  | { type: "map-click"; event: google.maps.MapMouseEvent }
  | {
      type: "map-overlay-complete";
      event: google.maps.drawing.OverlayCompleteEvent & OverlayCompleteDetail;
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
