import { bindable, ICustomElementViewModel, customElement, shadowCSS } from '@aurelia/runtime-html';

import SharedStyles from '../variables.css';

import styles from './au-button.css';
import template from './au-button.html';
@customElement({
    name: 'au-button',
    template,
    dependencies: [
        shadowCSS(SharedStyles, styles)
    ],
    shadowOptions: { mode: 'open' }
})
export class AuButtonCustomElement implements ICustomElementViewModel {
    @bindable public disabled: boolean = false;
    @bindable public color = '';
    @bindable public icon = null;
    @bindable public iconSize = '1rem';
    @bindable public size = 'medium';
    @bindable public title: string = '';
    @bindable public type: string = 'button';
    @bindable public content: string = '';
    @bindable public callback: any = () => ``;

    public innerCallback() {
        if (this.callback) {
            this.callback();
        }
    }
}