import { bindable, BindingMode, customAttribute, ICustomAttributeViewModel, INode } from '@aurelia/runtime-html';

@customAttribute('outclick')
export class Outclick implements ICustomAttributeViewModel {
    @bindable({ primary: true }) readonly fn = (event?) => ``;

    constructor(@INode readonly element: HTMLElement) {

    }

    attached() {
        document.addEventListener('click', this.handleClick);
    }

    detached() {
        document.removeEventListener('click', this.handleClick);
    }

    handleClick = event => {
        // Click is outside of element
        if (!this.element.contains(event.target)) {
            this.fn(event);
        }
    }
}