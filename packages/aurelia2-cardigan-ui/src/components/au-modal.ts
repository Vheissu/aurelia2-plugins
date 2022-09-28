import { bindable, ICustomElementViewModel, customElement, shadowCSS } from '@aurelia/runtime-html';

import SharedStyles from '../variables.css';

import styles from './au-modal.css';
import template from './au-modal.html';

export type ModalSize = 'sm' | 'md' | 'lg' | number;
export type ModalRole = 'alertdialog' | 'dialog';

const SIZES = {
    sm: '540px',
    md: '720px',
    lg: '900px'
};

const ESCAPE_KEY_CODE = 27;

@customElement({
    name: 'au-modal',
    template,
    dependencies: [
        shadowCSS(SharedStyles, styles)
    ],
    shadowOptions: { mode: 'open' }
})
export class AuModalCustomElement implements ICustomElementViewModel {
    @bindable private size: ModalSize = 'sm';
    @bindable private label: string = '';
    @bindable private clickClose: boolean = true;
    @bindable private onClose = (event?: MouseEvent) => ``;
    @bindable private role: ModalRole = 'dialog';

    private width;

    attaching() {
        this.width = typeof SIZES[this.size] !== 'undefined' ? SIZES[this.size] : this.size;

        window.addEventListener('keyup', this.handleKeyUp);
    }

    detaching() {
        window.removeEventListener('keyup', this.handleKeyUp);
    }

    sizeChanged(size) {
        this.width = typeof SIZES[size] !== 'undefined' ? SIZES[size] : size;
    }

    handleKeyUp = (event: { keyCode: number }) => {
        if (event.keyCode === ESCAPE_KEY_CODE) {
            this.onClose();
        }
    }

    handleBackdropClick(event: MouseEvent) {
        if (this.clickClose) {
            if (event.target !== event.currentTarget) {
                return;
            }
    
            this.onClose(event);
        }
    }
}