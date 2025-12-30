export const Events = {
    // Dispatches
    BOUNDSCHANGED: "bounds-change",

    MAPCLICK: "map-click",
    MAPOVERLAYCOMPLETE: "map-overlay-complete",

    MARKERRENDERED: "marker-render",
    MARKERCLICK: "marker-click",
    MARKERMOUSEOVER: "marker-mouse-over",
    MARKERMOUSEOUT: "marker-mouse-out",

    POLYGONCLICK: "polygon-click",
    POLYGONRENDERED: "polygon-render",

    INFOWINDOWSHOW: "info-window-show",
    INFOWINDOWCLOSE: "info-window-close",

    // Listens
    START_MARKER_HIGHLIGHT: "start-marker-highlight",
    STOP_MARKER_HIGHLIGHT: "stop-marker-highlight",
    PAN_TO_MARKER: "pan-to-marker",
    CLEAR_MARKERS: "clear-markers",
} as const;

export type GoogleMapsEventType = typeof Events[keyof typeof Events];
