import { DI } from 'aurelia';
import type { MediaCallback, MediaChange, MediaConfigurationOptions, MediaDispose } from './types';

export class MediaService {
  private defaultMatches = false;

  public configure(options: MediaConfigurationOptions = {}): void {
    this.defaultMatches = options.defaultMatches ?? this.defaultMatches;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  }

  public matches(query: string): boolean {
    if (!query) return this.defaultMatches;
    if (!this.isSupported()) return this.defaultMatches;
    return window.matchMedia(query).matches;
  }

  public observe(query: string, callback: MediaCallback): MediaDispose {
    if (!query || !this.isSupported()) {
      let disposed = false;
      queueMicrotask(() => {
        if (!disposed) {
          callback({ query, matches: this.defaultMatches, media: null });
        }
      });
      return {
        dispose() {
          disposed = true;
        },
      };
    }

    const media = window.matchMedia(query);
    const emit = (): void => callback(createChange(query, media));
    const listener = (): void => emit();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener);
    } else {
      media.addListener(listener);
    }

    emit();

    return {
      dispose() {
        if (typeof media.removeEventListener === 'function') {
          media.removeEventListener('change', listener);
        } else {
          media.removeListener(listener);
        }
      },
    };
  }
}

export const IMediaService = DI.createInterface<IMediaService>('IMediaService', x => x.singleton(MediaService));
export interface IMediaService extends MediaService {}

function createChange(query: string, media: MediaQueryList): MediaChange {
  return {
    query,
    matches: media.matches,
    media,
  };
}
