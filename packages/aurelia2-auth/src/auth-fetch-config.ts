import { DI, resolve } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { IAuthOptions } from './configuration';
import { AuthInterceptor } from './interceptor';

export interface IFetchConfig {
  configure(): void;
}

export const IFetchConfig = DI.createInterface<IFetchConfig>(
  'IFetchConfig',
  x => x.singleton(FetchConfig),
);

export class FetchConfig implements IFetchConfig {
  private readonly httpClient = resolve(IHttpClient);
  private readonly config = resolve(IAuthOptions);
  private readonly authInterceptor = resolve(AuthInterceptor);

  public configure(): void {
    this.httpClient.configure(httpConfig => {
      if ((this.config.httpInterceptor || this.config.refreshTokens)
        && !httpConfig.interceptors.includes(this.authInterceptor)) {
        httpConfig.withInterceptor(this.authInterceptor);
      }
      return httpConfig;
    });
  }
}
