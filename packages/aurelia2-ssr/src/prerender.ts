import { createRouteReport, createSsrReport, shouldFailSsrBuild, type SsrReport, type SsrRouteReport } from './diagnostics.js';
import { buildSsrDocument } from './document.js';
import { createJSDOMEnvironment } from './globals.js';
import { createSsrRedirectFiles, isRedirectStatus, type SsrOutputFile } from './redirects.js';
import { renderAureliaToString } from './renderer.js';
import {
  createRobotsTxt,
  createSitemapXml,
  expandSsrRoutes,
  normalizeSsrPath,
  outputFileForRoute,
  validateSsrConfig,
} from './routes.js';
import type {
  SsrAppRenderResult,
  SsrAssetManifest,
  SsrDiagnostic,
  SsrDocumentResult,
  SsrDomEnvironment,
  SsrOutputConfig,
  SsrRenderAureliaOptions,
  SsrRouteConfig,
  SsrSiteConfig,
} from './types.js';

export type { SsrOutputFile } from './redirects.js';

export type SsrPrerenderRenderOptions<TComponent extends object> = Omit<
  SsrRenderAureliaOptions<TComponent>,
  'window' | 'component' | 'route' | 'site' | 'host'
>;

export interface SsrPrerenderOptions<TComponent extends object = object> {
  readonly site: SsrSiteConfig;
  readonly component: new (...args: never[]) => TComponent;
  /** The built `index.html` (from Vite's output directory) used as the document template. */
  readonly template: string;
  /** Vite build manifest (`.vite/manifest.json`) for module preloads and CSS. */
  readonly manifest?: SsrAssetManifest | null;
  /** Routes to render. Defaults to `site.routes`. Dynamic routes are expanded first. */
  readonly routes?: readonly SsrRouteConfig[];
  /** Only render routes whose path matches one of these (exact, after normalization). */
  readonly only?: readonly string[];
  /** Output directory. Files are written with `write`, or Node's `fs` when `write` is omitted. */
  readonly outDir?: string;
  /** Custom writer; receives every output file. When omitted and `outDir` is set, files are written to disk. */
  readonly write?: (file: SsrOutputFile, absolutePath: string | null) => void | Promise<void>;
  /** Overrides `site.output`. */
  readonly output?: SsrOutputConfig;
  /**
   * Creates the DOM per route. Defaults to `createJSDOMEnvironment`. The
   * environment is closed after each route.
   */
  readonly createEnvironment?: (url: string, route: SsrRouteConfig) => Promise<SsrDomEnvironment> | SsrDomEnvironment;
  /** Options forwarded to `renderAureliaToString` for every route. */
  readonly render?: SsrPrerenderRenderOptions<TComponent>;
  /**
   * Routes rendered at once. Defaults to `1`; DOM globals and the Aurelia
   * platform are process-wide, so raise this only with `globalStrategy: 'none'`
   * and a per-route container.
   */
  readonly concurrency?: number;
  /** Called after each route finishes. */
  readonly onRoute?: (result: SsrPrerenderRouteResult) => void;
  /** Called before each route starts. */
  readonly onStart?: (route: SsrRouteConfig, index: number, total: number) => void;
  /** Continue after a route fails. Defaults to `true`; the report still marks the failure. */
  readonly continueOnError?: boolean;
  readonly now?: Date;
}

export interface SsrPrerenderRouteResult {
  readonly route: SsrRouteConfig;
  readonly path: string;
  readonly file: string | null;
  readonly kind: 'page' | 'redirect' | 'client' | 'skipped';
  readonly html: string | null;
  readonly render: SsrAppRenderResult | null;
  readonly document: SsrDocumentResult | null;
  readonly report: SsrRouteReport | null;
  readonly diagnostics: readonly SsrDiagnostic[];
  readonly ok: boolean;
  readonly durationMs: number;
}

export interface SsrPrerenderResult {
  readonly routes: readonly SsrPrerenderRouteResult[];
  readonly files: readonly SsrOutputFile[];
  readonly report: SsrReport;
  readonly diagnostics: readonly SsrDiagnostic[];
  /** `true` when `shouldFailSsrBuild` says the diagnostics exceed the site's thresholds. */
  readonly failed: boolean;
  readonly durationMs: number;
}

/**
 * Renders every prerender route of a site and produces the complete static
 * output: HTML pages, redirect files, 404 page, sitemap, robots.txt, and the
 * JSON report.
 *
 * ```ts
 * const result = await prerenderSite({
 *   site,
 *   component: MyApp,
 *   template: await fs.readFile('dist/index.html', 'utf8'),
 *   manifest: JSON.parse(await fs.readFile('dist/.vite/manifest.json', 'utf8')),
 *   outDir: 'dist',
 * });
 * if (result.failed) process.exit(1);
 * ```
 */
export async function prerenderSite<TComponent extends object = object>(
  options: SsrPrerenderOptions<TComponent>,
): Promise<SsrPrerenderResult> {
  const startedAt = Date.now();
  const site = options.site;
  const output: SsrOutputConfig = { ...(site.output ?? {}), ...(options.output ?? {}) };
  const now = options.now ?? new Date();
  const diagnostics: SsrDiagnostic[] = [];
  const files: SsrOutputFile[] = [];
  const results: SsrPrerenderRouteResult[] = [];

  const validation = validateSsrConfig({ ...site, routes: options.routes ?? site.routes ?? [] });
  diagnostics.push(...validation.errors.map(message => configDiagnostic('error', message)));
  diagnostics.push(...validation.warnings.map(message => configDiagnostic('warning', message)));

  const expansion = await expandSsrRoutes(options.routes ?? site.routes ?? []);
  diagnostics.push(...expansion.diagnostics);

  const only = options.only?.map(normalizeSsrPath);
  const routes = expansion.routes.filter(route => !only || only.includes(normalizeSsrPath(route.path)));
  const renderable = routes.filter(route => !route.redirectTo && (route.mode ?? 'prerender') !== 'server');

  if ((options.concurrency ?? 1) > 1 && (options.render?.globalStrategy ?? site.rendering?.globalStrategy ?? 'install-and-restore') !== 'none') {
    diagnostics.push(configDiagnostic('warning',
      'concurrency > 1 with globalStrategy "install-and-restore" shares window globals between renders. Use globalStrategy "none" or concurrency 1.',
      'prerender_unsafe_concurrency'));
  }

  const writer = createWriter(options);

  // Pages.
  await runWithConcurrency(renderable, options.concurrency ?? 1, async (route, index) => {
    options.onStart?.(route, index, renderable.length);
    const result = await prerenderRoute(route, options, output, now);
    results.push(result);
    options.onRoute?.(result);

    if (result.html !== null && result.file) {
      const file: SsrOutputFile = { path: result.file, contents: result.html, kind: 'page' };
      files.push(file);
      await writer(file);

      if ((result.render?.status ?? route.status) === 404) {
        const notFound: SsrOutputFile = {
          path: output.notFoundFile ?? '404.html',
          contents: result.html,
          kind: 'not-found',
        };
        if (notFound.path !== file.path) {
          files.push(notFound);
          await writer(notFound);
        }
      }
    }

    if (!result.ok && options.continueOnError === false) {
      throw new Error(`Prerender failed for ${route.path}: ${result.diagnostics.filter(d => d.severity === 'error').map(d => d.message).join('; ')}`);
    }
  });

  // Redirects (from config and from components that called head.redirect()).
  const redirectRoutes: SsrRouteConfig[] = [
    ...routes.filter(route => route.redirectTo),
    ...results
      .filter(result => result.kind === 'page' && result.render?.redirectTo)
      .map(result => ({ ...result.route, redirectTo: result.render!.redirectTo, status: result.render!.status })),
  ];
  for (const route of routes.filter(r => r.redirectTo)) {
    results.push({
      route,
      path: route.path,
      file: output.redirectPages ?? true ? outputFileForRoute(route, { cleanUrls: output.cleanUrls }) : null,
      kind: 'redirect',
      html: null,
      render: null,
      document: null,
      report: null,
      diagnostics: [],
      ok: true,
      durationMs: 0,
    });
  }
  for (const file of createSsrRedirectFiles(redirectRoutes, site, output)) {
    files.push(file);
    await writer(file);
  }

  // Server-mode routes are not prerendered but still appear in the sitemap.
  for (const route of routes.filter(r => (r.mode ?? 'prerender') === 'server' && !r.redirectTo)) {
    results.push({
      route, path: route.path, file: null, kind: 'skipped', html: null, render: null, document: null,
      report: null, diagnostics: [], ok: true, durationMs: 0,
    });
  }

  if (output.sitemap ?? true) {
    const file: SsrOutputFile = { path: 'sitemap.xml', contents: createSitemapXml(routes, site, now), kind: 'sitemap' };
    files.push(file);
    await writer(file);
  }

  if (output.robots ?? true) {
    const file: SsrOutputFile = { path: 'robots.txt', contents: createRobotsTxt(site), kind: 'robots' };
    files.push(file);
    await writer(file);
  }

  const routeReports = results.flatMap(result => result.report ? [result.report] : []);
  const report = createSsrReport(site, routeReports, now);
  const allDiagnostics = [...diagnostics, ...results.flatMap(result => result.diagnostics)];

  if (output.report ?? true) {
    const file: SsrOutputFile = {
      path: site.diagnostics?.outputFile ?? 'ssr-report.json',
      contents: `${JSON.stringify({ ...report, configDiagnostics: diagnostics }, null, 2)}\n`,
      kind: 'report',
    };
    files.push(file);
    await writer(file);
  }

  return {
    routes: results,
    files,
    report,
    diagnostics: allDiagnostics,
    failed: shouldFailSsrBuild(site, allDiagnostics),
    durationMs: Date.now() - startedAt,
  };
}

/** Renders one route to a finished HTML document without writing anything. */
export async function prerenderRoute<TComponent extends object>(
  route: SsrRouteConfig,
  options: SsrPrerenderOptions<TComponent>,
  output: SsrOutputConfig = { ...(options.site.output ?? {}), ...(options.output ?? {}) },
  now: Date = options.now ?? new Date(),
): Promise<SsrPrerenderRouteResult> {
  const startedAt = Date.now();
  const site = options.site;
  const file = outputFileForRoute(route, { cleanUrls: output.cleanUrls });
  const hostTag = site.rendering?.hostTagName ?? site.rendering?.hostSelector?.replace(/^[#.]/u, '') ?? 'my-app';

  const url = new URL(route.path, site.origin).toString();
  const environment = await (options.createEnvironment
    ? options.createEnvironment(url, route)
    : createJSDOMEnvironment({
      url,
      html: `<!doctype html><html><head><base href="/"></head><body><${hostTag}></${hostTag}></body></html>`,
    }));

  try {
    if ((route.mode ?? 'prerender') === 'client') {
      const shell = buildSsrDocument({
        template: options.template,
        route,
        site,
        render: { appHtml: `<${hostTag}></${hostTag}>`, path: route.path, status: route.status },
        manifest: options.manifest,
        now,
        includeManifest: false,
        baseDocument: environment.document,
      });
      const report = createRouteReport(shell, route, site, { appHtml: '', path: route.path });

      return {
        route, path: route.path, file, kind: 'client', html: shell.html, render: null, document: shell, report,
        diagnostics: shell.diagnostics.filter(d => d.code !== 'missing_h1'), ok: true, durationMs: Date.now() - startedAt,
      };
    }

    const render = await renderAureliaToString<TComponent>({
      ...(options.render ?? {}),
      window: environment.window,
      component: options.component,
      site,
      route,
    });

    if (render.redirectTo && isRedirectStatus(render.status)) {
      return {
        route, path: route.path, file: null, kind: 'page', html: null, render, document: null, report: null,
        diagnostics: render.diagnostics ?? [], ok: true, durationMs: Date.now() - startedAt,
      };
    }

    const document = buildSsrDocument({
      template: options.template,
      route,
      site,
      render,
      manifest: options.manifest,
      now,
      baseDocument: environment.document,
    });
    const report = createRouteReport(document, route, site, render);
    const ok = !document.diagnostics.some(diagnostic => diagnostic.severity === 'error');

    return {
      route, path: route.path, file, kind: 'page', html: document.html, render, document, report,
      diagnostics: document.diagnostics, ok, durationMs: Date.now() - startedAt,
    };
  } finally {
    environment.close();
  }
}

function createWriter<TComponent extends object>(
  options: SsrPrerenderOptions<TComponent>,
): (file: SsrOutputFile) => Promise<void> {
  if (options.write) {
    const write = options.write;
    const outDir = options.outDir;
    return async file => {
      await write(file, outDir ? joinPath(outDir, file.path) : null);
    };
  }

  if (!options.outDir) {
    return async () => undefined;
  }

  const outDir = options.outDir;
  let fsPromise: Promise<typeof import('node:fs/promises')> | null = null;
  return async file => {
    fsPromise ??= import('node:fs/promises');
    const fs = await fsPromise;
    const target = joinPath(outDir, file.path);
    const directory = target.slice(0, target.lastIndexOf('/'));
    if (directory) {
      await fs.mkdir(directory, { recursive: true });
    }
    await fs.writeFile(target, file.contents, 'utf8');
  };
}

function joinPath(directory: string, file: string): string {
  return `${directory.replace(/[\\/]+$/u, '')}/${file.replace(/^[\\/]+/u, '')}`;
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      await task(items[index], index);
    }
  });
  await Promise.all(workers);
}

function configDiagnostic(severity: SsrDiagnostic['severity'], message: string, code = 'config_invalid'): SsrDiagnostic {
  const path = message.match(/^(\/[^:]*):/u)?.[1];
  return { severity, code, message, path };
}
