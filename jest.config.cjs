const path = require('path');

const config = {
    watchman: false,
    testEnvironment: "jsdom",
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    testPathIgnorePatterns: [
        "/node_modules/",
        "/examples/",
    ],
    transform: {
        "\\.(css|less|sass|scss|styl|jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": "jest-transform-stub",
        "\\.(ts|js|html)$": path.resolve(__dirname, "test/aurelia-ts-jest.cjs")
    },
    setupFiles: [
        "./test/jest.setup.ts"
    ],
};

module.exports = config;
