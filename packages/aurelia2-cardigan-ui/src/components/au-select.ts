import { bindable, BindingMode, ICustomElementViewModel, customElement, shadowCSS } from '@aurelia/runtime-html';

import SharedStyles from '../variables.css';

import styles from './au-select.css';
import template from './au-select.html';
@customElement({
    name: 'au-select',
    template,
    dependencies: [
        shadowCSS(SharedStyles, styles)
    ],
    shadowOptions: { mode: 'open' }
})
export class AuSelectCustomElement implements ICustomElementViewModel {
    @bindable public size: 'small' | 'medium' | 'large' = 'medium';
    @bindable public disabled: boolean = false;
    @bindable({ mode: BindingMode.twoWay }) public value: unknown;
}