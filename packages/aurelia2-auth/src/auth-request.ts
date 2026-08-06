const skipped = new WeakSet<Request>();
const retried = new WeakSet<Request>();
const replayable = new WeakMap<Request, Request>();

export function isAuthRequestSkipped(request?: Request): boolean {
  return request ? skipped.has(request) : false;
}

export function isAuthRequestRetried(request?: Request): boolean {
  return request ? retried.has(request) : false;
}

export function markAuthRequestRetried(request?: Request): Request | undefined {
  if (request) retried.add(request);
  return request;
}

export function markAuthSkip(request: Request): Request {
  skipped.add(request);
  return request;
}

export function rememberReplayableRequest(request: Request): void {
  try {
    replayable.set(request, request.clone());
  } catch {
    // A consumed streaming body cannot be replayed. The original 401 is returned to the caller.
  }
}

export function takeReplayableRequest(request?: Request): Request | null {
  if (!request) return null;
  const clone = replayable.get(request) ?? null;
  replayable.delete(request);
  if (clone) {
    retried.add(clone);
    if (skipped.has(request)) skipped.add(clone);
  }
  return clone;
}
