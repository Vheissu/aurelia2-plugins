const fs = require('fs');
const path = require('path');

const packagesDir = path.resolve(__dirname, 'packages');

const projects = fs.readdirSync(packagesDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => {
    const rootDir = path.join(packagesDir, entry.name);
    const config = require(path.join(rootDir, 'jest.config.cjs'));
    // Jest only accepts these options at the top level of a run.
    const { coverageThreshold, watchman, ...project } = config;
    return { rootDir, displayName: entry.name.replace(/^aurelia2-/, ''), ...project };
  });

module.exports = {
  watchman: false,
  projects,
};
