# Plugin verification and production review

Initial review completed on 24 October 2026 using Node 26.5.0 and Aurelia 2.0.0-rc.2. That work was committed as `28f9d32`. The follow-up below used Node 25.2.1 with the same Aurelia version.

## Follow-up fixes

The second pass added eight tests across four packages. Five tests failed against the previous implementation before the fixes:

- Sortable keyboard previews lost browser focus when Aurelia moved the focused DOM node. Subsequent keys went to the page instead of the list. Focus now follows the same element through preview, commit, and cancellation, without taking focus back from another control.
- Mutating `sortable-before-change` event data could empty the array being committed or corrupt its indices. The proposal now has its own array and metadata object.
- An async task's abort listener could dispose the task during restart, yet the replacement action still ran. Restart now checks disposal after cancellation callbacks finish.
- A tree's abort callback could call `replace` and revive a disposed model. Disposal is now permanent, including when it occurs during replacement.
- Recovering from an autosave serialization failure by reverting to the acknowledged model returned success while retaining the error status. A successful flush with no outstanding changes now clears that error.

The additional tests cover focus moving outside the list, cancellation-triggered expansion, and disposal during root replacement. The complete suite passes **65 suites and 412 tests**, with no skipped tests; the ten new plugins account for **132 tests**. Their source lint passes with zero errors and zero warnings. All 45 workspace packages and the production demo build successfully, and all ten package entrypoints import in Node.

The rebuilt production demo also passed a WebKit keyboard check: pick up Design, move it with ArrowUp and End, commit with Enter, then preview another move and cancel with Escape. Focus remained on Design throughout, and cancellation restored the committed order.

## Initial review findings and fixes

| Plugin | Defects fixed and functionality added |
| --- | --- |
| Remote template | Enforce the byte limit while streaming, cancel oversized/incomplete bodies, decode split UTF-8 characters, and apply a configurable request/body deadline. Cancellation settles callers even for uncooperative adapters. Older requests cannot overwrite newer cache entries. Parse malformed Aurelia expressions before inserting the view. |
| Schema form | Cleared optional number fields no longer fail validation; booleans are not coerced to numbers. Touched errors react to edits and cross-field dependencies. Add textarea, numeric range/step and text-length constraints. Copy and freeze renderer registrations per app container to prevent shared mutable built-ins. |
| Undo/redo | Clone or equality failures no longer move the history cursor, lose the redo branch, or discard an open transaction. Ignore keyboard shortcuts during IME composition. |
| State machine | Make `can()` and `matches()` reactive in Aurelia bindings. Snapshot transition definitions so later caller mutation cannot invalidate target checks. Reject asynchronous guards/reducers explicitly and observe their rejected promises. |
| Async task | Prevent an abort listener from starting reentrant work that blocks a restart. Keep cancellation guards intact through nested cancellation; copy per-task policy options. |
| Tree | Settle cancelled expansions and avoid starting already-cancelled loaders. Prevent lazy completion from stealing focus. Validate and flatten deep trees without recursion. Add single-click disclosure buttons, reveal selected ancestors, and clear removed selections. Preserve row identity and avoid rebuilding rows for ordinary selection. |
| Sortable | Recheck source identity, contents, keys and labels before committing. Preserve same-turn edits made inside a before-change callback. Cancel previews on Tab, avoid change events for no-op moves, normalize boolean attributes, and add optional touch-friendly Up/Down controls. |
| Autosave | `flush()` now reads current state before observation notifications, fixing a lost-edit path. Disposal resolves pending flushes immediately. Capture serialization errors, preserve pending edits when callbacks/options change, and support explicit initial saves. Use per-flush disposal settlement rather than retaining a growing chain of handlers. |
| Pan/zoom | Convert client coordinates to local CSS pixels under scaled ancestors; calculate pinch anchoring before clamping. Observe in-place transform edits, preserve editable-content interaction, and ignore extra pointers. Normalize boolean attributes and add client/world coordinate conversion helpers. |
| Split pane | Normalize boolean attributes, account for ancestor scaling, and rebase a drag when the container resizes. Preserve RTL behavior, cancellation, and rendered accessibility values. |

## Test weaknesses addressed

The previous autosave tests always ran Aurelia's queue before flushing, which concealed immediate-flush data loss. New tests deliberately omit that step. Remote-template tests previously used text-only mocks; they now exercise real readable streams, partial UTF-8 chunks, cancellation and byte limits. Reorder tests now mutate source arrays synchronously inside event handlers, without flushing observation first.

The review also adds component stop/start checks, rendered disabled/style assertions, focus movement during pending lazy loads, failing clone/equality callbacks, deep-tree input, mutable configuration, and isolation between application containers. The initial regression batch reproduced twelve defects before their fixes. Subsequent tests cover additional bugs and new behavior.

The ten packages increased from **83 to 124 tests** during this review: **41 additional tests**.

## Initial review verification results

- Root Jest suite: **65 suites, 404 tests passed**, with no skipped tests. The review baseline was 363 tests.
- Reviewed packages: **10 suites, 124 tests passed**.
- All 45 workspace packages build. All ten reviewed packages use strict TypeScript source builds.
- The production plugin-lab example type-checks and builds against the built package exports.
- All ten reviewed packages pass ESLint with **zero errors and zero warnings**. Each now has a `lint` script with `--max-warnings=0`.
- All ten pass dry-run package-content checks and Node ESM import checks. Tarballs contain JS, declarations, maps, README and source; tests and build caches are excluded.
- `git diff --check` passes. No commits or releases were made.

## Initial review coverage

Coverage is reported by Jest's configured transformer and is not a guarantee about every possible application integration.

| Package | Tests | Lines | Branches |
| --- | ---: | ---: | ---: |
| aurelia2-remote-template | 16 | 99.24% | 92.64% |
| aurelia2-schema-form | 12 | 96.29% | 92.72% |
| aurelia2-undo-redo | 7 | 97.18% | 82.81% |
| aurelia2-state-machine | 10 | 95.77% | 89.13% |
| aurelia2-async-task | 9 | 98.94% | 89.58% |
| aurelia2-tree | 16 | 99.01% | 90.9% |
| aurelia2-sortable | 13 | 92.3% | 83.33% |
| aurelia2-autosave | 17 | 93.98% | 82.85% |
| aurelia2-pan-zoom | 14 | 96.63% | 86.31% |
| aurelia2-split-pane | 10 | 96.11% | 83.33% |

Combined: **96.6% lines**, **87.41% branches**, 90.31% statements, and 71.63% functions.

## Initial review browser verification

The production example was exercised in WebKit through Playwright. Form errors cleared while typing; the actual `aria-invalid` attribute changed to false. The fetched HTML fragment reflected profile edits, and autosave completed. A disclosure click loaded tree children without selecting the parent. Touch-friendly reorder controls updated the list and announced its new position.

Publishing controls using `machine.can(...)` updated through review/edit/approval transitions. Async search completed, and canvas fitting updated its rendered CSS transform. The browser reported zero console errors and warnings.

The example uses simulated save/search/tree callbacks. Network failures, streamed responses, cancellation races and lifecycle behavior are tested separately; this is not a live backend integration test.

## Lint correction and remaining repository diagnostics

The previous root lint command left its glob unquoted. Shell expansion selected nested source paths and skipped top-level files, including the new plugin entrypoints. Its earlier result of zero errors and 19 warnings did **not** cover all source files.

The command now lets ESLint expand the recursive glob. It reports **36 errors and 126 warnings in older packages outside these ten**. They include empty-interface rules, legacy function typing/aliasing, unused declarations and style warnings. The ten reviewed packages are lint-clean; the full repository lint check is not. Those unrelated source files were not changed during this review.

The existing multi-project Jest warning about the auth package's coverage threshold remains. That warning does not indicate a skipped test; coverage thresholds must be configured at the multi-project root to enforce them there.

Dependency versions and previously recorded upstream advisories are documented in [dependency compatibility](dependency-compatibility.md). This review did not change dependency versions.

## Reproduce

```sh
npm ci
npm test -- --runInBand
npm run build
npm run lint --workspace aurelia2-autosave
npm ci --prefix examples/plugin-lab
npm run build --prefix examples/plugin-lab
```

Each reviewed package has the same `lint` script. To run their coverage together:

```sh
npm test -- --runInBand --coverage --selectProjects remote-template schema-form undo-redo state-machine async-task tree sortable autosave pan-zoom split-pane
```
