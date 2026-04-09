const fs = require('fs');
const path = require('path');

const packagesDir = path.resolve(__dirname, 'packages');

const projects = fs.readdirSync(packagesDir)
  .map((entry) => path.join(packagesDir, entry, 'jest.config.cjs'))
  .filter((configPath) => fs.existsSync(configPath));

module.exports = {
  watchman: false,
  projects,
};
