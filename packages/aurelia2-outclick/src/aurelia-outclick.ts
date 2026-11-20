import { bindable, customAttribute, ICustomAttributeViewModel, INode } from '@aurelia/runtime-html';
import { inject } from '@aurelia/kernel';

@customAttribute({ name: 'outclick', defaultProperty: 'fn' })
@inject(INode)
export class Outclick implements ICustomAttributeViewModel {
    @bindable readonly fn: (event: MouseEvent) => void = () => { /* noop */ };

    constructor(readonly element: HTMLElement) {

    }

    attached(): void {
        this.element.ownerDocument.addEventListener('click', this.handleClick);
    }

    detaching(): void {
        this.element.ownerDocument.removeEventListener('click', this.handleClick);
    }

    handleClick = (event: MouseEvent): void => {
        // Click is outside of element
        if (!event.composedPath().includes(this.element)) {
            this.fn(event);
        }
    }
}
