import { bindable, customAttribute, ICustomAttributeViewModel, INode } from '@aurelia/runtime-html';
import { inject } from '@aurelia/kernel';

@customAttribute({ name: 'outclick', defaultProperty: 'fn' })
@inject(INode)
export class Outclick implements ICustomAttributeViewModel {
    @bindable readonly fn: (event: MouseEvent) => void = () => { /* noop */ };

    constructor(readonly element: HTMLElement) {

    }

    attached(): void {
        document.addEventListener('click', this.handleClick);
    }

    detached(): void {
        document.removeEventListener('click', this.handleClick);
    }

    handleClick = (event: MouseEvent): void => {
        // Click is outside of element
        if (!this.element.contains(event.target as Node)) {
            this.fn(event);
        }
    }
}
