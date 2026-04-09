const path = require('path');
const base = require('../../jest.config.cjs');

module.exports = {
  ...base,
  transform: {
    ...base.transform,
    "\\.(ts|js|html)$": [path.resolve(__dirname, '../../test/aurelia-ts-jest.cjs'), { defaultShadowOptions: null }],
  },
  setupFiles: ["../../test/jest.setup.ts"],
};
