import { DI, inject } from "@aurelia/kernel";
import { IHttpClient } from "@aurelia/fetch-client";
import { IAuthConfigOptions, IAuthOptions } from "./configuration";
import { IAuthentication } from "./authentication";
import { AuthInterceptor } from "./interceptor";

export const IFetchConfig = DI.createInterface<IFetchConfig>(
  "IFetchConfig",
  (x) => x.singleton(FetchConfig)
);

export type IFetchConfig = FetchConfig;
@inject(IHttpClient, IAuthentication, IAuthOptions, AuthInterceptor)
export class FetchConfig {
  constructor(
    readonly httpClient: IHttpClient,
    readonly auth: IAuthentication,
    readonly config: IAuthConfigOptions,
    readonly authInterceptor: AuthInterceptor
  ) {}

  configure() {
    this.httpClient.configure((httpConfig) => {
      if (this.config.withCredentials) {
        httpConfig.withDefaults({ credentials: "include" });
      }
      if (this.config.httpInterceptor || this.config.refreshTokens) {
        if (!httpConfig.interceptors.includes(this.authInterceptor)) {
          httpConfig.withInterceptor(this.authInterceptor);
        }
      }

      return httpConfig;
    });
  }
}
