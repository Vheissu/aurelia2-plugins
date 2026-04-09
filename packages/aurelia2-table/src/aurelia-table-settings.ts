import { observable } from '@aurelia/runtime';

export class TableSettings {
    @observable pageSize = 10;
    @observable currentPage = 1;

    private getItems: (query: any) => Promise<any>;

    totalItems: number = 0;
    items: any[] = [];
    filter: any = null;

    draw: number = 0;

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
    draw: number;
    totalItems: number;
    items: any[];

    constructor(result) {
        this.draw = result.draw;
        this.totalItems = result.totalItems;
        this.items = result.items;
    }
}