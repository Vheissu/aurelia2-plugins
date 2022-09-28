import { observable } from '@aurelia/runtime';

export class TableSettings {
    @observable pageSize = 10;
    @observable currentPage = 1;

    private getItems;

    totalItems = 0;
    items;
    filter;

    draw = 0;

    get start() {
        return (this.currentPage - 1) * this.pageSize;
    }

    constructor(getItems) {
        this.getItems = getItems;
    }

    pageSizeChanged(newValue, oldValue) {
        if (oldValue === undefined) {
            return;
        }

        this.loadItems();
    }

    currentPageChanged(newValue, oldValue) {
        if (oldValue === undefined) {
            return;
        }

        this.loadItems();
    }

    loadItems() {
        let query = this.buildQuery();

        return this
            .getItems(query)
            .then(result => {
                this.items = result.items;
                this.totalItems = result.totalItems;
            });
    }

    buildQuery() {
        return {
            draw: this.draw++,
            start: this.start,
            pageSize: this.pageSize,
            filter: this.filter
        };
    }
}

export class TableResult {
    draw;
    totalItems;
    items;

    constructor(result) {
        this.draw = result.draw;
        this.totalItems = result.totalItems;
        this.items = result.items;
    }
}