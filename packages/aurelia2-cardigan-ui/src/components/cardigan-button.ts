import { bindable, ICustomElementViewModel, customElement, shadowCSS } from 'aurelia';

import SharedStyles from '../variables.css';

import styles from './cardigan-button.css';
import template from './cardigan-button.html';
@customElement({
    name: 'cardigan-button',
    template,
    dependencies: [
        shadowCSS(SharedStyles, styles)
    ],
    shadowOptions: { mode: 'open' }
})
export class CardiganButtonCustomElement implements ICustomElementViewModel {
    @bindable public disabled: boolean = false;
    @bindable public color: string | null = '';
    @bindable public icon: string | null = null;
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