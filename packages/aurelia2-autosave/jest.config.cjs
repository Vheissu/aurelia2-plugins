const base = require('../../jest.config.cjs');
module.exports = { ...base, displayName: 'autosave', setupFiles: ['../../test/jest.setup.ts'], collectCoverageFrom: ['<rootDir>/src/**/*.ts'] };
