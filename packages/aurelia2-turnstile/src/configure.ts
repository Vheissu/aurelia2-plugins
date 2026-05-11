import { DI } from '@aurelia/kernel';

export interface TurnstileConfigOptions {
    sitekey?: string;
    theme?: 'light' | 'dark' | 'auto';
    scriptUrl?: string;
}

export interface ITurnstileConfiguration extends Configure {}
export const ITurnstileConfiguration = DI.createInterface<ITurnstileConfiguration>(
    'ITurnstileConfiguration',
    x => x.singleton(Configure)
);

export class Configure {
    protected _config: TurnstileConfigOptions;

    constructor() {
        this._config = {
            sitekey: '',
            theme: 'auto',
            scriptUrl: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
        };
    }

    getOptions(): TurnstileConfigOptions {
        return this._config;
    }

    options(obj: TurnstileConfigOptions = {}) {
        Object.assign(this._config, obj);
    }

    get(key: keyof TurnstileConfigOptions) {
        return this._config[key];
    }

    set(key: keyof TurnstileConfigOptions, val: any) {
        this._config[key] = val;
        return this._config[key];
    }
}
