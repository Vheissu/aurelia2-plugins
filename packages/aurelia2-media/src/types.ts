export interface MediaChange {
  query: string;
  matches: boolean;
  media: MediaQueryList | null;
}

export type MediaCallback = (change: MediaChange) => void;

export interface MediaDispose {
  dispose(): void;
}

export interface MediaConfigurationOptions {
  defaultMatches?: boolean;
}
