import { observable } from 'aurelia';
import type { DefaultTableValue } from './aurelia-table-attribute.js';

export interface TableQuery<TFilter = unknown> {
    draw: number;
    start: number;
    pageSize: number;
    filter: TFilter | null;
}

export interface TablePage<TRow = unknown> {
    items: TRow[];
    totalItems: number;
}

export class TableSettings<TRow = DefaultTableValue, TFilter = DefaultTableValue> {
    @observable pageSize = 10;
    @observable currentPage = 1;

    private loadVersion = 0;

    totalItems = 0;
    items: TRow[] = [];
    filter: TFilter | null = null;

    draw: number = 0;

    get start() {
        return (this.currentPage - 1) * this.pageSize;
    }

    constructor(private readonly getItems: (query: TableQuery<TFilter>) => Promise<TablePage<TRow>>) {}

    pageSizeChanged(_newValue: number, oldValue: number | undefined) {
        if (oldValue === undefined) {
            return;
        }

        this.loadItems();
    }

    currentPageChanged(_newValue: number, oldValue: number | undefined) {
        if (oldValue === undefined) {
            return;
        }

        this.loadItems();
    }

    loadItems() {
        const query = this.buildQuery();
        const version = ++this.loadVersion;

        return this
            .getItems(query)
            .then(result => {
                if (version !== this.loadVersion) return;
                this.items = result.items;
                this.totalItems = result.totalItems;
            });
    }

    buildQuery(): TableQuery<TFilter> {
        return {
            draw: this.draw++,
            start: this.start,
            pageSize: this.pageSize,
            filter: this.filter
        };
    }
}

export class TableResult<TRow = DefaultTableValue> implements TablePage<TRow> {
    draw: number;
    totalItems: number;
    items: TRow[];

    constructor(result: TablePage<TRow> & { draw: number }) {
        this.draw = result.draw;
        this.totalItems = result.totalItems;
        this.items = result.items;
    }
}
