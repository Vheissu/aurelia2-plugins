import { bindable, ICustomElementViewModel, customElement, shadowCSS } from '@aurelia/runtime-html';

import SharedStyles from '../variables.css';

import styles from './au-heading.css';
import template from './au-heading.html';

// Create a constant and populate it with an array of string numbers from 1 to 6
const headingLevels = Array.from(Array(6).keys()).map(i => `${i + 1}`);

@customElement({
    name: 'au-heading',
    template,
    dependencies: [
        shadowCSS(SharedStyles, styles)
    ],
    shadowOptions: { mode: 'open' }
})
export class AuHeadingCustomElement implements ICustomElementViewModel {
    @bindable public size: 'small' | 'medium' | 'large' = 'medium';
    @bindable({
        set: (val: any) => {
            if (headingLevels.includes(val?.toString())) {
                return val;
            } else {
                return '1';
            }
        }
    }) public level: '1' | '2' | '3' | '4' | '5' | '6' = '1';
    @bindable public color: 'white' | 'light' | 'dark' | 'primary' | 'success' | 'info' | 'error' | 'bright' | 'skyBlue' | 'purple' | 'blueAlt' = 'dark';
    @bindable public overflow: 'normal' | 'breakWord' = 'normal';
    @bindable public truncate = false;
}