import { bindable, customElement, ICustomElementViewModel, INode } from '@aurelia/runtime-html';
import { inject } from '@aurelia/kernel';
import { ITurnstileConfiguration } from './configure';

@customElement({
    name: 'turnstile',
    template: '<template><div ref="container"></div></template>',
})
@inject(INode, ITurnstileConfiguration)
export class TurnstileCustomElement implements ICustomElementViewModel {
    @bindable public sitekey: string = '';
    @bindable public callback: ((token: string) => void) | undefined;
    @bindable public theme: string = '';
    @bindable public scriptUrl: string = '';

    private container!: HTMLElement;
    private widgetId: string | undefined;
    private scriptLoaded = false;

    constructor(
        private readonly element: HTMLElement,
        private readonly config: ITurnstileConfiguration
    ) {}

    attached() {
        const resolvedSitekey = this.sitekey || this.config.get('sitekey') || '';
        if (!resolvedSitekey) {
            console.error('Turnstile sitekey is required. Provide it via bindable or configuration.');
            return;
        }

        if ((window as any).turnstile) {
            this.renderTurnstile();
            return;
        }

        const resolvedUrl = this.scriptUrl || this.config.get('scriptUrl') ||
            'https://challenges.cloudflare.com/turnstile/v0/api.js';

        this.loadScript(resolvedUrl);
    }

    detached() {
        if (this.widgetId !== undefined && (window as any).turnstile) {
            (window as any).turnstile.remove(this.widgetId);
            this.widgetId = undefined;
        }
    }

    private loadScript(url: string) {
        const existingScript = document.querySelector(`script[src="${url}"]`);
        if (existingScript || this.scriptLoaded) {
            this.onScriptReady();
            return;
        }

        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            this.scriptLoaded = true;
            this.onScriptReady();
        };
        script.onerror = () => {
            console.error('Failed to load Turnstile script.');
        };
        document.head.appendChild(script);
    }

    private onScriptReady() {
        if ((window as any).turnstile) {
            this.renderTurnstile();
        } else {
            // Script element exists but API not yet available; poll briefly
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if ((window as any).turnstile) {
                    clearInterval(interval);
                    this.renderTurnstile();
                } else if (attempts > 50) {
                    clearInterval(interval);
                    console.error('Turnstile API did not become available.');
                }
            }, 100);
        }
    }

    private renderTurnstile() {
        const resolvedSitekey = this.sitekey || this.config.get('sitekey') || '';
        const resolvedTheme = this.theme || this.config.get('theme') || 'auto';

        this.widgetId = (window as any).turnstile.render(this.container, {
            sitekey: resolvedSitekey,
            callback: (token: string) => {
                this.element.dispatchEvent(new CustomEvent('turnstile-verified', {
                    bubbles: true,
                    composed: true,
                    detail: { token },
                }));
                this.callback?.(token);
            },
            theme: resolvedTheme,
        });
    }
}
