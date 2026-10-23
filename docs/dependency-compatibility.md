# Dependency compatibility

Registry versions were checked on 23 October 2026. Development dependencies in the root, plugin packages, and examples were refreshed, and their npm lockfiles were regenerated and installed without force or legacy peer resolution.

| Dependency | Previous | Current |
| --- | --- | --- |
| TypeScript ESLint packages | 8.70.1 | 8.72.0 |
| ESLint | 10.11.0 | 10.13.0 |
| eslint-plugin-jsdoc | 64.5.4 | 65.4.2 |
| ts-jest | 29.4.14 | 29.4.15 |
| Vite in examples | 8.3.1 | 8.3.5 |
| Vitest in examples | 5.0.2 | 5.0.5 |
| jsdom in examples | 30.1.1 | 30.1.3 |
| Stylelint | 17.15.0 | 17.16.0 |
| globals | 17.12.0 | 17.13.0 |
| @types/node | 26.6.3 | 26.6.5 |
| @types/google.maps | 3.65.4 | 3.66.7 |
| Chart.js | 4.5.1 | 4.6.1 |
| Froala | 5.3.1 | 5.5.0 |
| Google Maps API loader | 2.1.1 | 2.1.3 |

Aurelia remains on `2.0.0-rc.2`, the current npm release. The new packages import from `aurelia` and publish ESM, declarations, source maps, and sources. Their source builds enable strict TypeScript checks.

## TypeScript 7 is not compatible with the current toolchain

The current TypeScript npm release is 7.0.2. `@typescript-eslint/parser@8.72.0` requires TypeScript `>=4.8.4 <6.1.0`; `ts-jest@29.4.15` requires `>=4.3 <7`. Installing TypeScript 7 therefore fails peer resolution. TypeScript is pinned to `~6.0.3` in the root and examples until both tools support 7. This exception is deliberate; no peer checks were disabled.

The eslint-plugin-jsdoc 65 change tightens `check-indentation`. That rule is not enabled by this repository's ESLint configuration, so the upgrade requires no source migration. See its [release notes](https://github.com/gajus/eslint-plugin-jsdoc/releases/tag/v65.0.0).

## Runtime and example dependencies

SSR now declares jsdom and Vite as development dependencies instead of relying on optional peers or packages installed elsewhere in the monorepo. Its public optional peer ranges are unchanged. Jest retains its own compatible jsdom version.

The three existing examples no longer depend on `vite-plugin-node-polyfills`. The calendar and aurafall examples did not use it; the table example built and tested without it. Removing it also removes the unused browser cryptography dependency chain.

`velocity-animate` remains at 2.0.6. Its npm `latest` tag points backwards to 1.5.2; changing to that tag would be a downgrade, not an update.

## Audit status

The root workspace and the new plugin lab report zero vulnerabilities. Each of the three existing examples reports seven high-severity dependency entries from the same unpatched `braces` issue through the latest Stylelint dependency chain. The entries include the affected package and its parent dependencies; they are not seven distinct advisories.

At verification time `braces@3.0.3` was still the latest release. npm suggests downgrading Stylelint to 7.7.0, which is incompatible with the current configuration and has not been applied. The issue affects development-time glob processing. See [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

Recheck with `npm audit` at the root and `npm audit --prefix examples/aurelia2-calendar` (or the other example directories) when upstream releases a fix.
