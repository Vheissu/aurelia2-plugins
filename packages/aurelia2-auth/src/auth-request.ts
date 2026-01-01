const AUTH_SKIP = '__auAuthSkip';
const AUTH_RETRY = '__auAuthRetry';

export function isAuthRequestSkipped(request?: Request): boolean {
  return Boolean((request as Request & { [AUTH_SKIP]?: boolean })?.[AUTH_SKIP]);
}

export function isAuthRequestRetried(request?: Request): boolean {
  return Boolean((request as Request & { [AUTH_RETRY]?: boolean })?.[AUTH_RETRY]);
}

export function markAuthRequestRetried(request?: Request): void {
  if (request) {
    (request as Request & { [AUTH_RETRY]?: boolean })[AUTH_RETRY] = true;
  }
}

export function markAuthSkip(request: Request): Request {
  (request as Request & { [AUTH_SKIP]?: boolean })[AUTH_SKIP] = true;
  return request;
}
