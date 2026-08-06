export async function status<T = unknown>(response: Response): Promise<T> {
  if (!response.ok) throw response;
  if (response.status === 204 || response.status === 205) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) return JSON.parse(text) as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export function joinUrl(baseUrl: string | undefined, url: string | undefined): string {
  if (!url) return baseUrl ?? '';
  if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//')) return url;
  if (!baseUrl) return url;

  if (/^[a-z][a-z\d+.-]*:/i.test(baseUrl)) {
    return new URL(url.replace(/^\/+/, ''), `${baseUrl.replace(/\/+$/, '')}/`).toString();
  }

  const base = baseUrl.replace(/\/+$/, '');
  const path = url.replace(/^\/+/, '');
  return `${base}/${path}` || '/';
}

export function parseQueryString(value: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(value.replace(/^[?#]/, '')).entries());
}

export function parseOAuthResponse(value: string | URL): Record<string, string> {
  const url = value instanceof URL ? value : new URL(value, 'http://localhost');
  return {
    ...Object.fromEntries(url.searchParams.entries()),
    ...Object.fromEntries(new URLSearchParams(url.hash.replace(/^#/, '')).entries()),
  };
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

export function camelCase(value: string): string {
  return value.replace(/[-_:]+(.)/g, (_match, letter: string) => letter.toUpperCase());
}

/** @deprecated Prefer object spread. */
export function extend<T extends object>(target: T, ...sources: readonly object[]): T {
  return Object.assign(target, ...sources);
}

/** @deprecated Prefer explicit iteration. */
export function forEach<T>(
  value: readonly T[] | Record<string, T> | null | undefined,
  callback: (value: T, key: number | string) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => callback(entry, index));
    return;
  }
  if (value) {
    Object.entries(value).forEach(([key, entry]) => callback(entry as T, key));
  }
}
