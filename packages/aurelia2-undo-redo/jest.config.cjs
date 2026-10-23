const base = require('../../jest.config.cjs');
module.exports = { ...base, displayName: 'undo-redo', setupFiles: ['../../test/jest.setup.ts'], collectCoverageFrom: ['<rootDir>/src/**/*.ts'] };
