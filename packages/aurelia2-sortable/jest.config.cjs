const base = require('../../jest.config.cjs');
module.exports = { ...base, displayName: 'sortable', setupFiles: ['../../test/jest.setup.ts'], collectCoverageFrom: ['<rootDir>/src/**/*.ts'] };
