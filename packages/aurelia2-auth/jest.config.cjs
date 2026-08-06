const baseConfig = require('../../jest.config.cjs');

module.exports = {
    ...baseConfig,
    testEnvironment: "<rootDir>/test/environment.cjs",
    collectCoverageFrom: ["<rootDir>/src/**/*.ts"],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 65,
            lines: 89,
            statements: 85
        }
    },
    setupFiles: [
        "../../test/jest.setup.ts"
    ],
};
