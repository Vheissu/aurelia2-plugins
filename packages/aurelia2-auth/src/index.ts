import { IAuthentication } from './authentication';
import { IFetchConfig } from './auth-fetch-config';
import { IAuthConfigOptions, IAuthOptions } from './configuration';
import { defaultAuthConfigOptions } from './base-config';
import { IAuthService } from './auth-service';
import { AuthorizeHook } from './authorize-hook';
import { AuthFilterValueConverter } from './auth-filter';
import { IContainer, IRegistry, Registration } from '@aurelia/kernel';
import { Auth } from './helpers';

export const DefaultComponents: IRegistry[] = [
  AuthFilterValueConverter as unknown as IRegistry,
];

function createConfiguration(options?: Partial<IAuthConfigOptions>) {
  return {
    register(container: IContainer): IContainer {
      Auth.container = container;

      const mergedOptions: Partial<IAuthConfigOptions> = {
        ...defaultAuthConfigOptions,
        ...options,
      };

      return container.register(
        Registration.instance(IAuthOptions, mergedOptions),
        ...DefaultComponents
      );
    },
    configure(options?: IAuthConfigOptions) {
      return createConfiguration(options);
    },
  };
}

export const AureliaAuthConfiguration = createConfiguration({});

export { AuthorizeHook, IAuthOptions, IFetchConfig, IAuthService, IAuthentication, Auth };
export type { IAuthConfigOptions };
