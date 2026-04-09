const path = require('path');
const { preprocess, preprocessOptions } = require('@aurelia/plugin-conventions');
const tsJest = require('ts-jest');

function getCreateTransformer() {
  if (typeof tsJest.createTransformer === 'function') {
    return tsJest.createTransformer;
  }

  if (typeof tsJest.default?.createTransformer === 'function') {
    return tsJest.default.createTransformer;
  }

  throw new Error('Unable to import createTransformer from "ts-jest"');
}

const tsTransformer = getCreateTransformer()();

function _createTransformer(
  conventionsOptions = {},
  preprocessFile = preprocess,
  tsProcess = tsTransformer.process.bind(tsTransformer),
  tsGetCacheKey = tsTransformer.getCacheKey.bind(tsTransformer)
) {
  const auOptions = preprocessOptions(conventionsOptions);

  return {
    canInstrument: false,
    getCacheKey(fileData, filePath, transformOptions) {
      const tsKey = tsGetCacheKey(fileData, filePath, transformOptions);
      return `${tsKey}:${JSON.stringify(auOptions)}`;
    },
    process(sourceText, sourcePath, transformOptions) {
      const result = preprocessFile(
        { path: sourcePath, contents: sourceText },
        auOptions
      );

      if (result !== undefined) {
        let newSourcePath = sourcePath;
        let newCode = result.code;

        if (auOptions.templateExtensions.includes(path.extname(sourcePath))) {
          newSourcePath += '.ts';
          newCode = `// @ts-nocheck\n${newCode}`;
        }

        return tsProcess(newCode, newSourcePath, transformOptions);
      }

      return tsProcess(sourceText, sourcePath, transformOptions);
    },
  };
}

function createTransformer(conventionsOptions = {}) {
  return _createTransformer(conventionsOptions);
}

const transformer = createTransformer();

module.exports = transformer;
module.exports.createTransformer = createTransformer;
module.exports._createTransformer = _createTransformer;
module.exports.default = module.exports;
