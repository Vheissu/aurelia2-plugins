import { inject } from '@aurelia/kernel';
import { customAttribute } from '@aurelia/runtime-html';
import { icon } from '@fortawesome/fontawesome-svg-core';
import { IFontAwesomeIconRegistry } from './icon-registry';

@customAttribute('aut-sort-icon')
@inject(Element, IFontAwesomeIconRegistry)
export class AutSortIconCustomAttribute {
    private observer?: MutationObserver;
    private iconContainer: HTMLElement | null = null;

    constructor(
        private readonly element: HTMLElement,
        private readonly iconRegistry: IFontAwesomeIconRegistry
    ) { }

    public attached(): void {
        this.updateIcon();
        this.observer = new MutationObserver(() => this.updateIcon());
        this.observer.observe(this.element, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    public detached(): void {
        this.observer?.disconnect();
        this.removeIcon();
    }

    private updateIcon(): void {
        this.removeIcon();

        const iconName = this.getIconName();
        const lookup = this.iconRegistry.resolve(iconName);
        const response = icon(lookup, { title: lookup.iconName });
        const markup = response?.html?.join('');

        if (!markup) {
            throw new Error(`Font Awesome icon "${iconName}" is not registered.`);
        }

        this.iconContainer = this.element.ownerDocument.createElement('span');
        this.iconContainer.classList.add('aut-sort-icon');
        this.iconContainer.innerHTML = `${markup}&nbsp;`;

        this.element.prepend(this.iconContainer);
    }

    private getIconName(): string {
        if (this.element.classList.contains('aut-asc')) {
            return 'arrow-down-short-wide';
        }

        if (this.element.classList.contains('aut-desc')) {
            return 'arrow-up-wide-short';
        }

        return 'sort';
    }

    private removeIcon(): void {
        if (this.iconContainer?.parentElement) {
            this.iconContainer.parentElement.removeChild(this.iconContainer);
            this.iconContainer = null;
            return;
        }

        this.element.querySelector('.aut-sort-icon')?.remove();
    }
}