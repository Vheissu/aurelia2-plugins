const baseConfig = require('../../jest.config.cjs');

module.exports = {
    ...baseConfig,
    testEnvironment: "<rootDir>/test/environment.cjs",
    setupFiles: [
        "../../test/jest.setup.ts"
    ],
};
