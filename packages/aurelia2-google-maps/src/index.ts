import { IContainer, IRegistry } from "@aurelia/kernel";
import { ConfigInterface, IGoogleMapsConfiguration } from "./configure";
import { GoogleMaps } from "./google-maps";

export { GoogleMaps } from "./google-maps";
export { IGoogleMapsConfiguration } from "./configure";
export { IMarkerClustering } from "./marker-clustering";
export type {
  GoogleMapsEvent,
  MarkerInput,
  PolygonInput,
} from "./types";

const DefaultComponents: IRegistry[] = [
    GoogleMaps as unknown as IRegistry,
];

function createGoogleMapsConfiguration(options: Partial<ConfigInterface>) {
  return {
    register(container: IContainer) {
      const configClass = container.get(IGoogleMapsConfiguration);

      configClass.options(options);

      return container.register(...DefaultComponents);
    },
    configure(options: ConfigInterface) {
      return createGoogleMapsConfiguration(options);
    },
    customize(callback?: (config: IGoogleMapsConfiguration) => void) {
      return {
        register(container: IContainer) {
          const configClass = container.get(IGoogleMapsConfiguration);
          configClass.options(options);

          if (callback) {
            callback(configClass);
          }

          return container.register(...DefaultComponents);
        },
        configure(options: ConfigInterface) {
          return createGoogleMapsConfiguration(options);
        },
      };
    },
  };
}

export const GoogleMapsConfiguration = createGoogleMapsConfiguration({});

// export const GoogleMapsConfiguration = {
//     register(container: IContainer): IContainer {
//         return configure(container);
//     },

//     customize(config?): IRegistry {
//         return {
//             register(container: IContainer): IContainer {
//                 return configure(container, config);
//             }
//         }
//     }
// };
