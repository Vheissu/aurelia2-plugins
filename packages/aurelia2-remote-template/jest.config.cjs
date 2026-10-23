const base = require('../../jest.config.cjs');
module.exports = { ...base, displayName: 'remote-template', setupFiles: ['../../test/jest.setup.ts'], collectCoverageFrom: ['<rootDir>/src/**/*.ts'] };
