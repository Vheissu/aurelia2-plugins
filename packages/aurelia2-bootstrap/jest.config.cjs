const base = require('../../jest.config.cjs');

module.exports = {
  ...base,
  transform: {
    ...base.transform,
    "\\.(ts|js|html)$": ["@aurelia/ts-jest", { defaultShadowOptions: null }],
  },
  setupFiles: ["../../test/jest.setup.ts"],
};
