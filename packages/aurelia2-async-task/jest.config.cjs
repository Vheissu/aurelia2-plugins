const base = require('../../jest.config.cjs');
module.exports = { ...base, displayName: 'async-task', setupFiles: ['../../test/jest.setup.ts'], collectCoverageFrom: ['<rootDir>/src/**/*.ts'] };
