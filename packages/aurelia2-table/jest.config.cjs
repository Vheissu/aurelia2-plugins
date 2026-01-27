const baseConfig = require('../../jest.config.cjs');

module.exports = {
    ...baseConfig,
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1"
    },
    setupFiles: [
        "../../test/jest.setup.ts"
    ],
};
