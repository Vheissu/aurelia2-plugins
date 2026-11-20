import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

// Use the same npm that launched the script, including on Windows.
const output = execFileSync(process.execPath, [
  process.env.npm_execpath, 'pack', '--workspaces', '--dry-run', '--json', '--ignore-scripts',
], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const packages = new Map(JSON.parse(output).map(pkg => [pkg.name, pkg.files.map(file => file.path)]));

function targets(value) {
  if (typeof value === 'string') return [value];
  return Object.values(value ?? {}).flatMap(targets);
}

for (const entry of readdirSync('packages', { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifest = JSON.parse(readFileSync(`packages/${entry.name}/package.json`, 'utf8'));
  const files = new Set(packages.get(manifest.name));
  for (const target of targets([manifest.main, manifest.types, manifest.exports, manifest.bin, 'README.md'])) {
    if (!files.has(target.replace(/^\.\//, ''))) {
      throw new Error(`${manifest.name} is missing ${target} from its tarball. Run npm run build first.`);
    }
  }
  for (const file of files) {
    if (/^(test\/|jest\.config\.)|\.tsbuildinfo$/.test(file)) {
      throw new Error(`${manifest.name} includes a development file: ${file}`);
    }
  }
}
console.log(`Verified the contents of ${packages.size} plugin tarballs.`);
