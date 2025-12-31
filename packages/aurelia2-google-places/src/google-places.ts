import {
  bindable,
  BindingMode,
  customAttribute,
  ICustomAttributeViewModel,
  INode,
} from 'aurelia';
import { ILogger, inject } from '@aurelia/kernel';
import { IGooglePlacesConfiguration } from './configure';
import { IGooglePlacesAPI } from './google-places-api';
import type { GooglePlacesPlaceChangedDetail } from './types';

@customAttribute('google-places')
@inject(INode, IGooglePlacesConfiguration, IGooglePlacesAPI, ILogger)
export class GooglePlaces implements ICustomAttributeViewModel {
  @bindable({ primary: true, mode: BindingMode.fromView })
  place: google.maps.places.PlaceResult | null = null;

  @bindable options: google.maps.places.AutocompleteOptions = {};
  @bindable fields?: string[];
  @bindable types?: string[] | null;
  @bindable bounds?:
    | google.maps.LatLngBounds
    | google.maps.LatLngBoundsLiteral
    | null;
  @bindable componentRestrictions?: google.maps.places.ComponentRestrictions | null;
  @bindable strictBounds?: boolean;
  @bindable({ mode: BindingMode.fromView })
  autocomplete: google.maps.places.Autocomplete | null = null;
  @bindable onPlaceChanged?: (
    place: google.maps.places.PlaceResult,
    autocomplete: google.maps.places.Autocomplete
  ) => void;
  @bindable onError?: (error: Error) => void;

  private _isAttached = false;
  private _placeChangedListener: google.maps.MapsEventListener | null = null;

  constructor(
    private readonly element: HTMLElement,
    private readonly config: IGooglePlacesConfiguration,
    private readonly googlePlacesApi: IGooglePlacesAPI,
    private readonly logger: ILogger
  ) {
    this.logger.scopeTo('aurelia2-google-places');

    const loaderOptions = this.config.getLoaderOptions();
    if (
      !loaderOptions.key &&
      !config.get('apiKey') &&
      config.get('apiKey') !== false &&
      !config.get('client') &&
      config.get('client') !== false
    ) {
      this.logger.error('No API key or client ID has been specified.');
    }
  }

  attached() {
    this._isAttached = true;

    this.googlePlacesApi
      .getPlacesInstance()
      .then(() => {
        if (!this._isAttached) {
          return;
        }

        if (!(this.element instanceof HTMLInputElement)) {
          this.logger.error(
            'The google-places attribute can only be used on input elements.'
          );
          return;
        }

        this.autocomplete = new google.maps.places.Autocomplete(
          this.element,
          this.buildOptions()
        );

        this._placeChangedListener = this.autocomplete.addListener(
          'place_changed',
          () => this.handlePlaceChanged()
        );
      })
      .catch((error) => {
        this.logger.error('Failed to load Google Places API.');
        if (this.onError) {
          this.onError(error);
        }
      });
  }

  detached() {
    this._isAttached = false;
    this._placeChangedListener?.remove();
    this._placeChangedListener = null;
    this.autocomplete = null;
  }

  optionsChanged() {
    this.updateOptions();
  }

  fieldsChanged() {
    this.updateOptions();
  }

  typesChanged() {
    this.updateOptions();
  }

  boundsChanged() {
    this.updateOptions();
  }

  componentRestrictionsChanged() {
    this.updateOptions();
  }

  strictBoundsChanged() {
    this.updateOptions();
  }

  private buildOptions(): google.maps.places.AutocompleteOptions {
    const merged = Object.assign(
      {},
      this.config.get('options') || {},
      this.options || {}
    ) as google.maps.places.AutocompleteOptions;

    if (this.fields !== undefined) {
      merged.fields = this.fields;
    }

    if (this.types !== undefined && this.types !== null) {
      merged.types = this.types;
    }

    if (this.bounds !== undefined && this.bounds !== null) {
      merged.bounds = this.bounds;
    }

    if (this.componentRestrictions !== undefined && this.componentRestrictions !== null) {
      merged.componentRestrictions = this.componentRestrictions;
    }

    if (this.strictBounds !== undefined) {
      merged.strictBounds = this.strictBounds;
    }

    return merged;
  }

  private updateOptions() {
    if (!this.autocomplete) {
      return;
    }

    const options = this.buildOptions();
    this.autocomplete.setOptions(options);

    if (this.fields !== undefined) {
      this.autocomplete.setFields(this.fields);
    }

    if (this.types !== undefined) {
      this.autocomplete.setTypes(this.types ?? null);
    }

    if (this.bounds !== undefined) {
      if (this.bounds === null) {
        this.autocomplete.setBounds(undefined);
      } else {
        this.autocomplete.setBounds(this.bounds);
      }
    }

    if (this.componentRestrictions !== undefined) {
      this.autocomplete.setComponentRestrictions(this.componentRestrictions);
    }
  }

  private handlePlaceChanged() {
    if (!this.autocomplete) {
      return;
    }

    const place = this.autocomplete.getPlace();
    this.place = place;

    if (this.onPlaceChanged) {
      this.onPlaceChanged(place, this.autocomplete);
    }

    const detail: GooglePlacesPlaceChangedDetail = {
      place,
      autocomplete: this.autocomplete,
    };

    this.element.dispatchEvent(
      new CustomEvent('place-changed', {
        detail,
        bubbles: true,
      })
    );
  }
}
