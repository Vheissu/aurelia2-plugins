import type { SsrReport, SsrRouteReport } from './diagnostics.js';
import type { SsrDiagnostic } from './types.js';

export interface FormatSsrReportOptions {
  /** ANSI colors. Defaults to `false`. */
  readonly colors?: boolean;
  /** Print every route line, not only routes with diagnostics. Defaults to `true`. */
  readonly verbose?: boolean;
}

/** Human-readable console summary of a build report. */
export function formatSsrReport(
  report: SsrReport,
  extraDiagnostics: readonly SsrDiagnostic[] = [],
  options: FormatSsrReportOptions = {},
): string {
  const paint = painter(options.colors ?? false);
  const lines: string[] = [];

  lines.push(paint.bold(`aurelia2-ssr report for ${report.origin}`));
  lines.push(paint.dim(`generated ${report.generatedAt}`));
  lines.push('');

  if (options.verbose ?? true) {
    const width = Math.max(...report.routes.map(route => route.path.length), 4);
    for (const route of report.routes) {
      lines.push(formatRouteLine(route, width, paint));
      for (const diagnostic of route.diagnostics) {
        lines.push(`  ${formatDiagnosticLine(diagnostic, paint)}`);
      }
    }
    if (report.routes.length) {
      lines.push('');
    }
  }

  for (const diagnostic of extraDiagnostics) {
    lines.push(formatDiagnosticLine(diagnostic, paint));
  }
  if (extraDiagnostics.length) {
    lines.push('');
  }

  const { summary } = report;
  const errorText = summary.errors ? paint.red(`${summary.errors} error${plural(summary.errors)}`) : paint.green('0 errors');
  const warningText = summary.warnings ? paint.yellow(`${summary.warnings} warning${plural(summary.warnings)}`) : '0 warnings';
  lines.push(`${summary.routes} route${plural(summary.routes)}, ${errorText}, ${warningText}, ${formatBytes(summary.totalHtmlBytes)} HTML, slowest ${summary.slowestRouteMs}ms`);

  return `${lines.join('\n')}\n`;
}

/** Single-line rendering of diagnostics, one per line. */
export function formatSsrDiagnostics(diagnostics: readonly SsrDiagnostic[], options: FormatSsrReportOptions = {}): string {
  const paint = painter(options.colors ?? false);
  return diagnostics.map(diagnostic => formatDiagnosticLine(diagnostic, paint)).join('\n');
}

/**
 * GitHub Actions workflow commands (`::error title=...::message`) so
 * diagnostics show up as annotations on the run and the pull request.
 */
export function formatSsrDiagnosticsForGitHub(diagnostics: readonly SsrDiagnostic[]): string {
  return diagnostics
    .filter(diagnostic => diagnostic.severity !== 'info')
    .map(diagnostic => {
      const level = diagnostic.severity === 'error' ? 'error' : 'warning';
      const title = ghEscapeProperty(`${diagnostic.code}${diagnostic.path ? ` ${diagnostic.path}` : ''}`);
      return `::${level} title=${title}::${ghEscapeData(diagnostic.message)}`;
    })
    .join('\n');
}

/** Markdown table for pull request comments or job summaries (`$GITHUB_STEP_SUMMARY`). */
export function formatSsrReportMarkdown(report: SsrReport, extraDiagnostics: readonly SsrDiagnostic[] = []): string {
  const lines: string[] = [];
  lines.push(`### SSR report for ${report.origin}`);
  lines.push('');
  lines.push(`${report.summary.routes} routes · ${report.summary.errors} errors · ${report.summary.warnings} warnings · ${formatBytes(report.summary.totalHtmlBytes)} HTML · slowest ${report.summary.slowestRouteMs}ms`);
  lines.push('');
  lines.push('| Route | Status | Render | HTML | Title | Diagnostics |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const route of report.routes) {
    const codes = route.diagnostics.map(d => `${d.severity === 'error' ? '❌' : d.severity === 'warning' ? '⚠️' : 'ℹ️'} \`${d.code}\``).join('<br>');
    lines.push(`| \`${route.path}\` | ${route.status} | ${route.renderMs}ms | ${formatBytes(route.htmlBytes)} | ${escapeCell(route.title)} | ${codes || '—'} |`);
  }
  if (extraDiagnostics.length) {
    lines.push('');
    for (const diagnostic of extraDiagnostics) {
      lines.push(`- ${diagnostic.severity === 'error' ? '❌' : '⚠️'} \`${diagnostic.code}\`${diagnostic.path ? ` \`${diagnostic.path}\`` : ''}: ${escapeCell(diagnostic.message)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function formatRouteLine(route: SsrRouteReport, width: number, paint: Painter): string {
  const errors = route.diagnostics.filter(d => d.severity === 'error').length;
  const warnings = route.diagnostics.filter(d => d.severity === 'warning').length;
  const marker = errors ? paint.red('✖') : warnings ? paint.yellow('▲') : paint.green('✔');
  const status = route.status === 200 ? paint.dim(String(route.status)) : paint.yellow(String(route.status));
  return `${marker} ${route.path.padEnd(width)}  ${status}  ${String(route.renderMs).padStart(5)}ms  ${formatBytes(route.htmlBytes).padStart(9)}  ${paint.dim(route.title)}`;
}

function formatDiagnosticLine(diagnostic: SsrDiagnostic, paint: Painter): string {
  const severity = diagnostic.severity === 'error'
    ? paint.red('error')
    : diagnostic.severity === 'warning' ? paint.yellow('warning') : paint.dim('info');
  const path = diagnostic.path ? paint.dim(` ${diagnostic.path}`) : '';
  return `${severity} ${paint.bold(diagnostic.code)}${path}: ${diagnostic.message}`;
}

interface Painter {
  bold(value: string): string;
  dim(value: string): string;
  red(value: string): string;
  yellow(value: string): string;
  green(value: string): string;
}

function painter(colors: boolean): Painter {
  const wrap = (open: number, close: number) => (value: string) => colors ? `\u001b[${open}m${value}\u001b[${close}m` : value;
  return {
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    red: wrap(31, 39),
    yellow: wrap(33, 39),
    green: wrap(32, 39),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} kB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function plural(count: number): string {
  return count === 1 ? '' : 's';
}

function ghEscapeData(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function ghEscapeProperty(value: string): string {
  return ghEscapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
