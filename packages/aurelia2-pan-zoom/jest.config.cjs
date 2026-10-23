const base = require('../../jest.config.cjs');
module.exports = { ...base, displayName: 'pan-zoom', setupFiles: ['../../test/jest.setup.ts'], collectCoverageFrom: ['<rootDir>/src/**/*.ts'] };
