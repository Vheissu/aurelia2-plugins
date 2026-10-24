const base = require('../../jest.config.cjs');
module.exports = { ...base, displayName: 'url-state', setupFiles: ['../../test/jest.setup.ts'], collectCoverageFrom: ['<rootDir>/src/**/*.ts'] };
