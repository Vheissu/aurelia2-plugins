# Shared state and editing plugin verification

Verified on 24 October 2026 against Aurelia 2.0.0-rc.2 and the local Aurelia core source.

Five packages were added: filter-builder, merge, mentions, transfer-list, and url-state. Each has a strict TypeScript build, public declarations, a README, and tests. The workspace lab imports their built package exports and demonstrates them together.

## Results

- Complete repository suite: **76 suites, 584 tests passed**, zero skipped tests, across 50 package projects.
- Five new packages: **11 suites, 156 tests passed**.
- All **50 workspace packages** build. Both plugin-lab and workspace-lab production examples type-check and build.
- All five new packages pass source ESLint with **zero errors and zero warnings**.
- All five pass dry-run tarball checks: JavaScript, declarations and README are included; tests and build caches are excluded. Their main exports and the optional URL-state router export import successfully in Node.
- Production workspace-lab passes WebKit interaction checks through Playwright, with zero uncaught page errors.

Coverage comes from the configured Jest transformer. It describes exercised source, not a guarantee about every integration.

| Package | Tests | Lines | Branches |
| --- | ---: | ---: | ---: |
| aurelia2-filter-builder | 32 | 96.23% | 84.14% |
| aurelia2-merge | 23 | 94.23% | 91.26% |
| aurelia2-mentions | 40 | 96.77% | 86.65% |
| aurelia2-transfer-list | 23 | 88.23% | 69.61% |
| aurelia2-url-state | 38 | 94.91% | 88.26% |

## Review and regression coverage

Filter-builder tests cover bounded parsing and copying, typed operators, sparse-array rejection, prototype keys, limits, missing fields, invalid drafts, immutable edits, cancellation and stale proposals. Custom editors retain their DOM element and focus across edits. Saved field, operator and enum values are checked against the actual select controls. Existing filters remain editable when configured condition/depth limits are lowered.

Merge tests cover independent edits, deletions, missing/undefined/null distinctions, atomic arrays, frozen snapshots, input limits, custom resolutions, and bounded text comparisons. Component tests verify vetoes, reentrant apply protection, input replacement, retained choices on rebind/relabel, session-driven radio state, error recovery and fresh row identity for new sessions. Conflict rendering is paginated, and line comparisons are calculated only when requested.

Mentions tests cover trigger boundaries, async cancellation and stale results, IME composition, keyboard selection, caret placement, custom row projection, and entity range rebasing after edits. Insertion respects maxlength, disabled and readonly fields, including changes made during before-insert handlers. The package documents plain-text scope and native undo limitations.

Transfer-list tests cover immutable operations, limits, disabled and unavailable items, filtering, range selection, keyboard transfer/reordering, typeahead, event vetoes, stale and recursive operations, projected rows, in-place observation and stop/start. Pure helpers reject malformed key arrays and invalid offsets.

URL-state tests cover codecs, defaults, malformed values, bounded custom data, repeated keys, list mutation, key ownership, debouncing, history policies and failed writes. Real router fixtures verify nested/sibling route preservation, query availability during activation, reused route updates, cancelled pending writes, Back/Forward, simultaneous shell/route ownership, and reconnecting after disposal.

The design and implementation were developed with the local Claude CLI. Its independent filter/merge review found 14 issues, which were fixed with permanent regressions. Claude also checked those regressions against individual reversions in temporary copies. Codex ran the repository checks and final browser workflows separately.

## Browser workflows

The production example was exercised in WebKit:

1. Search for a customer, create a page history entry, go Back and Forward, and reload. The controls follow the URL.
2. Build a customer filter, reload its URL, and check both matching rows and the selected operator. An incomplete numeric draft remains editable; valid numeric and enum filters survive reload with the correct selections.
3. Assign Ben as a reviewer, then reorder him with Alt+Up. The assigned key array and displayed list agree.
4. Resolve a title conflict using the server value. The independent server priority change is retained.
5. Insert Ana through async mention suggestions. The text becomes `Hello @Ana Smith ` and the tracked mention covers offsets 6–16. Replacing that text removes the entity.

The example keeps unfinished filters separate from the last valid URL value, so a temporary blank number does not reset the editor. It uses simulated customer data, mention search, and conflict responses; it does not test a live backend.

## Existing repository diagnostics

The earlier repository-wide lint baseline remains **36 errors and 126 warnings in older packages**. The new packages are lint-clean; this work does not claim a clean whole-repository lint run. The existing Jest warning about a package-level coverage threshold also remains.

The local Node 25 runtime produces engine warnings for dependencies supporting Node 22.22.2, 24.15.0, or 26+. Builds and tests passed in this environment; use a supported Node release for development and CI. No npm publication was performed.

## Reproduce

```sh
npm ci
npm test -- --runInBand
npm run build
npm test -- --runInBand --coverage --selectProjects filter-builder merge mentions transfer-list url-state
npm run lint --workspace=packages/aurelia2-filter-builder --workspace=packages/aurelia2-merge --workspace=packages/aurelia2-mentions --workspace=packages/aurelia2-transfer-list --workspace=packages/aurelia2-url-state
npm ci --prefix examples/workspace-lab
npm run build --prefix examples/workspace-lab
npm run start --prefix examples/workspace-lab
```
