import {
  CustomElement,
  IRendering,
  type CustomAttributeDefinition,
  type CustomElementDefinition,
  type ICustomAttributeController,
  type ICustomElementController,
  type IRenderLocation,
  type ISyntheticView,
  type ISSRManifest,
  type ISSRScope,
  type ISSRScopeChild,
  type ISSRTemplateController,
} from '@aurelia/runtime-html';
import { itHydrateElement, itHydrateTemplateController } from '@aurelia/template-compiler';
import type { SsrDiagnostic } from './types.js';

/**
 * Options for {@link recordSsrManifest}.
 */
export interface RecordSsrManifestOptions {
  /** Route path attached to diagnostics. */
  readonly path?: string;
  /**
   * Discover children that were composed outside of template instructions
   * (router viewports, `au-compose`) by scanning the rendered DOM.
   * Defaults to `true`.
   */
  readonly includeDynamicChildren?: boolean;
  /**
   * Compare the number of recorded instruction-driven children with the
   * compiled template so a manifest that cannot hydrate fails early.
   * Defaults to `true`.
   */
  readonly validateInstructions?: boolean;
}

export interface SsrManifestStats {
  readonly elements: number;
  readonly templateControllers: number;
  readonly views: number;
  readonly dynamicChildren: number;
}

export interface SsrManifestRecording {
  /** Root scope, ready for `Aurelia.hydrate({ ssrScope })`. */
  readonly scope: ISSRScope;
  /** Root scope wrapped in the `ISSRManifest` envelope Aurelia core defines. */
  readonly manifest: ISSRManifest;
  readonly diagnostics: readonly SsrDiagnostic[];
  readonly stats: SsrManifestStats;
}

type ParentController = ICustomElementController | ISyntheticView;

interface MutableStats {
  elements: number;
  templateControllers: number;
  views: number;
  dynamicChildren: number;
}

interface RecorderContext {
  readonly path: string | undefined;
  readonly includeDynamicChildren: boolean;
  readonly validateInstructions: boolean;
  readonly diagnostics: SsrDiagnostic[];
  readonly stats: MutableStats;
  readonly seen: WeakSet<object>;
}

const TEXT_NODE = 3;

/**
 * Records the tree-shaped SSR manifest that Aurelia core's hydration path
 * consumes (`Aurelia.hydrate({ ssrScope })`).
 *
 * The recorder walks the live controller tree after the app has started and
 * mirrors what `Rendering.render` expects on the client:
 *
 * - every custom element and template controller created by a template
 *   instruction appears in `children`, in instruction order
 * - each template controller lists its active views, and every view carries
 *   the number of top-level DOM nodes it owns (`nodeCount`)
 * - containerless custom elements carry `nodeCount` too
 * - dynamically composed children (router viewports, `au-compose`) are
 *   appended by name so the router's `RouteContext` can find them
 *
 * Call it while the app is still running, after data has settled.
 */
export function recordSsrManifest(
  controller: ICustomElementController,
  options: RecordSsrManifestOptions = {},
): SsrManifestRecording {
  const context: RecorderContext = {
    path: options.path,
    includeDynamicChildren: options.includeDynamicChildren ?? true,
    validateInstructions: options.validateInstructions ?? true,
    diagnostics: [],
    stats: { elements: 0, templateControllers: 0, views: 0, dynamicChildren: 0 },
    seen: new WeakSet(),
  };

  const scope = recordScope(controller, context);

  return {
    scope,
    manifest: { root: controller.definition.name, manifest: scope },
    diagnostics: context.diagnostics,
    stats: { ...context.stats },
  };
}

/**
 * Counts the sibling nodes a template controller view (or containerless
 * element) owns in the live DOM. This is the number `partitionSiblingNodes`
 * will consume on the client.
 */
export function countSsrViewNodes(view: ISyntheticView): number {
  return countNodeRange(view.nodes.firstChild, view.nodes.lastChild) ?? view.nodes.childNodes.length;
}

/**
 * Returns the number of template-instruction children (custom elements and
 * template controllers) a compiled definition will ask the manifest for.
 */
export function countChildInstructions(definition: CustomElementDefinition): number {
  let count = 0;
  for (const row of definition.instructions) {
    for (const instruction of row) {
      const type = (instruction as { type: unknown }).type;
      if (type === itHydrateElement || type === itHydrateTemplateController) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Structural comparison of two scopes. `state` is compared with JSON
 * semantics; everything else must match exactly.
 */
export function ssrScopesEqual(left: ISSRScopeChild, right: ISSRScopeChild): boolean {
  return JSON.stringify(normalizeScopeChild(left)) === JSON.stringify(normalizeScopeChild(right));
}

function recordScope(controller: ParentController, context: RecorderContext): ISSRScope {
  context.seen.add(controller);
  const children: ISSRScopeChild[] = [];
  const scope: ISSRScope = { children };

  if (controller.vmKind === 'customElement') {
    scope.name = controller.definition.name;
    context.stats.elements++;

    if (controller.location != null) {
      const count = countRenderLocation(controller.location);
      if (count !== null) {
        scope.nodeCount = count;
      }
    }
  } else {
    context.stats.views++;
    scope.nodeCount = recordViewNodeCount(controller, context);
  }

  const recorded = recordInstructionChildren(controller, children, context);

  if (context.validateInstructions) {
    validateInstructionCount(controller, recorded, context);
  }

  if (context.includeDynamicChildren) {
    recordDynamicChildren(controller, children, context);
  }

  return scope;
}

function recordInstructionChildren(
  controller: ParentController,
  children: ISSRScopeChild[],
  context: RecorderContext,
): number {
  let recorded = 0;

  for (const child of controller.children ?? []) {
    if (child.vmKind === 'customElement') {
      children.push(recordScope(child, context));
      recorded++;
      continue;
    }

    if (child.vmKind === 'customAttribute' && isTemplateControllerController(child)) {
      children.push(recordTemplateController(child, context));
      recorded++;
    }
  }

  return recorded;
}

function recordTemplateController(
  controller: ICustomAttributeController,
  context: RecorderContext,
): ISSRTemplateController {
  context.seen.add(controller);
  context.stats.templateControllers++;

  const type = controller.definition.name;
  const viewModel = controller.viewModel as Record<string, unknown>;
  const views = collectActiveViews(viewModel);
  const entry: ISSRTemplateController = {
    type,
    views: views.map(view => recordScope(view, context)),
  };

  const state = templateControllerState(type, viewModel);
  if (state !== undefined) {
    entry.state = state;
  }

  if (type === 'portal') {
    pushDiagnostic(context, 'warning', 'manifest_portal_unsupported',
      'A portal template controller moves its view outside the host; Aurelia core cannot hydrate it in place.');
  }

  return entry;
}

function recordDynamicChildren(
  controller: ParentController,
  children: ISSRScopeChild[],
  context: RecorderContext,
): void {
  const roots = controller.vmKind === 'customElement'
    ? [controller.host]
    : Array.from(controller.nodes.childNodes).filter(isElement);

  for (const root of roots) {
    if (root == null) {
      continue;
    }

    scanForOwnedElements(root, controller, children, context);
  }
}

function scanForOwnedElements(
  element: Element,
  owner: ParentController,
  children: ISSRScopeChild[],
  context: RecorderContext,
): void {
  for (const child of Array.from(element.children)) {
    const controller = CustomElement.for(child, { optional: true });

    if (controller != null) {
      if (controller.parent === owner && !context.seen.has(controller)) {
        children.push(recordScope(controller, context));
        context.stats.dynamicChildren++;
      }

      continue;
    }

    scanForOwnedElements(child, owner, children, context);
  }
}

function validateInstructionCount(
  controller: ParentController,
  recorded: number,
  context: RecorderContext,
): void {
  const definition = controller.vmKind === 'customElement'
    ? controller.definition
    : (controller as unknown as { viewFactory?: { def: CustomElementDefinition } | null }).viewFactory?.def;

  if (definition == null) {
    return;
  }

  let expected: number;
  try {
    const compiled = controller.container.get(IRendering).compile(definition, controller.container);
    expected = countChildInstructions(compiled);
  } catch {
    return;
  }

  if (expected !== recorded) {
    const label = controller.vmKind === 'customElement' ? `<${controller.definition.name}>` : `view "${definition.name}"`;
    pushDiagnostic(context, 'error', 'manifest_child_mismatch',
      `${label} compiled ${expected} child instruction(s) but ${recorded} child controller(s) were recorded; hydration would bind the wrong nodes.`,
      { expected, recorded });
  }
}

function recordViewNodeCount(view: ISyntheticView, context: RecorderContext): number {
  const nodes = view.nodes;
  const first = nodes.firstChild;
  const last = nodes.lastChild;
  const domCount = countNodeRange(first, last);

  if (domCount === null) {
    pushDiagnostic(context, 'warning', 'manifest_node_drift',
      'A template controller view no longer owns a contiguous DOM range; the app mutated server DOM after render.');
    return nodes.childNodes.length;
  }

  if (domCount !== nodes.childNodes.length) {
    pushDiagnostic(context, 'warning', 'manifest_node_drift',
      `A template controller view rendered ${nodes.childNodes.length} node(s) but ${domCount} are in the DOM; the manifest records the DOM count.`,
      { rendered: nodes.childNodes.length, dom: domCount });
  }

  checkSerializationHazards(first, last, context);

  return domCount;
}

function checkSerializationHazards(first: Node | null, last: Node | null, context: RecorderContext): void {
  let current: Node | null = first;

  while (current != null) {
    if (current.nodeType === TEXT_NODE) {
      if ((current.textContent ?? '') === '') {
        pushDiagnostic(context, 'error', 'manifest_empty_text_node',
          'A template controller view has an empty top-level text node. It disappears when the HTML is parsed, so the client would count one node fewer. Wrap the interpolation in an element.');
      } else if (current.nextSibling?.nodeType === TEXT_NODE && current !== last) {
        pushDiagnostic(context, 'error', 'manifest_adjacent_text_nodes',
          'A template controller view has adjacent top-level text nodes. Browsers merge them when parsing HTML, so the client would count fewer nodes. Wrap the text in an element.');
      }
    }

    if (current === last) {
      break;
    }

    current = current.nextSibling;
  }
}

function countRenderLocation(location: IRenderLocation): number | null {
  const start = (location as IRenderLocation<Comment>).$start;
  if (start == null) {
    return null;
  }

  let count = 0;
  let current: Node | null = start.nextSibling;
  while (current != null && current !== location) {
    count++;
    current = current.nextSibling;
  }

  return current === location ? count : null;
}

function countNodeRange(first: Node | null, last: Node | null): number | null {
  if (first == null || last == null) {
    return first == null && last == null ? 0 : null;
  }

  let count = 0;
  let current: Node | null = first;
  while (current != null) {
    count++;
    if (current === last) {
      return count;
    }
    current = current.nextSibling;
  }

  return null;
}

function collectActiveViews(viewModel: Record<string, unknown>): ISyntheticView[] {
  const candidates: unknown[] = Array.isArray(viewModel.views)
    ? viewModel.views
    : viewModel.view !== undefined
      ? [viewModel.view]
      : [];

  return candidates.filter(isActiveSyntheticView);
}

function templateControllerState(type: string, viewModel: Record<string, unknown>): unknown {
  switch (type) {
    case 'if':
      return { value: Boolean(viewModel.value) };
    default:
      return undefined;
  }
}

function isTemplateControllerController(controller: ICustomAttributeController): boolean {
  return (controller.definition as CustomAttributeDefinition).isTemplateController === true;
}

function isActiveSyntheticView(value: unknown): value is ISyntheticView {
  return typeof value === 'object'
    && value !== null
    && (value as ISyntheticView).vmKind === 'synthetic'
    && (value as ISyntheticView).isActive === true;
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function normalizeScopeChild(child: ISSRScopeChild): unknown {
  if ('type' in child) {
    return {
      type: child.type,
      state: child.state === undefined ? undefined : JSON.parse(JSON.stringify(child.state)),
      views: child.views.map(normalizeScopeChild),
    };
  }

  return {
    name: child.name,
    nodeCount: child.nodeCount,
    children: child.children.map(normalizeScopeChild),
  };
}

function pushDiagnostic(
  context: RecorderContext,
  severity: SsrDiagnostic['severity'],
  code: string,
  message: string,
  value?: unknown,
): void {
  context.diagnostics.push({
    severity,
    code,
    message,
    path: context.path,
    value,
  });
}

