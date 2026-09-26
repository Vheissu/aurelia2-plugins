#!/usr/bin/env node
import { resolveSsrConfigModule, resolveSsrEntryModule } from './config.js';
import type { SsrReport } from './diagnostics.js';
import { prerenderSite } from './prerender.js';
import { formatSsrDiagnosticsForGitHub, formatSsrReport, formatSsrReportMarkdown } from './report.js';
import { validateSsrConfig } from './routes.js';
import type { SsrAssetManifest, SsrDiagnostic } from './types.js';

const HELP = `aurelia2-ssr <command> [options]

Commands
  prerender   Render every route and write the static site output
  check       Validate the config and verify every route hydrates, without writing files
  report      Print a saved ssr-report.json

Options
  --config <file>     Module exporting the SsrSiteConfig (default export or \`site\`)
  --entry <file>      Module exporting the root component (default export or \`component\`)
  --template <file>   Built index.html (default: <out>/index.html)
  --manifest <file>   Vite manifest (default: <out>/.vite/manifest.json when present)
  --out <dir>         Output directory (default: dist)
  --only <paths>      Comma-separated route paths to include
  --format <kind>     Report format: text (default), json, markdown, github
  --no-color          Disable ANSI colors
  --fail-on-warnings  Exit non-zero when warnings are reported
  --help              Show this help

TypeScript config and entry modules load directly on Node 22.18+ (type
stripping). On older Node versions run through a loader, for example:
  node --import tsx node_modules/aurelia2-ssr/dist/cli.js prerender ...
`;

interface CliArgs {
  readonly command: string | undefined;
  readonly flags: Record<string, string | boolean>;
  readonly positional: string[];
}

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);

  if (!args.command || args.flags.help) {
    process.stdout.write(HELP);
    return args.command ? 0 : 1;
  }

  switch (args.command) {
    case 'prerender':
      return prerenderCommand(args, true);
    case 'check':
      return prerenderCommand(args, false);
    case 'report':
      return reportCommand(args);
    default:
      process.stderr.write(`Unknown command "${args.command}".\n\n${HELP}`);
      return 1;
  }
}

async function prerenderCommand(args: CliArgs, write: boolean): Promise<number> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const outDir = path.resolve(String(args.flags.out ?? 'dist'));
  const configPath = args.flags.config;
  const entryPath = args.flags.entry;

  if (typeof configPath !== 'string' || typeof entryPath !== 'string') {
    process.stderr.write('--config and --entry are required.\n');
    return 1;
  }

  const site = resolveSsrConfigModule(await importModule(configPath));
  if (!site) {
    process.stderr.write(`${configPath} does not export an SsrSiteConfig.\n`);
    return 1;
  }
  const entry = resolveSsrEntryModule(await importModule(entryPath));
  if (!entry) {
    process.stderr.write(`${entryPath} does not export a root component.\n`);
    return 1;
  }

  const validation = validateSsrConfig(site);
  if (validation.errors.length) {
    process.stderr.write(`Config errors:\n${validation.errors.map(e => `  ${e}`).join('\n')}\n`);
    return 1;
  }

  const templatePath = typeof args.flags.template === 'string' ? path.resolve(args.flags.template) : path.join(outDir, 'index.html');
  const template = await fs.readFile(templatePath, 'utf8');
  const manifest = await readOptionalJson<SsrAssetManifest>(
    fs,
    typeof args.flags.manifest === 'string' ? path.resolve(args.flags.manifest) : path.join(outDir, '.vite/manifest.json'),
  );
  const only = typeof args.flags.only === 'string' ? args.flags.only.split(',').map(value => value.trim()).filter(Boolean) : undefined;

  const result = await prerenderSite({
    site,
    component: entry.component,
    template,
    manifest,
    only,
    outDir: write ? outDir : undefined,
    write: write ? undefined : async () => undefined,
    render: {
      registrations: entry.registrations,
      configureAurelia: entry.configureAurelia as never,
      settle: entry.settle as never,
      beforeStart: entry.beforeStart as never,
      afterStart: entry.afterStart as never,
      ...(write ? {} : { verifyHydration: true }),
    },
    onRoute: route => {
      if (args.flags.format === 'text' || args.flags.format === undefined) {
        const marker = route.ok ? '✔' : '✖';
        process.stderr.write(`${marker} ${route.path} ${route.durationMs}ms\n`);
      }
    },
  });

  const extra = result.diagnostics.filter(d => !result.report.routes.some(r => r.diagnostics.includes(d)));
  process.stdout.write(formatOutput(result.report, extra, args));

  const hasWarnings = result.diagnostics.some(d => d.severity === 'warning');
  return result.failed || (args.flags['fail-on-warnings'] && hasWarnings) ? 1 : 0;
}

async function reportCommand(args: CliArgs): Promise<number> {
  const fs = await import('node:fs/promises');
  const file = args.positional[0] ?? 'dist/ssr-report.json';
  const parsed = await readOptionalJson<SsrReport & { configDiagnostics?: SsrDiagnostic[] }>(fs, file);
  if (!parsed) {
    process.stderr.write(`Could not read ${file}.\n`);
    return 1;
  }

  process.stdout.write(formatOutput(parsed, parsed.configDiagnostics ?? [], args));
  return parsed.summary.errors > 0 ? 1 : 0;
}

function formatOutput(report: SsrReport, extra: readonly SsrDiagnostic[], args: CliArgs): string {
  const format = String(args.flags.format ?? 'text');
  const all = [...report.routes.flatMap(route => route.diagnostics), ...extra];

  switch (format) {
    case 'json':
      return `${JSON.stringify({ ...report, configDiagnostics: extra }, null, 2)}\n`;
    case 'markdown':
      return formatSsrReportMarkdown(report, extra);
    case 'github':
      return `${formatSsrDiagnosticsForGitHub(all)}\n${formatSsrReport(report, extra)}`;
    default:
      return formatSsrReport(report, extra, { colors: !args.flags['no-color'] && Boolean(process.stdout.isTTY) });
  }
}

async function importModule(file: string): Promise<unknown> {
  const path = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  return import(pathToFileURL(path.resolve(file)).href);
}

async function readOptionalJson<T>(fs: typeof import('node:fs/promises'), file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let command: string | undefined;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg.startsWith('--')) {
      const [name, inlineValue] = arg.slice(2).split('=', 2);
      if (inlineValue !== undefined) {
        flags[name] = inlineValue;
      } else if (name.startsWith('no-')) {
        flags[name] = true;
      } else {
        const next = argv[index + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[name] = next;
          index++;
        } else {
          flags[name] = true;
        }
      }
    } else if (!command) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }

  return { command, flags, positional };
}

const isDirectRun = typeof process !== 'undefined'
  && Array.isArray(process.argv)
  && /[\\/]cli\.(?:m?js|ts)$/u.test(process.argv[1] ?? '');

if (isDirectRun) {
  runCli().then(code => {
    process.exitCode = code;
  }, error => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
