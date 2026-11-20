import { bindable, CustomAttribute, customAttribute, type IController } from 'aurelia';

import {
    AureliaTableCustomAttribute,
    type DefaultTableValue,
    type TableComparator,
    type TableSortKey,
} from './aurelia-table-attribute.js';

@customAttribute('aut-sort')
export class AutSortCustomAttribute<TRow = DefaultTableValue> {
    @bindable key?: TableSortKey<TRow> | null;
    @bindable custom?: TableComparator<TRow> | null;
    @bindable default?: string | boolean;

    private readonly rowSelectedListener = () => this.handleHeaderClicked();
    private readonly sortChangedListener = () => this.handleSortChanged();
    private element!: HTMLElement;
    private controller?: IController;
    private auTable: AureliaTableCustomAttribute<TRow> | null = null;
    private isAttached = false;

    order = 0;
    orderClasses = ['aut-desc', 'aut-sortable', 'aut-asc'];

    ignoreEvent = false;
    isInitialized = false;

    created(controller: IController) {
        this.controller = controller;
        this.element = controller.host as HTMLElement;
    }

    keyChanged() {
        this.initializeSorting();
    }

    customChanged() {
        this.initializeSorting();
    }

    resolveTable() {
        let currentController = this.controller?.parent;
        while (currentController != null) {
            if (currentController.viewModel instanceof AureliaTableCustomAttribute) {
                this.auTable = currentController.viewModel;
                return;
            }
            currentController = currentController.parent;
        }

        const tableElement = this.element?.closest('table');
        const tableController = tableElement
            ? CustomAttribute.for(tableElement, 'aurelia-table')
            : null;

        const table = tableController ?? CustomAttribute.closest(this.element, AureliaTableCustomAttribute);
        this.auTable = table === null ? null : table.viewModel as AureliaTableCustomAttribute<TRow>;
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
        this.isAttached = true;
        this.initializeSorting();
    }

    detaching() {
        this.isAttached = false;
        if (this.isInitialized) {
            this.element?.removeEventListener('click', this.rowSelectedListener);
            this.auTable?.removeSortChangedListener(this.sortChangedListener);
        }

        this.auTable = null;
        this.isInitialized = false;
    }

    initializeSorting() {
        if (!this.isAttached || this.isInitialized || !(this.key || this.custom) || !this.element) {
            return;
        }

        this.resolveTable();

        if (!this.auTable) {
            return;
        }

        this.element.style.cursor = 'pointer';
        this.element.classList.add('aut-sort');

        this.element.addEventListener('click', this.rowSelectedListener);
        this.auTable.addSortChangedListener(this.sortChangedListener);

        this.isInitialized = true;

        this.handleDefault();
        this.setClass();
    }

    handleDefault() {
        if (this.default) {
            this.order = this.default === 'desc' ? -1 : 1;
            this.doSort();
        }
    }

    doSort() {
        if (!this.auTable) {
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
