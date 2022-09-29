import { bindable, BindingMode, ICustomElementViewModel, customElement, shadowCSS } from 'aurelia';

import SharedStyles from '../variables.css';

import styles from './cardigan-select.css';
import template from './cardigan-select.html';
@customElement({
    name: 'cardigan-select',
    template,
    dependencies: [
        shadowCSS(SharedStyles, styles)
    ],
    shadowOptions: { mode: 'open' }
})
export class CardiganSelectCustomElement implements ICustomElementViewModel {
    @bindable public size: 'small' | 'medium' | 'large' = 'medium';
    @bindable public disabled: boolean = false;
    @bindable({ mode: BindingMode.twoWay }) public value: unknown;
}