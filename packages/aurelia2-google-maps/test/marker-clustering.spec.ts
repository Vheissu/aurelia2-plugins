import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { Configure } from "../src/configure";
import { MarkerClustering } from "../src/marker-clustering";
import {
  installGoogleMapsMock,
  teardownGoogleMapsMock,
  MapMock,
  MarkerMock,
} from "./google-maps.mock";

jest.mock("@googlemaps/markerclusterer", () => ({
  MarkerClusterer: jest.fn().mockImplementation(() => ({
    clearMarkers: jest.fn(),
  })),
}));

describe("MarkerClustering", () => {
  beforeEach(() => {
    installGoogleMapsMock();
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardownGoogleMapsMock();
  });

  test("creates clusters with provided options", () => {
    const config = new Configure();
    config.options({
      markerCluster: {
        enable: true,
        options: {
          maxZoom: 16,
        },
      },
    });

    const clustering = new MarkerClustering(config);
    const map = new MapMock(document.createElement("div"), {});
    const markers = [new MarkerMock({ position: { lat: 1, lng: 2 } })];

    clustering.renderClusters(map as unknown as google.maps.Map, markers as any);

    expect(MarkerClusterer).toHaveBeenCalledTimes(1);
    const call = (MarkerClusterer as jest.Mock).mock.calls[0][0];
    expect(call.map).toBe(map);
    expect(call.markers).toBe(markers);
    expect(call.maxZoom).toBe(16);
  });
});
