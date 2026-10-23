const base = require('../../jest.config.cjs');
module.exports = { ...base, displayName: 'schema-form', setupFiles: ['../../test/jest.setup.ts'], collectCoverageFrom: ['<rootDir>/src/**/*.ts'] };
