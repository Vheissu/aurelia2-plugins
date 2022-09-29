import { bindable, ICustomElementViewModel, customElement, shadowCSS } from 'aurelia';

import SharedStyles from '../variables.css';

import styles from './cardigan-image.css';
import template from './cardigan-image.html';
@customElement({
    name: 'cardigan-image',
    template,
    dependencies: [
        shadowCSS(SharedStyles, styles)
    ],
    shadowOptions: { mode: 'open' }
})
export class CardiganImageCustomElement implements ICustomElementViewModel {
    @bindable public alt: string = '';
    @bindable public color: string = 'transparent';
    @bindable public naturalHeight: string = '';
    @bindable public naturalWidth: string = '';
    @bindable public fit: string = 'none';
    @bindable public src: string = '';
    @bindable public loading: string = 'auto';
    @bindable public importance: string = 'auto';
    @bindable public sizes: string = '';
    @bindable public srcSet: string = '';
    @bindable public onError: any = () => ``;
    @bindable public onLoad: any = () => ``;

    attached() {
        if (this.fit === 'cover' || this.fit === 'contain') {
            this.loadImage();
        }
    }

    propertyChanged() {
        if (this.fit === 'cover' || this.fit === 'contain') {
            this.loadImage();
        }
    }

    private loadImage() {
        const image = new window.Image();
        image.onload = this.handleOnLoad;
        image.onerror = this.handleOnError;
        image.src = this.src;
    }

    private handleOnLoad = () => {
        this.onLoad();
    }

    private handleOnError = () => {
        this.onError();
    }
}