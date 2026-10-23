const base = require('../../jest.config.cjs');
module.exports = { ...base, displayName: 'split-pane', setupFiles: ['../../test/jest.setup.ts'], collectCoverageFrom: ['<rootDir>/src/**/*.ts'] };
