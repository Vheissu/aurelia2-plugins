import { IHttpClient } from '@aurelia/fetch-client';
import { Authentication } from './authentication';

export class FetchConfig {
  constructor(
    @IHttpClient readonly httpClient: IHttpClient,
    readonly auth: Authentication
  ) {}

  configure() {
    this.httpClient.configure((httpConfig) => {
      httpConfig.withInterceptor(this.auth.tokenInterceptor);

      return httpConfig;
    });
  }
}
