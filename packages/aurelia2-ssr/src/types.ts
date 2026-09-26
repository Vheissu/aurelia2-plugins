import type { IContainer, IRegistry } from '@aurelia/kernel';
import type { Aurelia, IAppRoot } from '@aurelia/runtime-html';
import type { ISSRDefinition, ISSRScope } from '@aurelia/runtime-html';
import type { RecordSsrManifestOptions } from './manifest.js';
import type { SsrHeadSnapshot } from './head.js';
import type { SsrStateStore } from './state.js';

export type SsrRouteMode = 'prerender' | 'server' | 'client';
export type SsrRoutePriority = 'critical' | 'high' | 'normal' | 'low';
export type SsrFetchPriority = 'high' | 'low' | 'auto';
export type SsrSitemapChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
export type SsrScriptStrategy = 'head-start' | 'head-end' | 'before-preboot' | 'before-client' | 'after-client' | 'body-end';
export type SsrTakeoverMode = 'hydrate' | 'remount' | 'enhance';
export type SsrDiagnosticSeverity = 'error' | 'warning' | 'info';
export type SsrGlobalStrategy = 'none' | 'install' | 'install-and-restore';

export interface SsrSerializableAttributes {
  readonly [name: string]: string | number | boolean | null | undefined;
}

export interface SsrSitemapConfig {
  readonly include?: boolean;
  readonly priority?: number;
  readonly changefreq?: SsrSitemapChangeFrequency;
  readonly lastmod?: string;
}

export interface SsrOpenGraphConfig {
  readonly title?: string;
  readonly description?: string;
  readonly image?: string;
  readonly type?: 'website' | 'article' | 'profile' | 'product' | string;
  readonly locale?: string;
  readonly siteName?: string;
}

export interface SsrTwitterConfig {
  readonly card?: 'summary' | 'summary_large_image' | 'app' | 'player';
  readonly site?: string;
  readonly creator?: string;
  readonly title?: string;
  readonly description?: string;
  readonly image?: string;
}

export interface SsrSeoConfig {
  readonly title: string;
  readonly description: string;
  readonly canonicalPath?: string;
  readonly canonicalUrl?: string;
  readonly robots?: string;
  readonly keywords?: string[];
  readonly openGraph?: SsrOpenGraphConfig;
  readonly twitter?: SsrTwitterConfig;
  readonly jsonLd?: readonly Record<string, unknown>[];
  readonly sitemap?: SsrSitemapConfig;
  readonly meta?: readonly SsrMetaDefinition[];
  readonly links?: readonly SsrLinkDefinition[];
  readonly htmlAttrs?: SsrSerializableAttributes;
  readonly bodyAttrs?: SsrSerializableAttributes;
}

export interface SsrMetaDefinition {
  readonly name?: string;
  readonly property?: string;
  readonly httpEquiv?: string;
  readonly charset?: string;
  readonly content?: string | number | boolean;
  readonly key?: string;
}

export interface SsrLinkDefinition {
  readonly rel: string;
  readonly href: string;
  readonly as?: string;
  readonly type?: string;
  readonly media?: string;
  readonly sizes?: string;
  readonly hreflang?: string;
  readonly crossorigin?: string | boolean;
  readonly fetchPriority?: SsrFetchPriority;
  readonly integrity?: string;
  readonly referrerpolicy?: string;
  readonly attrs?: SsrSerializableAttributes;
  readonly key?: string;
}

export interface SsrPreloadAsset {
  readonly href: string;
  readonly as: 'style' | 'font' | 'script' | 'fetch' | 'image' | 'track' | 'worker' | 'video' | 'audio';
  readonly type?: string;
  readonly media?: string;
  readonly crossorigin?: string | boolean;
  readonly fetchPriority?: SsrFetchPriority;
  readonly imagesrcset?: string;
  readonly imagesizes?: string;
  readonly integrity?: string;
  readonly attrs?: SsrSerializableAttributes;
}

export interface SsrPriorityImage {
  readonly href: string;
  readonly fetchPriority?: SsrFetchPriority;
  readonly media?: string;
  readonly imagesrcset?: string;
  readonly imagesizes?: string;
}

export interface SsrStyleDefinition {
  readonly href?: string;
  readonly content?: string;
  readonly id?: string;
  readonly media?: string;
  readonly disabled?: boolean;
  readonly precedence?: 'critical' | 'normal' | 'late';
  readonly attrs?: SsrSerializableAttributes;
}

export interface SsrScriptDefinition {
  readonly src?: string;
  readonly content?: string;
  readonly id?: string;
  readonly type?: string;
  readonly strategy?: SsrScriptStrategy;
  readonly async?: boolean;
  readonly defer?: boolean;
  readonly nomodule?: boolean;
  readonly crossorigin?: string | boolean;
  readonly integrity?: string;
  readonly referrerpolicy?: string;
  readonly attrs?: SsrSerializableAttributes;
}

export interface SsrRoutePriorityConfig {
  readonly level?: SsrRoutePriority;
  readonly moduleIds?: readonly string[];
  readonly images?: readonly SsrPriorityImage[];
}

export interface SsrRouteAssets {
  readonly styles?: readonly SsrStyleDefinition[];
  readonly scripts?: readonly SsrScriptDefinition[];
  readonly preloads?: readonly SsrPreloadAsset[];
}

export interface SsrRouteRenderConfig {
  readonly settleMs?: number;
  readonly timeoutMs?: number;
  readonly takeoverMode?: SsrTakeoverMode;
  readonly stripAureliaMarkers?: boolean;
  readonly preserveMarkers?: boolean;
  /** Re-hydrate the serialized output on the server and report adoption problems as diagnostics. */
  readonly verifyHydration?: boolean;
}

export interface SsrCacheConfig {
  /** `max-age` in seconds for browsers. */
  readonly maxAge?: number;
  /** `s-maxage` in seconds for shared caches and CDNs. */
  readonly sMaxAge?: number;
  /** `stale-while-revalidate` in seconds. */
  readonly staleWhileRevalidate?: number;
  /** Emit `private` instead of `public`. */
  readonly private?: boolean;
  /** Emit `no-store` and skip the server-side response cache. */
  readonly noStore?: boolean;
  /** Time to keep a rendered response in the in-memory server cache, in milliseconds. */
  readonly ttlMs?: number;
}

/**
 * A single expansion of a dynamic route. Strings are treated as the concrete
 * path; objects can override any route field and/or supply `params` that are
 * substituted into the route's path pattern (`/blog/:slug`).
 */
export type SsrRouteExpansion = string | (Partial<Omit<SsrRouteConfig, 'expand' | 'path' | 'seo'>> & {
  readonly path?: string;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly seo?: Partial<SsrSeoConfig>;
});

export type SsrRouteExpander = (route: SsrRouteConfig) => readonly SsrRouteExpansion[] | Promise<readonly SsrRouteExpansion[]>;

export interface SsrRouteConfig {
  readonly path: string;
  readonly mode?: SsrRouteMode;
  readonly status?: number;
  readonly redirectTo?: string;
  readonly seo: SsrSeoConfig;
  readonly priority?: SsrRoutePriorityConfig;
  readonly assets?: SsrRouteAssets;
  readonly render?: SsrRouteRenderConfig;
  readonly cache?: SsrCacheConfig;
  readonly data?: Record<string, unknown>;
  /**
   * Expands a dynamic route pattern (`/blog/:slug`) into concrete routes at
   * prerender time. Routes with `:params` and no expander are skipped with a
   * diagnostic.
   */
  readonly expand?: SsrRouteExpander;
  /** Route parameters, populated on expanded and request-matched routes. */
  readonly params?: Readonly<Record<string, string>>;
}

export type SsrRedirectPlatform = 'netlify' | 'cloudflare' | 'vercel' | 'nginx' | 'apache' | 'json';

export interface SsrOutputConfig {
  /** Write `about/index.html` instead of `about.html`. */
  readonly cleanUrls?: boolean;
  readonly sitemap?: boolean;
  readonly robots?: boolean;
  /** Write the JSON build report. Uses `diagnostics.outputFile` or `ssr-report.json`. */
  readonly report?: boolean;
  /** File name for the 404 page (routes with `status: 404`). Defaults to `404.html`. */
  readonly notFoundFile?: string;
  /** Static-host redirect files to emit from routes that set `redirectTo`. */
  readonly redirects?: readonly SsrRedirectPlatform[];
  /** Also write an HTML page with a meta refresh for each redirect route. */
  readonly redirectPages?: boolean;
  /** Add a catch-all rule that serves the SPA shell for unknown paths (Netlify/Cloudflare/Vercel). */
  readonly spaFallback?: boolean;
}

export interface SsrOrganizationConfig {
  readonly name: string;
  readonly logo?: string;
  readonly url?: string;
  readonly sameAs?: readonly string[];
}

export interface SsrPreconnectDefinition {
  readonly href: string;
  readonly crossorigin?: string | boolean;
}

export interface SsrAssetConfig {
  readonly modulePreload?: boolean;
  readonly manifestStyles?: boolean;
  readonly priorityImagePreload?: boolean;
  readonly preconnect?: readonly SsrPreconnectDefinition[];
  readonly dnsPrefetch?: readonly string[];
  readonly globalPreloads?: readonly SsrPreloadAsset[];
  readonly styles?: readonly SsrStyleDefinition[];
  readonly scripts?: readonly SsrScriptDefinition[];
}

export interface SsrShadowDomConfig {
  readonly serialize?: boolean;
  readonly mode?: 'declarative-shadow-dom';
  readonly includeSerializableAttribute?: boolean;
  readonly includeClonableAttribute?: boolean;
  readonly includeDelegatesFocusAttribute?: boolean;
  readonly includeAdoptedStyleSheets?: boolean;
}

export interface SsrPrebootConfig {
  readonly enabled?: boolean;
  readonly maxEvents?: number;
  readonly replayAfterMs?: number;
  readonly captureClick?: boolean;
  readonly captureSubmit?: boolean;
  readonly captureInput?: boolean;
  readonly captureFocus?: boolean;
  readonly captureKeydown?: boolean;
  readonly preventDefaultFor?: readonly ('submit' | 'click')[];
  readonly selectors?: readonly string[];
}

export interface SsrRenderingConfig {
  readonly settleMs?: number;
  readonly timeoutMs?: number;
  readonly hostSelector?: string;
  readonly hostTagName?: string;
  readonly stripAureliaMarkers?: boolean;
  readonly takeoverMode?: SsrTakeoverMode;
  readonly globalStrategy?: SsrGlobalStrategy;
  /** Re-hydrate every route's output on the server and report adoption problems as diagnostics. */
  readonly verifyHydration?: boolean;
}

export interface SsrDiagnosticsBudgets {
  readonly renderMs?: number;
  readonly htmlBytes?: number;
  readonly appHtmlBytes?: number;
  readonly titleMaxLength?: number;
  readonly descriptionMinLength?: number;
  readonly descriptionMaxLength?: number;
  readonly h1MinCount?: number;
  readonly duplicateHostMaxCount?: number;
}

export interface SsrDiagnosticsConfig {
  readonly enabled?: boolean;
  readonly outputFile?: string;
  readonly failOnErrors?: boolean;
  readonly failOnWarnings?: boolean;
  readonly budgets?: SsrDiagnosticsBudgets;
}

export interface SsrSecurityConfig {
  readonly nonce?: string;
  readonly allowInlineScripts?: boolean;
  readonly allowInlineStyles?: boolean;
}

export interface SsrSiteConfig {
  readonly origin: string;
  readonly siteName: string;
  readonly language?: string;
  readonly themeColor?: string;
  readonly defaultTitle?: string;
  readonly defaultDescription?: string;
  readonly defaultOgImage?: string;
  readonly organization?: SsrOrganizationConfig;
  readonly assets?: SsrAssetConfig;
  readonly rendering?: SsrRenderingConfig;
  readonly shadowDom?: SsrShadowDomConfig;
  readonly preboot?: SsrPrebootConfig;
  readonly diagnostics?: SsrDiagnosticsConfig;
  readonly security?: SsrSecurityConfig;
  readonly output?: SsrOutputConfig;
  /** Default cache policy for request-time rendering; routes can override with `route.cache`. */
  readonly cache?: SsrCacheConfig;
  readonly routes?: readonly SsrRouteConfig[];
}

export interface SsrManifestEntry {
  readonly file?: string;
  readonly src?: string;
  readonly name?: string;
  readonly isEntry?: boolean;
  readonly isDynamicEntry?: boolean;
  readonly imports?: readonly string[];
  readonly dynamicImports?: readonly string[];
  readonly css?: readonly string[];
  readonly assets?: readonly string[];
}

export type SsrAssetManifest = Readonly<Record<string, SsrManifestEntry>>;

export interface SsrAppRenderResult {
  readonly appHtml: string;
  readonly path: string;
  readonly documentTitle?: string;
  readonly status?: number;
  readonly redirectTo?: string;
  readonly ssrScope?: ISSRScope;
  readonly ssrDefinition?: ISSRDefinition;
  readonly timings?: Record<string, number>;
  readonly diagnostics?: readonly SsrDiagnostic[];
  readonly data?: Record<string, unknown>;
  /** Serializable state collected through `ISsrState` during the render. */
  readonly state?: Record<string, unknown>;
  /** Head data components set through `ISsrHead` during the render. */
  readonly head?: SsrHeadSnapshot;
}

export interface SsrDocumentResult {
  readonly html: string;
  readonly document: Document;
  readonly canonicalUrl: string;
  readonly diagnostics: readonly SsrDiagnostic[];
}

export interface SsrDiagnostic {
  readonly severity: SsrDiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly value?: unknown;
}

export interface SsrValidationResult {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface SsrRenderContext<TComponent extends object = object> {
  readonly window: Window;
  readonly document: Document;
  readonly host: HTMLElement;
  readonly component: TComponent | (new (...args: never[]) => TComponent);
  readonly container: IContainer;
  readonly platform: unknown;
  readonly route?: SsrRouteConfig;
  readonly site?: SsrSiteConfig;
}

export interface SsrRenderAureliaOptions<TComponent extends object = object> {
  readonly window: Window;
  readonly component: TComponent | (new (...args: never[]) => TComponent);
  readonly route?: SsrRouteConfig;
  readonly site?: SsrSiteConfig;
  readonly host?: HTMLElement;
  readonly hostSelector?: string;
  readonly hostTagName?: string;
  readonly container?: IContainer;
  readonly registrations?: readonly unknown[];
  readonly configureAurelia?: (aurelia: Aurelia, context: SsrRenderContext<TComponent>) => void | Promise<void>;
  readonly beforeStart?: (context: SsrRenderContext<TComponent>) => void | Promise<void>;
  readonly afterStart?: (context: SsrRenderContext<TComponent>) => void | Promise<void>;
  readonly beforeStop?: (context: SsrRenderContext<TComponent>) => void | Promise<void>;
  readonly settle?: number | ((context: SsrRenderContext<TComponent>) => void | Promise<void>);
  readonly timeoutMs?: number;
  readonly serialize?: SerializeHtmlOptions;
  readonly globalStrategy?: SsrGlobalStrategy;
  /**
   * Manifest recording options, or `false` to skip recording. Recording is on
   * by default; the manifest is only embedded in the document when the route
   * hydrates.
   */
  readonly manifest?: RecordSsrManifestOptions | false;
  /** Overrides `route.render.verifyHydration` and `site.rendering.verifyHydration`. */
  readonly verifyHydration?: boolean;
  /**
   * Store registered as `ISsrState` for the render. A fresh store is created
   * by default; pass `false` to leave `ISsrState` unregistered.
   */
  readonly state?: SsrStateStore | false;
  /** Register `ISsrHead` so components can set title, meta, status, and redirects. Defaults to `true`. */
  readonly head?: boolean;
  /**
   * Register `@aurelia/router`'s `ServerLocationManager` for the rendered path
   * so routed apps resolve the right route. `'auto'` (default) registers it
   * when `@aurelia/router` can be loaded; `true` warns when it cannot;
   * `false` skips it. Pass an object to override the path or base href.
   */
  readonly router?: boolean | 'auto' | SsrRouterRenderConfig;
}

export interface SsrRouterRenderConfig {
  /** Path handed to `ServerLocationManager`. Defaults to the route path plus the window's query string. */
  readonly path?: string;
  readonly baseHref?: string;
}

export interface SerializeHtmlOptions {
  readonly shadowDom?: SsrShadowDomConfig;
  readonly stripAureliaMarkers?: boolean;
  readonly preserveComments?: boolean;
  readonly onWarning?: (message: string) => void;
}

export interface SsrBuildDocumentOptions {
  readonly template: string;
  readonly route: SsrRouteConfig;
  readonly site: SsrSiteConfig;
  readonly render: SsrAppRenderResult;
  readonly manifest?: SsrAssetManifest | null;
  readonly document?: Document;
  /**
   * DOM implementation used to parse `template` when no global `document`
   * exists (plain Node without installed globals). Usually the render
   * environment's `document`.
   */
  readonly baseDocument?: Document;
  readonly now?: Date;
  readonly prebootScript?: string;
  readonly clientEntrySelector?: string;
  /** Embed the manifest and definition scripts. Defaults to `true` when the route's takeover mode is `hydrate`. */
  readonly includeManifest?: boolean;
  /** Embed `render.state` as a JSON script for `ISsrState` on the client. Defaults to `true` when state is present. */
  readonly includeState?: boolean;
}

export interface SsrDomGlobalOptions {
  readonly keys?: readonly string[];
  readonly includeStorage?: boolean;
  readonly includeObservers?: boolean;
  readonly includeAnimationFrame?: boolean;
  readonly includeMatchMedia?: boolean;
}

export interface SsrDomEnvironment {
  readonly window: Window;
  readonly document: Document;
  readonly close: () => void;
  readonly serialize?: () => string;
}

export interface SsrDomEnvironmentOptions {
  readonly html?: string;
  readonly url?: string;
  readonly pretendToBeVisual?: boolean;
}

export interface SsrHydrateOptions<TComponent extends object = object> {
  readonly component: new (...args: never[]) => TComponent;
  readonly host?: HTMLElement;
  readonly hostSelector?: string;
  /** Manifest to hydrate with. Defaults to the manifest script `buildSsrDocument` embeds. */
  readonly ssrScope?: ISSRScope;
  /** Serialized AOT definition. Defaults to the definition script `buildSsrDocument` embeds, when present. */
  readonly ssrDefinition?: ISSRDefinition;
  /** Reuse an existing `Aurelia` instance (for example `new Aurelia()` from the `aurelia` package). */
  readonly aurelia?: Aurelia;
  readonly container?: IContainer;
  readonly registrations?: readonly unknown[];
  readonly configureAurelia?: (aurelia: Aurelia) => void | Promise<void>;
  readonly manifestScriptId?: string;
  readonly definitionScriptId?: string;
  /** Register `ISsrState` from the embedded state script. Defaults to `true`. */
  readonly registerState?: boolean;
}

export interface SsrHydrationResult<TComponent extends object = object> {
  readonly aurelia: Aurelia;
  readonly root: IAppRoot<TComponent>;
  readonly host: HTMLElement;
  readonly ssrScope: ISSRScope;
  /** Deactivates and disposes the hydrated app root. */
  readonly stop: () => Promise<void>;
}

export interface SsrConfigurationRegistrationOptions {
  readonly site?: SsrSiteConfig;
  readonly routes?: readonly SsrRouteConfig[];
  readonly registrations?: readonly IRegistry[];
}
