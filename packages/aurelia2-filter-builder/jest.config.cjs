const base = require('../../jest.config.cjs');
module.exports = { ...base, displayName: 'filter-builder', setupFiles: ['../../test/jest.setup.ts'], collectCoverageFrom: ['<rootDir>/src/**/*.ts'] };
