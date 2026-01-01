import { inject } from '@aurelia/kernel';
import type { IFetchInterceptor } from '@aurelia/fetch-client';
import { IAuthentication } from './authentication';
import { IAuthConfigOptions, IAuthOptions } from './configuration';
import { IAuthService } from './auth-service';
import {
  isAuthRequestSkipped,
  isAuthRequestRetried,
  markAuthRequestRetried,
} from './auth-request';

@inject(IAuthentication, IAuthOptions, IAuthService)
export class AuthInterceptor implements IFetchInterceptor {
  constructor(
    private readonly auth: IAuthentication,
    private readonly config: IAuthConfigOptions,
    private readonly authService: IAuthService
  ) {}

  async request(request: Request): Promise<Request> {
    if (isAuthRequestSkipped(request)) {
      return request;
    }

    if (
      this.config.refreshTokens &&
      this.auth.isTokenExpired(this.config.tokenExpirationLeeway)
    ) {
      await this.authService.refreshToken();
    }

    if (this.config.httpInterceptor && this.auth.isAuthenticated()) {
      let token = this.auth.getToken();

      if (token && this.config.authHeader) {
        if (this.config.authToken) {
          token = `${this.config.authToken} ${token}`;
        }
        request.headers.set(this.config.authHeader, token);
      }
    }

    return request;
  }

  async responseError(
    error: unknown,
    request?: Request
  ): Promise<Response> {
    if (
      !this.config.refreshTokens ||
      isAuthRequestSkipped(request) ||
      isAuthRequestRetried(request)
    ) {
      throw error;
    }

    if (error instanceof Response && error.status === 401) {
      try {
        markAuthRequestRetried(request);
        await this.authService.refreshToken();
        if (request) {
          return request as unknown as Response;
        }
      } catch (refreshError) {
        this.auth.clearTokens();
        throw refreshError;
      }
    }

    throw error;
  }
}
