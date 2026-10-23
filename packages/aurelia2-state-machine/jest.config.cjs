const base = require('../../jest.config.cjs');
module.exports = { ...base, displayName: 'state-machine', setupFiles: ['../../test/jest.setup.ts'], collectCoverageFrom: ['<rootDir>/src/**/*.ts'] };
