#!/usr/bin/env node

/**
 * Aurelia2 Plugins Release Script
 *
 * A lightweight release automation tool for the monorepo.
 * Uses conventional commits to determine version bumps and generates changelogs.
 *
 * Usage:
 *   npm run release              - Release all changed packages
 *   npm run release:dry-run      - Preview releases without changes
 *   npm run release -- --package aurelia2-auth  - Release specific package
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const PACKAGES_DIR = join(ROOT_DIR, 'packages');

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates readline interface for user input
 */
function createPrompt() {
    return createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

/**
 * Asks user for confirmation
 * @param {string} question
 * @returns {Promise<boolean>}
 */
async function confirm(question) {
    const rl = createPrompt();
    return new Promise(resolve => {
        rl.question(`${question} (y/N) `, answer => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
}

/**
 * Executes a command and returns the output
 * @param {string} cmd
 * @param {object} options
 * @returns {string}
 */
function exec(cmd, options = {}) {
    return execSync(cmd, {
        encoding: 'utf-8',
        cwd: ROOT_DIR,
        ...options
    }).trim();
}

/**
 * Logs with color
 */
const log = {
    info: (msg) => console.log(`\x1b[36m${msg}\x1b[0m`),
    success: (msg) => console.log(`\x1b[32m${msg}\x1b[0m`),
    warn: (msg) => console.log(`\x1b[33m${msg}\x1b[0m`),
    error: (msg) => console.log(`\x1b[31m${msg}\x1b[0m`),
    dim: (msg) => console.log(`\x1b[90m${msg}\x1b[0m`),
};

// ============================================================================
// Package Discovery
// ============================================================================

/**
 * Discovers all packages in the monorepo
 * @returns {Array<{dirName: string, path: string, version: string, npmName: string}>}
 */
function discoverPackages() {
    const packageDirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    return packageDirs.map(dir => {
        const pkgPath = join(PACKAGES_DIR, dir);
        const pkgJsonPath = join(pkgPath, 'package.json');
        const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));

        return {
            dirName: dir,
            path: pkgPath,
            version: pkgJson.version,
            npmName: pkgJson.name,
        };
    });
}

// ============================================================================
// Git Operations
// ============================================================================

/**
 * Validates git state before release
 */
function validateGitState() {
    // Check for uncommitted changes
    const status = exec('git status --porcelain');
    if (status) {
        log.error('Error: Working directory has uncommitted changes.');
        log.dim('Please commit or stash changes before releasing.');
        process.exit(1);
    }

    // Check current branch
    const branch = exec('git branch --show-current');
    if (branch !== 'main' && branch !== 'master') {
        log.warn(`Warning: You are on branch '${branch}', not 'main'.`);
    }
}

/**
 * Gets the first commit in the repo
 * @returns {string}
 */
function getFirstCommit() {
    return exec('git rev-list --max-parents=0 HEAD');
}

/**
 * Gets the last release tag for a package
 * @param {string} npmName
 * @returns {string|null}
 */
function getLastReleaseTag(npmName) {
    try {
        const tags = exec(`git tag --list "${npmName}@*" --sort=-v:refname`)
            .split('\n')
            .filter(Boolean);
        return tags[0] || null;
    } catch {
        return null;
    }
}

/**
 * Creates a release tag
 * @param {string} npmName
 * @param {string} version
 * @returns {string}
 */
function createReleaseTag(npmName, version) {
    const tag = `${npmName}@${version}`;
    exec(`git tag -a "${tag}" -m "Release ${tag}"`);
    return tag;
}

// ============================================================================
// Change Detection
// ============================================================================

/**
 * Gets commits for a package since a reference point
 * @param {string} packagePath - Relative path to the package
 * @param {string} sinceRef - Git reference (tag or commit)
 * @returns {Array}
 */
function getCommitsSince(packagePath, sinceRef) {
    try {
        const format = '%H|||%s|||%b%%%';
        const logOutput = exec(
            `git log ${sinceRef}..HEAD --format="${format}" -- "${packagePath}"`,
            { maxBuffer: 10 * 1024 * 1024 }
        );

        if (!logOutput) return [];

        return logOutput
            .split('%%%')
            .filter(Boolean)
            .map(raw => {
                const [hash, subject, body] = raw.split('|||').map(s => s?.trim() || '');
                return parseConventionalCommit(hash, subject, body);
            })
            .filter(c => c.hash); // Filter out empty entries
    } catch {
        return [];
    }
}

/**
 * Parses a conventional commit message
 * @param {string} hash
 * @param {string} subject
 * @param {string} body
 * @returns {object}
 */
function parseConventionalCommit(hash, subject, body) {
    // Match: type(scope)!: description or type!: description or type: description
    const conventionalRegex = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
    const match = subject.match(conventionalRegex);

    if (match) {
        const [, type, scope, breaking, description] = match;
        return {
            hash,
            subject,
            body,
            type,
            scope: scope || null,
            description,
            breaking: !!breaking || (body && body.includes('BREAKING CHANGE'))
        };
    }

    // Non-conventional commit
    return {
        hash,
        subject,
        body,
        type: 'other',
        scope: null,
        description: subject,
        breaking: false
    };
}

/**
 * Detects changes for a package since its last release
 * @param {object} pkg
 * @returns {object}
 */
function detectPackageChanges(pkg) {
    const lastTag = getLastReleaseTag(pkg.npmName);
    const packageRelativePath = `packages/${pkg.dirName}`;
    const sinceRef = lastTag || getFirstCommit();

    const commits = getCommitsSince(packageRelativePath, sinceRef);

    return {
        hasChanges: commits.length > 0,
        commits,
        sinceRef,
        isFirstRelease: !lastTag
    };
}

// ============================================================================
// Version Bumping
// ============================================================================

/**
 * Determines version bump type from commits
 * @param {Array} commits
 * @returns {'major'|'minor'|'patch'}
 */
function determineVersionBump(commits) {
    if (commits.length === 0) return 'patch';

    let bump = 'patch';

    for (const commit of commits) {
        if (commit.breaking) {
            return 'major';
        }
        if (commit.type === 'feat') {
            bump = 'minor';
        }
    }

    return bump;
}

/**
 * Bumps a semver version
 * @param {string} version
 * @param {'major'|'minor'|'patch'} type
 * @returns {string}
 */
function bumpVersion(version, type) {
    const [major, minor, patch] = version.split('.').map(Number);

    switch (type) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
        default:
            return version;
    }
}

// ============================================================================
// Changelog Generation
// ============================================================================

/**
 * Generates changelog entry for a release
 * @param {Array} commits
 * @param {string} version
 * @param {string} npmName
 * @returns {string}
 */
function generateChangelogEntry(commits, version, npmName) {
    const date = new Date().toISOString().split('T')[0];
    const lines = [
        `## [${version}](https://github.com/Vheissu/aurelia2-plugins/releases/tag/${npmName}@${version}) (${date})`,
        ''
    ];

    // Group commits by type
    const groups = {
        breaking: [],
        feat: [],
        fix: [],
        perf: [],
        refactor: [],
        other: []
    };

    for (const commit of commits) {
        if (commit.breaking) {
            groups.breaking.push(commit);
        } else if (groups[commit.type]) {
            groups[commit.type].push(commit);
        } else if (!['chore', 'docs', 'style', 'test', 'ci', 'build'].includes(commit.type)) {
            groups.other.push(commit);
        }
    }

    if (groups.breaking.length > 0) {
        lines.push('### BREAKING CHANGES', '');
        for (const c of groups.breaking) {
            lines.push(`* ${c.description} (${c.hash.slice(0, 7)})`);
        }
        lines.push('');
    }

    if (groups.feat.length > 0) {
        lines.push('### Features', '');
        for (const c of groups.feat) {
            lines.push(`* ${c.description} (${c.hash.slice(0, 7)})`);
        }
        lines.push('');
    }

    if (groups.fix.length > 0) {
        lines.push('### Bug Fixes', '');
        for (const c of groups.fix) {
            lines.push(`* ${c.description} (${c.hash.slice(0, 7)})`);
        }
        lines.push('');
    }

    if (groups.perf.length > 0) {
        lines.push('### Performance Improvements', '');
        for (const c of groups.perf) {
            lines.push(`* ${c.description} (${c.hash.slice(0, 7)})`);
        }
        lines.push('');
    }

    if (groups.refactor.length > 0) {
        lines.push('### Code Refactoring', '');
        for (const c of groups.refactor) {
            lines.push(`* ${c.description} (${c.hash.slice(0, 7)})`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Updates or creates CHANGELOG.md for a package
 * @param {string} packagePath
 * @param {string} entry
 */
function updateChangelog(packagePath, entry) {
    const changelogPath = join(packagePath, 'CHANGELOG.md');
    const header = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';

    let content = '';
    if (existsSync(changelogPath)) {
        content = readFileSync(changelogPath, 'utf-8');
        // Find the first version heading and insert before it
        const firstVersionIndex = content.indexOf('\n## ');
        if (firstVersionIndex > 0) {
            content = content.slice(0, firstVersionIndex + 1) + entry + content.slice(firstVersionIndex + 1);
        } else {
            content = header + entry;
        }
    } else {
        content = header + entry;
    }

    writeFileSync(changelogPath, content, 'utf-8');
}

// ============================================================================
// Release Execution
// ============================================================================

/**
 * Updates package.json version
 * @param {string} packagePath
 * @param {string} newVersion
 */
function updatePackageVersion(packagePath, newVersion) {
    const pkgJsonPath = join(packagePath, 'package.json');
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    pkgJson.version = newVersion;
    writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4) + '\n', 'utf-8');
}

/**
 * Builds a package
 * @param {string} dirName
 */
function buildPackage(dirName) {
    log.dim(`  Building ${dirName}...`);
    execSync(`npm run build --workspace=packages/${dirName}`, {
        cwd: ROOT_DIR,
        stdio: 'inherit'
    });
}

/**
 * Publishes a package to npm
 * @param {string} dirName
 */
function publishPackage(dirName) {
    log.dim(`  Publishing to npm...`);
    execSync(`npm publish --workspace=packages/${dirName} --access public`, {
        cwd: ROOT_DIR,
        stdio: 'inherit'
    });
}

/**
 * Executes the release for a single package
 * @param {object} release
 */
async function executeRelease(release) {
    console.log('');
    log.info(`Releasing ${release.npmName}@${release.newVersion}...`);

    // 1. Update version in package.json
    updatePackageVersion(release.path, release.newVersion);
    log.dim('  Updated package.json');

    // 2. Generate/update changelog
    const changelogEntry = generateChangelogEntry(
        release.commits,
        release.newVersion,
        release.npmName
    );
    updateChangelog(release.path, changelogEntry);
    log.dim('  Updated CHANGELOG.md');

    // 3. Build the package
    buildPackage(release.dirName);

    // 4. Commit changes
    exec(`git add packages/${release.dirName}/package.json packages/${release.dirName}/CHANGELOG.md`);
    exec(`git commit -m "chore(${release.dirName}): release ${release.newVersion}"`);
    log.dim('  Committed changes');

    // 5. Create git tag
    const tag = createReleaseTag(release.npmName, release.newVersion);
    log.dim(`  Created tag: ${tag}`);

    // 6. Publish to npm
    publishPackage(release.dirName);

    log.success(`  Published ${release.npmName}@${release.newVersion}`);
}

// ============================================================================
// Display Functions
// ============================================================================

/**
 * Displays release summary
 * @param {Array} releases
 * @param {boolean} dryRun
 */
function displayReleaseSummary(releases, dryRun) {
    console.log('');
    console.log('═'.repeat(60));
    console.log(dryRun ? '  DRY RUN - Release Preview' : '  Release Summary');
    console.log('═'.repeat(60));
    console.log('');

    for (const rel of releases) {
        const bumpLabel = {
            major: '\x1b[31mMAJOR\x1b[0m',
            minor: '\x1b[33mminor\x1b[0m',
            patch: '\x1b[32mpatch\x1b[0m'
        }[rel.bumpType];

        console.log(`  ${rel.npmName}`);
        console.log(`    ${rel.currentVersion} → ${rel.newVersion} (${bumpLabel})`);

        if (rel.commits.length > 0) {
            const featCount = rel.commits.filter(c => c.type === 'feat').length;
            const fixCount = rel.commits.filter(c => c.type === 'fix').length;
            const breakingCount = rel.commits.filter(c => c.breaking).length;
            const otherCount = rel.commits.length - featCount - fixCount;

            const parts = [];
            if (breakingCount) parts.push(`${breakingCount} breaking`);
            if (featCount) parts.push(`${featCount} feature${featCount > 1 ? 's' : ''}`);
            if (fixCount) parts.push(`${fixCount} fix${fixCount > 1 ? 'es' : ''}`);
            if (otherCount) parts.push(`${otherCount} other`);

            console.log(`    ${rel.commits.length} commits: ${parts.join(', ')}`);
        }

        if (rel.isFirstRelease) {
            console.log('    \x1b[36m(first release)\x1b[0m');
        }

        console.log('');
    }
}

function printHelp() {
    console.log(`
\x1b[1mAurelia2 Plugins Release Script\x1b[0m

\x1b[4mUsage:\x1b[0m
  npm run release                      Release all changed packages
  npm run release:dry-run              Preview releases without changes
  npm run release -- --package NAME    Release specific package
  npm run release -- --minor           Force minor bump for all packages

\x1b[4mOptions:\x1b[0m
  --dry-run          Show what would be released without making changes
  --package NAME     Release only the specified package (use dir name or npm name)
  --major            Force major version bump (overrides auto-detection)
  --minor            Force minor version bump (overrides auto-detection)
  --patch            Force patch version bump (overrides auto-detection)
  --skip-validation  Skip git state validation (use with caution)
  --help, -h         Show this help message

\x1b[4mVersion bump rules (Conventional Commits - used when no manual bump specified):\x1b[0m
  feat:              Minor version bump (0.0.x → 0.1.0)
  fix:               Patch version bump (0.0.x → 0.0.x+1)
  BREAKING CHANGE:   Major version bump (0.x.x → 1.0.0)
  feat!: / fix!:     Major version bump (! suffix)

\x1b[4mExamples:\x1b[0m
  npm run release                              # Auto-detect from commits
  npm run release:dry-run                      # Preview only
  npm run release -- --minor                   # Force minor bump
  npm run release -- --package aurelia2-auth   # Single package
  npm run release -- --package aurelia2-auth --major  # Single package, major bump
`);
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Parses command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const packageIndex = args.indexOf('--package');

    // Determine manual bump type
    let bumpType = null;
    if (args.includes('--major')) bumpType = 'major';
    else if (args.includes('--minor')) bumpType = 'minor';
    else if (args.includes('--patch')) bumpType = 'patch';

    return {
        dryRun: args.includes('--dry-run'),
        package: packageIndex !== -1 ? args[packageIndex + 1] : null,
        skipValidation: args.includes('--skip-validation'),
        help: args.includes('--help') || args.includes('-h'),
        bumpType
    };
}

async function main() {
    const args = parseArgs();

    if (args.help) {
        printHelp();
        process.exit(0);
    }

    log.info('Aurelia2 Plugins Release Script\n');

    // Validate git state
    if (!args.skipValidation && !args.dryRun) {
        validateGitState();
    }

    log.dim('Discovering packages...');
    const packages = discoverPackages();
    log.dim(`Found ${packages.length} packages\n`);

    // Filter to specific package if requested
    let targetPackages = packages;
    if (args.package) {
        targetPackages = packages.filter(
            p => p.dirName === args.package || p.npmName === args.package
        );
        if (targetPackages.length === 0) {
            log.error(`Package not found: ${args.package}`);
            log.dim('Available packages:');
            for (const p of packages) {
                log.dim(`  - ${p.dirName} (${p.npmName})`);
            }
            process.exit(1);
        }
    }

    // Analyze changes for each package
    log.dim('Analyzing changes...\n');
    const releases = [];

    for (const pkg of targetPackages) {
        const changes = detectPackageChanges(pkg);

        if (changes.hasChanges || args.bumpType) {
            // Use manual bump type if specified, otherwise auto-detect from commits
            const bumpType = args.bumpType || determineVersionBump(changes.commits);
            const newVersion = bumpVersion(pkg.version, bumpType);

            releases.push({
                ...pkg,
                commits: changes.commits,
                currentVersion: pkg.version,
                newVersion,
                bumpType,
                isFirstRelease: changes.isFirstRelease,
                manualBump: !!args.bumpType
            });
        }
    }

    if (releases.length === 0) {
        log.success('No packages have changes to release.');
        process.exit(0);
    }

    // Show summary
    displayReleaseSummary(releases, args.dryRun);

    if (args.dryRun) {
        log.info('Dry run complete. No changes made.');
        process.exit(0);
    }

    // Confirm release
    const proceed = await confirm('Proceed with release?');
    if (!proceed) {
        log.warn('Release cancelled.');
        process.exit(0);
    }

    // Execute releases
    for (const release of releases) {
        try {
            await executeRelease(release);
        } catch (error) {
            log.error(`\nFailed to release ${release.npmName}: ${error.message}`);
            log.error('Release process stopped. Manual intervention may be required.');
            log.dim('You may need to revert uncommitted changes and remove any created tags.');
            process.exit(1);
        }
    }

    // Push to remote
    console.log('');
    const shouldPush = await confirm('Push commits and tags to remote?');

    if (shouldPush) {
        log.dim('Pushing to remote...');
        execSync('git push && git push --tags', { cwd: ROOT_DIR, stdio: 'inherit' });
        log.success('Pushed to remote.');
    }

    console.log('');
    log.success('Release complete!');
}

main().catch(error => {
    log.error(`Release failed: ${error.message}`);
    process.exit(1);
});
