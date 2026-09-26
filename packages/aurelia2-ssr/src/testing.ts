import { buildSsrDocument } from './document.js';
import { renderAureliaToString } from './renderer.js';
import { verifySsrHydration, type SsrHydrationVerification } from './verify.js';
import { CustomElement, type ISSRScope, type ISSRScopeChild } from '@aurelia/runtime-html';
import type {
  SsrAppRenderResult,
  SsrDiagnostic,
  SsrDocumentResult,
  SsrRenderAureliaOptions,
  SsrRouteConfig,
  SsrSiteConfig,
} from './types.js';

export type SsrTestRenderOptions<TComponent extends object> = Omit<
  SsrRenderAureliaOptions<TComponent>,
  'window' | 'component' | 'host'
> & {
  /** Defaults to the global `window` (Jest jsdom / Vitest jsdom or happy-dom). */
  readonly window?: Window;
  /** Host tag rendered into `document.body`. Defaults to the component's element name or `my-app`. */
  readonly hostTagName?: string;
  /** Build a full document as well. Provide the template, or `true` for a minimal one. */
  readonly document?: string | boolean;
  readonly site?: SsrSiteConfig;
  readonly route?: SsrRouteConfig;
};

export interface SsrTestRenderResult {
  readonly render: SsrAppRenderResult;
  readonly appHtml: string;
  readonly ssrScope: ISSRScope | undefined;
  readonly diagnostics: readonly SsrDiagnostic[];
  readonly errors: readonly SsrDiagnostic[];
  readonly document: SsrDocumentResult | null;
  readonly html: string | null;
}

const testSite: SsrSiteConfig = {
  origin: 'http://localhost',
  siteName: 'Test',
  rendering: { hostTagName: 'my-app', takeoverMode: 'hydrate' },
  preboot: { enabled: false },
  diagnostics: { budgets: { descriptionMinLength: 1, h1MinCount: 0 } },
};

const testRoute: SsrRouteConfig = {
  path: '/',
  seo: { title: 'Test', description: 'Test page' },
  render: { takeoverMode: 'hydrate' },
};

/**
 * Renders a component the way the server would and returns the HTML,
 * manifest, and diagnostics. Uses the test runner's jsdom window by default.
 */
export async function renderSsrForTest<TComponent extends object>(
  component: new (...args: never[]) => TComponent,
  options: SsrTestRenderOptions<TComponent> = {},
): Promise<SsrTestRenderResult> {
  const win = options.window ?? window;
  const doc = win.document;
  const hostTag = options.hostTagName ?? elementNameOf(component) ?? 'my-app';
  const site: SsrSiteConfig = {
    ...testSite,
    ...(options.site ?? {}),
    rendering: { ...testSite.rendering, hostTagName: hostTag, ...(options.site?.rendering ?? {}) },
  };
  const route: SsrRouteConfig = options.route ?? testRoute;

  doc.body.innerHTML = `<${hostTag}></${hostTag}>`;

  const { window: _window, hostTagName: _hostTagName, document: documentOption, site: _site, route: _route, ...renderOptions } = options;
  const render = await renderAureliaToString<TComponent>({
    ...renderOptions,
    window: win,
    component,
    site,
    route,
    hostTagName: hostTag,
  });

  let document: SsrDocumentResult | null = null;
  if (documentOption) {
    const template = typeof documentOption === 'string'
      ? documentOption
      : `<!doctype html><html><head></head><body><${hostTag}></${hostTag}></body></html>`;
    document = buildSsrDocument({ template, site, route, render });
  }

  const diagnostics = document?.diagnostics ?? render.diagnostics ?? [];
  return {
    render,
    appHtml: render.appHtml,
    ssrScope: render.ssrScope,
    diagnostics,
    errors: diagnostics.filter(diagnostic => diagnostic.severity === 'error'),
    document,
    html: document?.html ?? null,
  };
}

export interface SsrHydrationTestOptions<TComponent extends object> extends SsrTestRenderOptions<TComponent> {
  readonly settleMs?: number;
}

export interface SsrHydrationTestResult extends SsrHydrationVerification {
  readonly appHtml: string;
  readonly ssrScope: ISSRScope;
  readonly render: SsrAppRenderResult;
}

/**
 * Renders a component on the "server", then hydrates the output with the
 * recorded manifest and reports whether the DOM survived untouched.
 *
 * ```ts
 * const result = await expectSsrHydration(MyApp);
 * expect(result.ok).toBe(true);
 * ```
 */
export async function expectSsrHydration<TComponent extends object>(
  component: new (...args: never[]) => TComponent,
  options: SsrHydrationTestOptions<TComponent> = {},
): Promise<SsrHydrationTestResult> {
  const win = options.window ?? window;
  const rendered = await renderSsrForTest(component, options);

  if (!rendered.ssrScope) {
    const failure: SsrHydrationTestResult = {
      ok: false,
      diagnostics: [
        ...rendered.diagnostics,
        { severity: 'error', code: 'verify_requires_manifest', message: 'No manifest was recorded for the render.', path: rendered.render.path },
      ],
      nodesBefore: 0,
      nodesAfter: 0,
      hydratedHtml: '',
      appHtml: rendered.appHtml,
      ssrScope: { children: [] },
      render: rendered.render,
    };
    return failure;
  }

  const verification = await verifySsrHydration({
    window: win,
    component,
    appHtml: rendered.appHtml,
    ssrScope: rendered.ssrScope,
    registrations: options.registrations,
    configureAurelia: options.configureAurelia
      ? aurelia => options.configureAurelia!(aurelia, { container: aurelia.container } as never)
      : undefined,
    settleMs: options.settleMs,
    path: rendered.render.path,
  });

  return {
    ...verification,
    diagnostics: [...rendered.errors, ...verification.diagnostics],
    ok: verification.ok && rendered.errors.length === 0,
    appHtml: rendered.appHtml,
    ssrScope: rendered.ssrScope,
    render: rendered.render,
  };
}

/** Like `expectSsrHydration` but throws with the formatted diagnostics on failure. */
export async function assertSsrHydrates<TComponent extends object>(
  component: new (...args: never[]) => TComponent,
  options: SsrHydrationTestOptions<TComponent> = {},
): Promise<SsrHydrationTestResult> {
  const result = await expectSsrHydration(component, options);
  if (!result.ok) {
    const details = result.diagnostics
      .filter(diagnostic => diagnostic.severity !== 'info')
      .map(diagnostic => `  [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`)
      .join('\n');
    throw new Error(`Expected ${elementNameOf(component) ?? component.name} to hydrate without changes:\n${details}`);
  }
  return result;
}

/**
 * Compact, order-stable description of a manifest for snapshot tests:
 * `['my-app', 'if(1)', 'repeat(3)', 'child']` style, nested per scope.
 */
export function manifestSnapshot(scope: ISSRScope | undefined): unknown {
  if (!scope) {
    return null;
  }
  return snapshotScope(scope);
}

function snapshotScope(scope: ISSRScope): Record<string, unknown> {
  const node: Record<string, unknown> = {};
  if (scope.name) {
    node.name = scope.name;
  }
  if (scope.nodeCount !== undefined) {
    node.nodes = scope.nodeCount;
  }
  node.children = scope.children.map(snapshotChild);
  return node;
}

function snapshotChild(child: ISSRScopeChild): unknown {
  if ('views' in child) {
    return {
      tc: child.type,
      ...(child.state !== undefined ? { state: child.state } : {}),
      views: child.views.map(snapshotScope),
    };
  }
  return snapshotScope(child);
}

function elementNameOf(component: unknown): string | null {
  if (typeof component === 'function' && CustomElement.isType(component)) {
    return CustomElement.getDefinition(component).name;
  }
  return null;
}
