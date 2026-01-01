import { IHttpClient, json } from "@aurelia/fetch-client";
import { IAuthentication } from "./authentication";
import { IOAuth1 } from "./oAuth1";
import { IOAuth2 } from "./oAuth2";
import { status, joinUrl } from "./auth-utilities";
import { DI, IEventAggregator, inject, optional } from "@aurelia/kernel";
import { IAuthOptions, IAuthConfigOptions } from "./configuration";
import { IWindow } from '@aurelia/runtime-html';
import { markAuthSkip } from './auth-request';

export const IAuthService = DI.createInterface<IAuthService>("IAuthService", x => x.singleton(AuthService));

export type IAuthService = AuthService;

@inject(
  IHttpClient,
  IAuthentication,
  IOAuth1,
  IOAuth2,
  IAuthOptions,
  IEventAggregator,
  optional(IWindow)
)
export class AuthService {
  protected tokenInterceptor;
  private refreshPromise: Promise<unknown> | null = null;

  constructor(
    readonly http: IHttpClient,
    readonly auth: IAuthentication,
    readonly oAuth1: IOAuth1,
    readonly oAuth2: IOAuth2,
    readonly config: IAuthConfigOptions,
    readonly eventAggregator: IEventAggregator,
    readonly window?: IWindow
  ) {
    this.tokenInterceptor = auth.tokenInterceptor;
  }

  getMe() {
    let profileUrl = this.auth.getProfileUrl();
    return this.http.fetch(profileUrl).then(status);
  }

  isAuthenticated() {
    return this.auth.isAuthenticated();
  }

  getTokenPayload() {
    return this.auth.getPayload();
  }

  setToken(token) {
    this.auth.setToken(
      Object.defineProperty({}, this.config.tokenName, { value: token })
    );
  }

  signup(displayName, email, password) {
    let signupUrl = this.auth.getSignupUrl();
    let content;
    if (typeof arguments[0] === "object") {
      content = arguments[0];
    } else {
      content = {
        displayName: displayName,
        email: email,
        password: password,
      };
    }

    return this.http
      .fetch(signupUrl, {
        method: "post",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: json(content),
      })
      .then(status)
      .then((response) => {
        if (this.config.loginOnSignup) {
          this.auth.setToken(response);
        } else if (this.config.signupRedirect) {
          this.window?.location &&
            (this.window.location.href = this.config.signupRedirect);
        }
        this.eventAggregator.publish("auth:signup", response);
        return response;
      });
  }

  login(email, password) {
    let loginUrl = this.auth.getLoginUrl();
    let content;
    if (typeof arguments[1] !== "string") {
      content = arguments[0];
    } else {
      content = {
        email: email,
        password: password,
      };
    }

    return this.http
      .fetch(loginUrl, {
        method: "post",
        headers:
          typeof content === "string"
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {},
        body: typeof content === "string" ? content : json(content),
      })
      .then(status)
      .then((response) => {
        this.auth.setToken(response);
        this.eventAggregator.publish("auth:login", response);
        return response;
      });
  }

  logout(redirectUri) {
    return this.auth.logout(redirectUri).then(() => {
      this.eventAggregator.publish("auth:logout");
    });
  }

  authenticate(name, redirect, userData) {
    const providerConfig = this.config.providers?.[name];
    if (!providerConfig) {
      return Promise.reject(new Error(`Unknown auth provider: ${name}`));
    }

    let provider: IOAuth1 | IOAuth2 = this.oAuth2;

    if (providerConfig.type === "1.0") {
      provider = this.oAuth1;
    }

    return provider.open(providerConfig, userData || {}).then((response) => {
      this.auth.setToken(response, redirect);
      this.eventAggregator.publish("auth:authenticate", response);
      return response;
    });
  }

  unlink(provider) {
    let unlinkUrl = this.config.baseUrl
      ? joinUrl(this.config.baseUrl, this.config.unlinkUrl)
      : this.config.unlinkUrl;

    if (this.config.unlinkMethod === "get") {
      return this.http
        .fetch(unlinkUrl + provider)
        .then(status)
        .then((response) => {
          this.eventAggregator.publish("auth:unlink", response);
          return response;
        });
    } else if (this.config.unlinkMethod === "post") {
      return this.http
        .fetch(unlinkUrl, {
          method: "post",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: json(provider),
        })
        .then(status)
        .then((response) => {
          this.eventAggregator.publish("auth:unlink", response);
          return response;
        });
    }
  }

  refreshToken() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.auth.getRefreshToken();
    if (!refreshToken) {
      return Promise.reject(new Error("No refresh token available."));
    }

    const refreshUrl = this.auth.getRefreshUrl();
    if (!refreshUrl) {
      return Promise.reject(new Error("No refresh URL configured."));
    }

    const refreshTokenProp = this.config.refreshTokenName || 'refresh_token';
    const payload =
      typeof this.config.refreshTokenPayload === "function"
        ? this.config.refreshTokenPayload(refreshToken)
        : {
            [refreshTokenProp]: refreshToken,
            ...(this.config.refreshTokenPayload ?? {}),
          };

    const credentials: RequestCredentials = this.config.withCredentials
      ? "include"
      : "same-origin";

    const requestInit: RequestInit = {
      method: "post",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: json(payload),
      credentials,
    };

    const requestInput =
      typeof Request === "undefined"
        ? refreshUrl
        : markAuthSkip(new Request(refreshUrl, requestInit));

    this.refreshPromise = this.http
      .fetch(requestInput as Request | string, typeof Request === "undefined" ? requestInit : undefined)
      .then(status)
      .then((response) => {
        this.auth.setToken(response);
        this.eventAggregator.publish("auth:refresh", response);
        return response;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }
}
