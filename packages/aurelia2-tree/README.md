# aurelia2-tree

A keyboard-accessible tree for project navigation, folder pickers, and hierarchical admin data. It handles lazy children, loading failures, expansion, selection, and roving focus. Visible rows are flattened into one keyed Aurelia repeat.

```sh
npm install aurelia2-tree
```

```ts
import Aurelia from 'aurelia';
import { AureliaTreeConfiguration, type TreeNode } from 'aurelia2-tree';

Aurelia.register(AureliaTreeConfiguration);

export class Files {
  nodes: TreeNode[] = [{ id: 'projects', label: 'Projects', hasChildren: true }];
  selected: string | null = null;
  load = async (node: TreeNode, signal: AbortSignal): Promise<TreeNode[]> => {
    const response = await fetch(`/api/folders/${encodeURIComponent(node.id)}`, { signal });
    if (!response.ok) throw new Error('Unable to load folder');
    return response.json();
  };
}
```

```html
<au-tree nodes.bind="nodes" load-children.bind="load" selected.two-way="selected"
  label="Project files" tree-select.trigger="openItem($event.detail.id)">
</au-tree>
```

## Nodes and loading

A node has a globally unique non-empty `id`, a text `label`, optional `children`, `hasChildren`, and `disabled`. Known children take precedence over `hasChildren`; an empty children array is a known leaf. Use `hasChildren: true` without `children` to request lazy loading.

Expansion requests for the same node share one promise. Successful children are cached for the model's lifetime. Tree validation uses an explicit stack, including for deeply nested server data. Duplicate IDs, cycles, malformed children, and missing string IDs/labels are rejected before new children are committed. Load errors are exposed on rows and displayed beside the node; expand again to retry. Collapsing a loading branch aborts its request and ignores late results. Cancellation resolves expansion as false immediately, even if the loader ignores its signal. Replacing nodes, changing the loader, or unbinding cancels pending requests.

Treat node trees as immutable input. Replace `nodes` to reflect external changes; that creates a fresh tree model and clears loaded children. A node's ID must remain stable. This implementation renders every visible row; use a dedicated virtualized view for extremely large expanded trees.

## Keyboard and accessibility

| Key | Action |
| --- | --- |
| Up / Down | Previous / next visible row |
| Right | Expand, or move to the first child |
| Left | Collapse, or move to the parent |
| Home / End | First / last visible row |
| Enter / Space | Select the focused node |
| Printable characters | Prefix search; the prefix resets after 700 ms |

Click selects; a disclosure button toggles expansion with one click or tap. Double-clicking the row also toggles expansion. Disabled nodes remain focusable but cannot be selected. Selection is single-valued. `tree-select` bubbles with `{ id }`. Parent collapse moves focus out of hidden descendants. Lazy completion never reclaims focus after the user has moved outside the tree. Programmatic selection reveals known ancestors; removing the selected node clears the bound selection. Selection and node changes made in the same turn are reconciled before an unknown ID is cleared. Rows expose `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded`, `aria-selected`, and loading/disabled states.

## Headless model

Resolve `TreeFactory` to create an independent `TreeModel` for a custom view. Its `rows` contain `{ id, node, level, position, size, expanded, branch, busy, error }`; `activeId` and `selectedId` hold navigation state. Methods include `expand`, `collapse`, `toggle`, `navigate`, `search`, `select`, `has`, `replace`, and `dispose`.

`expand` and `toggle` resolve a boolean; loader failures become row errors. `dispose` aborts requests and permanently stops expansion. Calling `replace` on a disposed model does nothing; create a new model to start again. Disposal from an abort callback also takes precedence over an ongoing replacement. A custom loader must honour its signal to stop underlying work.

Requires Aurelia `^2.0.0-rc.2`. Build with `npm run build -w aurelia2-tree`; test with `npm test -w aurelia2-tree -- --runInBand`.
