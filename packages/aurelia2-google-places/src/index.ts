import { IContainer, IRegistry } from '@aurelia/kernel';
import { ConfigInterface, IGooglePlacesConfiguration } from './configure';
import { GooglePlaces } from './google-places';
import { IGooglePlacesAPI } from './google-places-api';

export { GooglePlaces } from './google-places';
export { IGooglePlacesConfiguration } from './configure';
export { IGooglePlacesAPI } from './google-places-api';
export type { GooglePlacesPlaceChangedDetail } from './types';

const DefaultComponents: IRegistry[] = [
  IGooglePlacesConfiguration as unknown as IRegistry,
  IGooglePlacesAPI as unknown as IRegistry,
  GooglePlaces as unknown as IRegistry,
];

function createGooglePlacesConfiguration(options: Partial<ConfigInterface>) {
  return {
    register(container: IContainer) {
      const configClass = container.get(IGooglePlacesConfiguration);
      configClass.options(options);

      return container.register(...DefaultComponents);
    },
    configure(options: ConfigInterface) {
      return createGooglePlacesConfiguration(options);
    },
    customize(callback?: (config: IGooglePlacesConfiguration) => void) {
      return {
        register(container: IContainer) {
          const configClass = container.get(IGooglePlacesConfiguration);
          configClass.options(options);

          if (callback) {
            callback(configClass);
          }

          return container.register(...DefaultComponents);
        },
        configure(options: ConfigInterface) {
          return createGooglePlacesConfiguration(options);
        },
      };
    },
  };
}

export const GooglePlacesConfiguration = createGooglePlacesConfiguration({});
