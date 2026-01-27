import { bindable, customAttribute, ICustomAttributeViewModel, INode } from '@aurelia/runtime-html';
import { inject } from '@aurelia/kernel';

@customAttribute({ name: 'outclick', defaultProperty: 'fn' })
@inject(INode)
export class Outclick implements ICustomAttributeViewModel {
    @bindable readonly fn = (event?) => ``;

    constructor(readonly element: HTMLElement) {

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
