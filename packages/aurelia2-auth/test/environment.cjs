const { TestEnvironment: JSDOMEnvironment } = require('jest-environment-jsdom');

const nativeGlobals = {
  fetch: globalThis.fetch,
  Headers: globalThis.Headers,
  Request: globalThis.Request,
  Response: globalThis.Response,
  FormData: globalThis.FormData,
  TextDecoder: globalThis.TextDecoder,
  TextEncoder: globalThis.TextEncoder,
  crypto: globalThis.crypto,
  ReadableStream: globalThis.ReadableStream,
  TransformStream: globalThis.TransformStream,
  WritableStream: globalThis.WritableStream,
};

module.exports = class AuthTestEnvironment extends JSDOMEnvironment {
  async setup() {
    await super.setup();
    for (const [key, value] of Object.entries(nativeGlobals)) {
      if (value !== undefined) {
        Object.defineProperty(this.global, key, {
          value,
          configurable: true,
          writable: true,
        });
      }
    }
  }
};
