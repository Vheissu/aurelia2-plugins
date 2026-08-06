import { resolve } from '@aurelia/kernel';
import type { IFetchInterceptor } from '@aurelia/fetch-client';
import { IAuthentication } from './authentication';
import { IAuthOptions } from './configuration';
import { IAuthService } from './auth-service';
import {
  isAuthRequestRetried,
  isAuthRequestSkipped,
  rememberReplayableRequest,
  takeReplayableRequest,
} from './auth-request';

export class AuthInterceptor implements IFetchInterceptor {
  private readonly auth = resolve(IAuthentication);
  private readonly config = resolve(IAuthOptions);
  private readonly authService = resolve(IAuthService);

  public async request(request: Request): Promise<Request> {
    if (isAuthRequestSkipped(request) || !this.shouldHandle(request)) return request;

    if (this.config.withCredentials && request.credentials !== 'include') {
      request = new Request(request, { credentials: 'include' });
    }

    if (
      this.config.mode === 'bearer'
      && this.config.refreshTokens
      && this.auth.getToken()
      && this.auth.isTokenExpired(this.config.tokenExpirationLeeway)
    ) {
      await this.authService.refreshToken();
    }

    const token = this.auth.getToken();
    switch (this.config.mode) {
      case 'bearer':
        if (token && this.config.authHeader) {
          request.headers.set(
            this.config.authHeader,
            this.config.authToken ? `${this.config.authToken} ${token}` : token,
          );
        }
        break;
      case 'api-key': {
        const apiKey = typeof this.config.apiKey === 'function'
          ? this.config.apiKey()
          : this.config.apiKey;
        if (apiKey) request.headers.set(this.config.apiKeyHeader ?? 'X-API-Key', apiKey);
        break;
      }
      case 'custom':
      case 'cookie':
        break;
    }

    const transformed = this.config.transformRequest
      ? await this.config.transformRequest({ request, accessToken: token, session: this.auth.session })
      : request;
    rememberReplayableRequest(transformed);
    return transformed;
  }

  public async response(response: Response, request?: Request): Promise<Request | Response> {
    if (response.status !== 401) return response;
    return this.handleUnauthorized(response, request);
  }

  public async responseError(error: unknown, request?: Request): Promise<Response> {
    if (typeof Response === 'undefined' || !(error instanceof Response) || error.status !== 401) throw error;
    const result = await this.handleUnauthorized(error, request);
    return result as Response;
  }

  private async handleUnauthorized(response: Response, request?: Request): Promise<Request | Response> {
    if (
      !this.config.refreshTokens
      || this.config.refreshOnUnauthorized === false
      || isAuthRequestSkipped(request)
      || isAuthRequestRetried(request)
      || (request && !this.shouldHandle(request))
    ) {
      return response;
    }

    const retry = takeReplayableRequest(request);
    if (!retry) return response;

    try {
      await this.authService.refreshToken();
      return retry;
    } catch {
      this.auth.clearTokens();
      return response;
    }
  }

  private shouldHandle(request: Request): boolean {
    const trusted = this.config.trustedOrigins;
    if (typeof trusted === 'function') return trusted(request);
    if (!trusted || trusted.length === 0) return false;

    let origin: string;
    try {
      origin = new URL(request.url).origin;
    } catch {
      return false;
    }
    return trusted.some(value => {
      try {
        return new URL(value).origin === origin;
      } catch {
        return false;
      }
    });
  }
}
