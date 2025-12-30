import { bindable, customAttribute, INode, inject, optional } from 'aurelia';

import { AureliaTableCustomAttribute } from './aurelia-table-attribute.js';

@customAttribute('aut-sort')
@inject(optional(AureliaTableCustomAttribute), INode)
export class AutSortCustomAttribute {
    @bindable key;
    @bindable custom;
    @bindable default;

    private rowSelectedListener;
    private sortChangedListener;

    order = 0;
    orderClasses = ['aut-desc', 'aut-sortable', 'aut-asc'];

    ignoreEvent = false;

    constructor(
        private readonly auTable: AureliaTableCustomAttribute,
        private readonly element: HTMLElement
    ) {
        this.rowSelectedListener = () => {
            this.handleHeaderClicked();
        };

        this.sortChangedListener = () => {
            this.handleSortChanged();
        };
    }

    handleSortChanged() {
        if (!this.ignoreEvent) {
            this.order = 0;
            this.setClass();
        } else {
            this.ignoreEvent = false;
        }
    }

    attached() {
        if ((this.key || this.custom) && this.element && this.auTable) {
            this.element.style.cursor = 'pointer';
            this.element.classList.add('aut-sort');

            this.element.addEventListener('click', this.rowSelectedListener);
            this.auTable.addSortChangedListener(this.sortChangedListener);

            this.handleDefault();
            this.setClass();
        }
    }

    detached() {
        if (this.key || this.custom) {
            this.element?.removeEventListener('click', this.rowSelectedListener);
            this.auTable?.removeSortChangedListener(this.sortChangedListener);
        }
    }

    handleDefault() {
        if (this.default) {
            this.order = this.default === 'desc' ? -1 : 1;
            this.doSort();
        }
    }

    doSort() {
        if (this.auTable.dataSource === 'server') {
            return;
        }

        this.ignoreEvent = true;
        this.auTable.sortChanged(this.key, this.custom, this.order);
    }

    setClass() {
        this.orderClasses.forEach((next) => this.element.classList.remove(next));
        this.element.classList.add(this.orderClasses[this.order + 1]);
    }

    handleHeaderClicked() {
        this.order = this.order === 0 || this.order === -1 ? this.order + 1 : -1;
        this.setClass();
        this.doSort();
    }
}
