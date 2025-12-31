const baseConfig = require('../../jest.config.cjs');

module.exports = {
    ...baseConfig,
    setupFiles: [
        "../../test/jest.setup.ts"
    ],
};
