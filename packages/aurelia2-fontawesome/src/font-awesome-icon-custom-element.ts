import { inject } from '@aurelia/kernel';
import { bindable, customElement } from '@aurelia/runtime-html';
import { icon, type SizeProp } from '@fortawesome/fontawesome-svg-core';
import { IFontAwesomeIconRegistry, type FontAwesomeIconInput } from './icon-registry';

@customElement({ name: 'font-awesome-icon', template: '<span ref="iconContainer"></span>' })
@inject(IFontAwesomeIconRegistry)
export class FontAwesomeIconCustomElement {
    @bindable public icon!: FontAwesomeIconInput;
    @bindable public title?: string;
    @bindable public spin = false;
    @bindable public size?: SizeProp;

    public iconContainer!: HTMLElement;

    constructor(private readonly iconRegistry: IFontAwesomeIconRegistry) { }

    public attached(): void {
        this.renderIcon();
    }

    public iconChanged(): void {
        this.renderIcon();
    }

    public titleChanged(): void {
        this.renderIcon();
    }

    public spinChanged(): void {
        this.renderIcon();
    }

    public sizeChanged(): void {
        this.renderIcon();
    }

    private renderIcon(): void {
        if (!this.iconContainer || !this.icon) {
            return;
        }

        const lookup = this.iconRegistry.resolve(this.icon);
        const classes = [
            ...(this.spin ? ['fa-spin'] : []),
            ...(this.size ? [`fa-${this.size}`] : [])
        ];

        const response = icon(lookup, {
            title: this.title ?? lookup.iconName,
            classes
        });

        const markup = response?.html?.join('');

        if (!markup) {
            throw new Error(`Font Awesome icon "${describeIcon(this.icon)}" is not registered.`);
        }

        this.iconContainer.innerHTML = markup;
    }
}

function describeIcon(iconValue: FontAwesomeIconInput): string {
    if (typeof iconValue === 'string') {
        return iconValue;
    }

    if (Array.isArray(iconValue)) {
        return `${iconValue[0]}:${iconValue[1]}`;
    }

    return `${iconValue.prefix}:${iconValue.iconName}`;
}
