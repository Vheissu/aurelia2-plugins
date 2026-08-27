import { BrowserPlatform } from '@aurelia/platform-browser';
import { setPlatform } from '@aurelia/testing';

declare const require: (moduleName: 'crypto') => { webcrypto: Crypto };

function bootstrapTestEnvironment() {
    if (!globalThis.crypto?.subtle) {
        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: require('crypto').webcrypto,
        });
    }

    const platform = new BrowserPlatform(window);
    setPlatform(platform);
    BrowserPlatform.set(globalThis, platform);
}

bootstrapTestEnvironment();