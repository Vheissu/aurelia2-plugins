import { DI } from "@aurelia/kernel";
import { IHttpClient } from "@aurelia/fetch-client";
import { IAuthentication } from "./authentication";

export const IFetchConfig = DI.createInterface<IFetchConfig>(
  "IFetchConfig",
  (x) => x.singleton(FetchConfig)
);

export type IFetchConfig = FetchConfig;
export class FetchConfig {
  constructor(
    @IHttpClient readonly httpClient: IHttpClient,
    @IAuthentication readonly auth: IAuthentication
  ) {}

  configure() {
    this.httpClient.configure((httpConfig) => {
      httpConfig.withInterceptor(this.auth.tokenInterceptor);

      return httpConfig;
    });
  }
}
