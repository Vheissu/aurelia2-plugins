const base = require('../../jest.config.cjs');
module.exports = { ...base, displayName: 'mentions', setupFiles: ['../../test/jest.setup.ts'], collectCoverageFrom: ['<rootDir>/src/**/*.ts'] };
