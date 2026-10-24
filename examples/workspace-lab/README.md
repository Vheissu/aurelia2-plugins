# Workspace lab

A small Aurelia application demonstrating five plugins together:

- `aurelia2-filter-builder`: edit and run a typed customer filter.
- `aurelia2-url-state`: persist search, page state, and the filter in the query string.
- `aurelia2-transfer-list`: assign and order reviewers.
- `aurelia2-merge`: reconcile a local draft with a simulated server conflict.
- `aurelia2-mentions`: insert teammates into a comment and track their text ranges.

From the repository root:

```sh
npm ci
npm run build
npm ci --prefix examples/workspace-lab
npm run start --prefix examples/workspace-lab
```

Open `http://127.0.0.1:9011`. The example imports built package exports, so rebuild a package after editing its source. `npm run build --prefix examples/workspace-lab` type-checks and builds the production app.

Try a filter, change the page number, reload, and use Back/Forward. Assign a reviewer and use Alt+Up/Down in the assigned list. Simulate a conflict and select a value before applying it. Type `@an` in the comment, then press Enter to insert Ana.

Page numbers demonstrate URL history; this three-record fixture does not paginate results. Reviewer changes, comments, and merges stay in memory. The search callback and server conflict are simulated; no backend receives data.
