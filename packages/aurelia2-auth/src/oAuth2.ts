import { DI, resolve } from '@aurelia/kernel';
import type { IAuthProviderConfig, IOAuthStartOptions } from './configuration';
import { AuthError } from './auth-error';
import { IOAuthClient } from './oauth-client';

export interface IOAuth2 {
  open(options: IAuthProviderConfig, userData?: Readonly<Record<string, unknown>>): Promise<unknown>;
  begin(providerName: string, options?: IOAuthStartOptions): ReturnType<IOAuthClient['begin']>;
  complete: IOAuthClient['complete'];
}

export const IOAuth2 = DI.createInterface<IOAuth2>('IOAuth2', x => x.singleton(OAuth2));

/** Compatibility facade over the standards-oriented OAuth client. */
export class OAuth2 implements IOAuth2 {
  private readonly client = resolve(IOAuthClient);

  public open(
    options: IAuthProviderConfig,
    userData: Readonly<Record<string, unknown>> = {},
  ): Promise<unknown> {
    if (!options.name) {
      return Promise.reject(new AuthError(
        'invalid-configuration',
        'The OAuth 2 compatibility facade requires a configured provider name.',
      ));
    }
    return this.client.start(options.name, { userData });
  }

  public begin(providerName: string, options?: IOAuthStartOptions): ReturnType<IOAuthClient['begin']> {
    return this.client.begin(providerName, options);
  }

  public complete: IOAuthClient['complete'] = (callback, providerName, userData) =>
    this.client.complete(callback, providerName, userData);
}
