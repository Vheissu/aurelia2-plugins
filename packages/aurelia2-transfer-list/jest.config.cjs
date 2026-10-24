const base = require('../../jest.config.cjs');
module.exports = { ...base, displayName: 'transfer-list', setupFiles: ['../../test/jest.setup.ts'], collectCoverageFrom: ['<rootDir>/src/**/*.ts'] };
