import { bindable, ICustomElementViewModel, customElement, shadowCSS } from '@aurelia/runtime-html';

import SharedStyles from '../variables.css';

import styles from './au-code.css';
import template from './au-code.html';
@customElement({
    name: 'au-code',
    template,
    dependencies: [
        shadowCSS(SharedStyles, styles)
    ],
    shadowOptions: { mode: 'open' }
})
export class AuCodeCustomElement implements ICustomElementViewModel {
    @bindable public type: 'pre' | 'code'  ='pre';
}