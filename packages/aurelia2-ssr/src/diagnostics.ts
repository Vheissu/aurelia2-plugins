import type {
  SsrAppRenderResult,
  SsrDiagnostic,
  SsrDiagnosticsBudgets,
  SsrDocumentResult,
  SsrRouteConfig,
  SsrSiteConfig,
} from './types.js';

const defaultBudgets: Required<SsrDiagnosticsBudgets> = {
  renderMs: 1200,
  htmlBytes: 180000,
  appHtmlBytes: 120000,
  titleMaxLength: 65,
  descriptionMinLength: 50,
  descriptionMaxLength: 170,
  h1MinCount: 1,
  duplicateHostMaxCount: 1,
};

export interface SsrRouteReport {
  readonly path: string;
  readonly mode: string;
  readonly status: number;
  readonly canonicalUrl: string;
  readonly priority: string;
  readonly renderMs: number;
  readonly htmlBytes: number;
  readonly appHtmlBytes: number;
  readonly title: string;
  readonly descriptionLength: number;
  readonly h1Count: number;
  readonly diagnostics: readonly SsrDiagnostic[];
}

export interface SsrReport {
  readonly generatedAt: string;
  readonly origin: string;
  readonly routes: readonly SsrRouteReport[];
  readonly summary: {
    readonly routes: number;
    readonly warnings: number;
    readonly errors: number;
    readonly totalHtmlBytes: number;
    readonly slowestRouteMs: number;
  };
}

export function analyzeSsrDocument(
  result: SsrDocumentResult,
  route: SsrRouteConfig,
  site: SsrSiteConfig,
  render: SsrAppRenderResult,
): readonly SsrDiagnostic[] {
  const diagnostics: SsrDiagnostic[] = [...result.diagnostics, ...(render.diagnostics ?? [])];
  const document = result.document;
  const budgets = {
    ...defaultBudgets,
    ...(site.diagnostics?.budgets ?? {}),
  };
  const title = document.title;
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
  const h1Count = document.querySelectorAll('h1').length;
  const hostSelector = site.rendering?.hostSelector ?? site.rendering?.hostTagName ?? 'my-app';
  const hostCount = document.querySelectorAll(hostSelector).length;
  const htmlBytes = byteLength(result.html);
  const appHtmlBytes = byteLength(render.appHtml);
  const renderMs = render.timings?.renderMs ?? 0;

  if (!title) {
    diagnostics.push(createDiagnostic('error', 'missing_title', 'Document title is missing.', route.path));
  } else if (title.length > budgets.titleMaxLength) {
    diagnostics.push(createDiagnostic('warning', 'title_too_long', `Title is ${title.length} characters; budget is ${budgets.titleMaxLength}.`, route.path, title.length));
  }

  if (!description) {
    diagnostics.push(createDiagnostic('error', 'missing_description', 'Meta description is missing.', route.path));
  } else if (description.length < budgets.descriptionMinLength) {
    diagnostics.push(createDiagnostic('warning', 'description_too_short', `Description is ${description.length} characters; minimum is ${budgets.descriptionMinLength}.`, route.path, description.length));
  } else if (description.length > budgets.descriptionMaxLength) {
    diagnostics.push(createDiagnostic('warning', 'description_too_long', `Description is ${description.length} characters; maximum is ${budgets.descriptionMaxLength}.`, route.path, description.length));
  }

  if (!canonical) {
    diagnostics.push(createDiagnostic('error', 'missing_canonical', 'Canonical link is missing.', route.path));
  }
  if (h1Count < budgets.h1MinCount) {
    diagnostics.push(createDiagnostic('warning', 'missing_h1', `Found ${h1Count} h1 elements; minimum is ${budgets.h1MinCount}.`, route.path, h1Count));
  }
  if (hostCount > budgets.duplicateHostMaxCount) {
    diagnostics.push(createDiagnostic('error', 'duplicate_host', `Found ${hostCount} SSR hosts for selector "${hostSelector}".`, route.path, hostCount));
  }
  if (renderMs > budgets.renderMs) {
    diagnostics.push(createDiagnostic('warning', 'render_budget_exceeded', `Render took ${renderMs}ms; budget is ${budgets.renderMs}ms.`, route.path, renderMs));
  }
  if (htmlBytes > budgets.htmlBytes) {
    diagnostics.push(createDiagnostic('warning', 'html_budget_exceeded', `HTML is ${htmlBytes} bytes; budget is ${budgets.htmlBytes}.`, route.path, htmlBytes));
  }
  if (appHtmlBytes > budgets.appHtmlBytes) {
    diagnostics.push(createDiagnostic('warning', 'app_html_budget_exceeded', `App HTML is ${appHtmlBytes} bytes; budget is ${budgets.appHtmlBytes}.`, route.path, appHtmlBytes));
  }

  return diagnostics;
}

export function createRouteReport(
  result: SsrDocumentResult,
  route: SsrRouteConfig,
  site: SsrSiteConfig,
  render: SsrAppRenderResult,
): SsrRouteReport {
  const diagnostics = analyzeSsrDocument(result, route, site, render);
  const document = result.document;
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';

  return {
    path: route.path,
    mode: route.mode ?? 'prerender',
    status: render.status ?? route.status ?? 200,
    canonicalUrl: result.canonicalUrl,
    priority: route.priority?.level ?? 'normal',
    renderMs: render.timings?.renderMs ?? 0,
    htmlBytes: byteLength(result.html),
    appHtmlBytes: byteLength(render.appHtml),
    title: document.title,
    descriptionLength: description.length,
    h1Count: document.querySelectorAll('h1').length,
    diagnostics,
  };
}

export function createSsrReport(site: SsrSiteConfig, routes: readonly SsrRouteReport[], now: Date = new Date()): SsrReport {
  const warnings = routes.reduce((total, route) => {
    return total + route.diagnostics.filter(diagnostic => diagnostic.severity === 'warning').length;
  }, 0);
  const errors = routes.reduce((total, route) => {
    return total + route.diagnostics.filter(diagnostic => diagnostic.severity === 'error').length;
  }, 0);

  return {
    generatedAt: now.toISOString(),
    origin: site.origin,
    routes,
    summary: {
      routes: routes.length,
      warnings,
      errors,
      totalHtmlBytes: routes.reduce((total, route) => total + route.htmlBytes, 0),
      slowestRouteMs: Math.max(...routes.map(route => route.renderMs), 0),
    },
  };
}

export function shouldFailSsrBuild(site: SsrSiteConfig, diagnostics: readonly SsrDiagnostic[]): boolean {
  const hasErrors = diagnostics.some(diagnostic => diagnostic.severity === 'error');
  const hasWarnings = diagnostics.some(diagnostic => diagnostic.severity === 'warning');

  return Boolean((site.diagnostics?.failOnErrors ?? true) && hasErrors)
    || Boolean(site.diagnostics?.failOnWarnings && hasWarnings);
}

function createDiagnostic(
  severity: SsrDiagnostic['severity'],
  code: string,
  message: string,
  path: string,
  value?: unknown,
): SsrDiagnostic {
  return {
    severity,
    code,
    message,
    path,
    value,
  };
}

function byteLength(value: string): number {
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(value, 'utf8');
  }

  return new TextEncoder().encode(value).length;
}
