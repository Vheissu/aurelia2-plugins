import { Aurelia, type IAppRoot, type ISSRScope } from '@aurelia/runtime-html';
import { recordSsrManifest, ssrScopesEqual } from './manifest.js';
import { createServerContainer } from './renderer.js';
import type { SsrDiagnostic } from './types.js';

export interface VerifySsrHydrationOptions<TComponent extends object = object> {
  readonly window: Window;
  /** The root component class. Hydration needs a constructor, not an instance. */
  readonly component: new (...args: never[]) => TComponent;
  /** Serialized host markup produced by `renderAureliaToString`, markers included. */
  readonly appHtml: string;
  /** Manifest recorded from the same render. */
  readonly ssrScope: ISSRScope;
  /** Registrations the client app would use (router, plugins, ...). */
  readonly registrations?: readonly unknown[];
  readonly configureAurelia?: (aurelia: Aurelia) => void | Promise<void>;
  /** Route path attached to diagnostics. */
  readonly path?: string;
  /** Milliseconds to wait after hydration before comparing DOM. Defaults to 0 (one macrotask turn). */
  readonly settleMs?: number;
}

export interface SsrHydrationVerification {
  /** `true` when no error-level diagnostic was produced. */
  readonly ok: boolean;
  readonly diagnostics: readonly SsrDiagnostic[];
  /** Total DOM nodes under the host before hydration. */
  readonly nodesBefore: number;
  /** Total DOM nodes under the host after hydration. */
  readonly nodesAfter: number;
  /** Host `innerHTML` after hydration, useful when diffing a `hydration_html_changed` warning. */
  readonly hydratedHtml: string;
}

/**
 * Hydrates the serialized SSR output in a scratch element and checks that
 * Aurelia adopted the server DOM instead of re-rendering it.
 *
 * Use it in prerender pipelines and integration tests to catch manifests,
 * templates, or components that would silently duplicate content or bind the
 * wrong nodes on the client. It uses the same core `Aurelia.hydrate()` path
 * the browser uses, so passing here is a strong signal the page will hydrate.
 */
export async function verifySsrHydration<TComponent extends object = object>(
  options: VerifySsrHydrationOptions<TComponent>,
): Promise<SsrHydrationVerification> {
  const { window } = options;
  const document = window.document;
  const diagnostics: SsrDiagnostic[] = [];
  const scratch = document.createElement('div');
  scratch.setAttribute('data-aurelia-ssr-verify', '');
  scratch.innerHTML = options.appHtml;

  const host = scratch.firstElementChild as HTMLElement | null;
  if (host == null) {
    diagnostics.push(diagnostic('error', 'verify_missing_host', 'appHtml does not start with a host element.', options.path));
    return { ok: false, diagnostics, nodesBefore: 0, nodesAfter: 0, hydratedHtml: '' };
  }

  document.body.append(scratch);

  const before = host.innerHTML;
  const originalNodes = collectNodes(host);
  const server = createServerContainer(window, options.registrations ?? [], true);
  let root: IAppRoot | null = null;
  let after = before;
  let afterNodes = originalNodes;

  try {
    const aurelia = new Aurelia(server.container);
    await options.configureAurelia?.(aurelia);
    root = await aurelia.hydrate({
      host,
      component: options.component,
      ssrScope: options.ssrScope,
    });
    await settle(window, options.settleMs ?? 0);

    after = host.innerHTML;
    afterNodes = collectNodes(host);

    const detached = originalNodes.filter(node => !node.isConnected).length;
    if (detached > 0) {
      diagnostics.push(diagnostic('error', 'hydration_nodes_replaced',
        `${detached} of ${originalNodes.length} server-rendered nodes were detached during hydration; Aurelia re-rendered instead of adopting them.`,
        options.path, { detached, total: originalNodes.length }));
    }

    if (afterNodes.length > originalNodes.length) {
      diagnostics.push(diagnostic('error', 'hydration_nodes_added',
        `Hydration added ${afterNodes.length - originalNodes.length} node(s); a template controller fell back to a fresh render, so the page would show duplicated content.`,
        options.path, { before: originalNodes.length, after: afterNodes.length }));
    } else if (afterNodes.length < originalNodes.length) {
      diagnostics.push(diagnostic('error', 'hydration_nodes_removed',
        `Hydration removed ${originalNodes.length - afterNodes.length} node(s) from the server DOM.`,
        options.path, { before: originalNodes.length, after: afterNodes.length }));
    } else if (after !== before) {
      diagnostics.push(diagnostic('warning', 'hydration_html_changed',
        `Hydrated HTML differs from the server HTML (first difference at offset ${firstDifference(before, after)}). Server and client state may be out of sync.`,
        options.path, { offset: firstDifference(before, after) }));
    }

    const recorded = recordSsrManifest(root.controller, { path: options.path, validateInstructions: false });
    if (!ssrScopesEqual(recorded.scope, options.ssrScope)) {
      diagnostics.push(diagnostic('error', 'hydration_manifest_mismatch',
        'The controller tree after hydration does not match the manifest that was used to hydrate it.',
        options.path));
    }
  } catch (error) {
    diagnostics.push(diagnostic('error', 'hydration_failed',
      error instanceof Error ? error.message : String(error), options.path));
  } finally {
    if (root != null) {
      try {
        await root.deactivate();
        root.dispose();
      } catch {
        // The verification tree is discarded either way.
      }
    }

    server.restorePlatform();
    scratch.remove();
  }

  return {
    ok: !diagnostics.some(entry => entry.severity === 'error'),
    diagnostics,
    nodesBefore: originalNodes.length,
    nodesAfter: afterNodes.length,
    hydratedHtml: after,
  };
}

function collectNodes(root: Node): Node[] {
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      nodes.push(child);
      visit(child);
    }
  };

  visit(root);
  return nodes;
}

function settle(window: Window, ms: number): Promise<void> {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms);
  });
}

function firstDifference(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index++) {
    if (left[index] !== right[index]) {
      return index;
    }
  }

  return length;
}

function diagnostic(
  severity: SsrDiagnostic['severity'],
  code: string,
  message: string,
  path?: string,
  value?: unknown,
): SsrDiagnostic {
  return { severity, code, message, path, value };
}
