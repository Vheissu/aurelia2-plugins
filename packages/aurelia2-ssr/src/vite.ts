import { resolveSsrConfigModule, resolveSsrEntryModule, type SsrServerEntry } from './config.js';
import { prerenderSite, type SsrPrerenderOptions, type SsrPrerenderResult } from './prerender.js';
import { formatSsrReport } from './report.js';
import {
  createNodeSsrMiddleware,
  createSsrRequestHandler,
  type NodeRequestLike,
  type NodeResponseLike,
  type SsrRequestHandlerOptions,
} from './server.js';
import type { SsrAssetManifest, SsrSiteConfig } from './types.js';

/**
 * Minimal structural types for the Vite plugin surface this module touches, so
 * the package does not need `vite` as a dependency. The object returned by
 * `aureliaSsr()` is assignable to Vite's `Plugin`.
 */
export interface ViteResolvedConfigLike {
  readonly root: string;
  readonly command: 'build' | 'serve';
  readonly configFile?: string;
  readonly mode: string;
  readonly build: { readonly outDir: string; readonly ssr?: boolean | string; readonly manifest?: boolean | string };
  readonly logger?: { info(message: string): void; warn(message: string): void; error(message: string): void };
}

export interface ViteDevServerLike {
  readonly config: ViteResolvedConfigLike;
  readonly middlewares: {
    use(handler: (req: NodeRequestLike, res: NodeResponseLike, next: (error?: unknown) => void) => void): unknown;
  };
  ssrLoadModule(url: string): Promise<Record<string, unknown>>;
  ssrFixStacktrace?(error: Error): void;
  transformIndexHtml(url: string, html: string): Promise<string>;
  close(): Promise<void>;
}

export interface VitePluginLike {
  readonly name: string;
  readonly enforce?: 'pre' | 'post';
  apply?(config: unknown, env: { command: 'build' | 'serve'; mode: string; isSsrBuild?: boolean }): boolean;
  configResolved?(config: ViteResolvedConfigLike): void | Promise<void>;
  configureServer?(server: ViteDevServerLike): void | (() => void) | Promise<void | (() => void)>;
  closeBundle?(): void | Promise<void>;
}

export interface AureliaSsrVitePluginOptions {
  /**
   * Module exporting the root component (and optional `registrations`,
   * `settle`, `configureAurelia`). Relative to the Vite root.
   * @example 'src/ssr-entry.ts'
   */
  readonly entry: string;
  /** Site config object, or a module path (relative to the Vite root) exporting one. */
  readonly config: SsrSiteConfig | string;
  /** Prerender after `vite build`. `true` (default) or `prerenderSite` overrides. */
  readonly prerender?: boolean | Partial<Omit<SsrPrerenderOptions, 'site' | 'component' | 'template' | 'manifest' | 'outDir'>>;
  /** Serve server-rendered HTML in `vite dev`. Defaults to `true`. */
  readonly dev?: boolean | Partial<Pick<SsrRequestHandlerOptions, 'fallback' | 'onRenderError' | 'headers' | 'createEnvironment'>>;
  /** Template file relative to the root in dev (`index.html`) and relative to `outDir` after build. */
  readonly template?: string;
  /** Print the report after prerendering. Defaults to `true`. */
  readonly printReport?: boolean;
  /** Fail the build when `shouldFailSsrBuild` reports errors. Defaults to `true`. */
  readonly failOnError?: boolean;
  /** Called with the prerender result. */
  readonly onPrerendered?: (result: SsrPrerenderResult) => void | Promise<void>;
}

const INTERNAL_ENV = 'AURELIA_SSR_INTERNAL';

/**
 * Vite plugin: server-renders pages in `vite dev` and prerenders the site
 * after `vite build`, using `prerenderSite` with the built template and
 * manifest.
 *
 * ```ts
 * // vite.config.ts
 * import aurelia from '@aurelia/vite-plugin';
 * import { aureliaSsr } from 'aurelia2-ssr/vite';
 *
 * export default defineConfig({
 *   build: { manifest: true },
 *   plugins: [aurelia(), aureliaSsr({ entry: 'src/ssr-entry.ts', config: 'ssr.config.ts' })],
 * });
 * ```
 */
export function aureliaSsr(options: AureliaSsrVitePluginOptions): VitePluginLike {
  let resolved: ViteResolvedConfigLike | null = null;

  return {
    name: 'aurelia2-ssr',
    enforce: 'post',
    apply(_config, env) {
      // A nested Vite server is created during closeBundle to load the entry;
      // keep this plugin out of that inner instance.
      if (typeof process !== 'undefined' && process.env?.[INTERNAL_ENV] === '1') {
        return false;
      }
      return !env.isSsrBuild;
    },
    configResolved(config) {
      resolved = config;
    },
    configureServer(server) {
      if (options.dev === false) {
        return;
      }

      const devOptions = typeof options.dev === 'object' ? options.dev : {};
      let handlerPromise: Promise<ReturnType<typeof createSsrRequestHandler>> | null = null;

      const loadHandler = async () => {
        const entry = await loadEntry(server, options.entry, server.config.root);
        const site = await loadSite(server, options.config, server.config.root, entry);
        const templatePath = `${server.config.root}/${options.template ?? 'index.html'}`;
        const fs = await import('node:fs/promises');

        return createSsrRequestHandler({
          site,
          component: entry.component,
          template: async request => server.transformIndexHtml(request.url, await fs.readFile(templatePath, 'utf8')),
          fallback: devOptions.fallback ?? 'render',
          onRenderError: devOptions.onRenderError ?? 'error',
          headers: devOptions.headers,
          createEnvironment: devOptions.createEnvironment,
          cache: false,
          etag: false,
          render: {
            registrations: entry.registrations,
            configureAurelia: entry.configureAurelia as never,
            settle: entry.settle as never,
            beforeStart: entry.beforeStart as never,
            afterStart: entry.afterStart as never,
          },
        });
      };

      // Return a post hook so Vite's own middleware (assets, HMR) run first.
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if ((req.method ?? 'GET') !== 'GET' && req.method !== 'HEAD') {
            next();
            return;
          }

          try {
            // Reload per request in dev so edits to the entry and config apply.
            handlerPromise = loadHandler();
            const handler = await handlerPromise;
            const middleware = createNodeSsrMiddleware(handler);
            await middleware(req, res, next);
          } catch (error) {
            if (error instanceof Error) {
              server.ssrFixStacktrace?.(error);
            }
            next(error);
          }
        });
      };
    },
    async closeBundle() {
      if (!resolved || resolved.command !== 'build' || options.prerender === false || resolved.build.ssr) {
        return;
      }

      const log = resolved.logger ?? console;
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const outDir = path.isAbsolute(resolved.build.outDir) ? resolved.build.outDir : path.join(resolved.root, resolved.build.outDir);
      const templatePath = path.join(outDir, options.template ?? 'index.html');
      const template = await fs.readFile(templatePath, 'utf8');
      const manifest = await readManifest(fs, path, outDir, resolved.build.manifest);

      if (!manifest) {
        log.warn('[aurelia2-ssr] No Vite manifest found; set build.manifest = true to get modulepreload and CSS injection.');
      }

      // Resolved at runtime only; `vite` is an optional peer dependency.
      const viteModuleName = 'vite';
      const { createServer } = await import(viteModuleName) as {
        createServer(config: Record<string, unknown>): Promise<ViteDevServerLike>;
      };
      const previous = process.env[INTERNAL_ENV];
      process.env[INTERNAL_ENV] = '1';
      const inner = await createServer({
        configFile: resolved.configFile ?? false,
        root: resolved.root,
        mode: resolved.mode,
        logLevel: 'error',
        server: { middlewareMode: true, hmr: false, watch: null },
        appType: 'custom',
        optimizeDeps: { noDiscovery: true, include: [] },
      });
      process.env[INTERNAL_ENV] = previous ?? '';
      if (previous === undefined) {
        delete process.env[INTERNAL_ENV];
      }

      try {
        const entry = await loadEntry(inner, options.entry, resolved.root);
        const site = await loadSite(inner, options.config, resolved.root, entry);
        const overrides = typeof options.prerender === 'object' ? options.prerender : {};

        const result = await prerenderSite({
          ...overrides,
          site,
          component: entry.component,
          template,
          manifest,
          outDir,
          render: {
            registrations: entry.registrations,
            configureAurelia: entry.configureAurelia as never,
            settle: entry.settle as never,
            beforeStart: entry.beforeStart as never,
            afterStart: entry.afterStart as never,
            ...(overrides.render ?? {}),
          },
        });

        if (options.printReport ?? true) {
          log.info(formatSsrReport(result.report, result.diagnostics.filter(d => !result.report.routes.some(r => r.diagnostics.includes(d))), { colors: true }));
        }
        await options.onPrerendered?.(result);

        if (result.failed && (options.failOnError ?? true)) {
          throw new Error(`[aurelia2-ssr] Prerender reported ${result.report.summary.errors} error(s). See ${site.diagnostics?.outputFile ?? 'ssr-report.json'} in ${resolved.build.outDir}.`);
        }
      } finally {
        await inner.close();
      }
    },
  };
}

async function loadEntry(server: ViteDevServerLike, entry: string, root: string): Promise<SsrServerEntry> {
  const module = await server.ssrLoadModule(toModuleUrl(entry, root));
  const resolvedEntry = resolveSsrEntryModule(module);
  if (!resolvedEntry) {
    throw new Error(`[aurelia2-ssr] ${entry} must export the root component (default export or \`component\`).`);
  }
  return resolvedEntry;
}

async function loadSite(
  server: ViteDevServerLike,
  config: SsrSiteConfig | string,
  root: string,
  entry: SsrServerEntry,
): Promise<SsrSiteConfig> {
  if (typeof config !== 'string') {
    return config;
  }
  const module = await server.ssrLoadModule(toModuleUrl(config, root));
  const site = resolveSsrConfigModule(module) ?? entry.site;
  if (!site) {
    throw new Error(`[aurelia2-ssr] ${config} must export an SsrSiteConfig (default export or \`site\`).`);
  }
  return site;
}

function toModuleUrl(file: string, _root: string): string {
  if (file.startsWith('/') || /^[a-z]:/iu.test(file)) {
    return file;
  }
  return `/${file.replace(/^\.\//u, '')}`;
}

async function readManifest(
  fs: typeof import('node:fs/promises'),
  path: typeof import('node:path'),
  outDir: string,
  manifestOption: boolean | string | undefined,
): Promise<SsrAssetManifest | null> {
  const candidates = [
    typeof manifestOption === 'string' ? manifestOption : null,
    '.vite/manifest.json',
    'manifest.json',
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      const contents = await fs.readFile(path.join(outDir, candidate), 'utf8');
      return JSON.parse(contents) as SsrAssetManifest;
    } catch {
      continue;
    }
  }
  return null;
}
