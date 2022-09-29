import { bindable, ICustomElementViewModel, customElement, shadowCSS } from 'aurelia';

import SharedStyles from '../variables.css';

import styles from './cardigan-code.css';
import template from './cardigan-code.html';
@customElement({
    name: 'cardigan-code',
    template,
    dependencies: [
        shadowCSS(SharedStyles, styles)
    ],
    shadowOptions: { mode: 'open' }
})
export class CardiganCodeCustomElement implements ICustomElementViewModel {
    @bindable public type: 'pre' | 'code'  ='pre';
}