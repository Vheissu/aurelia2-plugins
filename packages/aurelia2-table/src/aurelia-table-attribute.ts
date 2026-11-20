import { bindable, BindingMode, customAttribute, watch } from 'aurelia';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Direct consumers can still use arbitrary row and filter shapes without type arguments.
export type DefaultTableValue = any;

export interface TableApi<TRow = DefaultTableValue> {
    revealItem(item: TRow): boolean;
}

export interface TableFilter<TRow = DefaultTableValue, TValue = DefaultTableValue> {
    value?: TValue;
    keys?: readonly string[];
    custom?(value: TValue, item: TRow): unknown;
}

export type TableSortKey<TRow = DefaultTableValue> = string | ((item: TRow, order: number) => unknown);
export type TableComparator<TRow = DefaultTableValue> = (left: TRow, right: TRow, order: number) => number;

@customAttribute('aurelia-table')
export class AureliaTableCustomAttribute<TRow = DefaultTableValue> {
    @bindable dataSource = 'local';
    
    @bindable data: TRow[] = [];
    @bindable({ mode: BindingMode.twoWay }) displayData!: TRow[];

    @bindable filters: TableFilter<TRow>[] = [];

    @bindable({ mode: BindingMode.twoWay }) currentPage!: number;
    @bindable pageSize!: number;
    @bindable({ mode: BindingMode.twoWay }) totalItems!: number;

    @bindable({ mode: BindingMode.twoWay }) api!: TableApi<TRow>;

    isAttached = false;

    sortKey?: TableSortKey<TRow> | null = null;
    sortOrder: number = 0;
    sortChangedListeners: Array<() => void> = [];
    beforePagination: TRow[] = [];

    private customSort?: TableComparator<TRow> | null = null;

    binding() {
        this.api = {
            revealItem: (item) => this.revealItem(item),
        };
    }

    attached() {
        this.isAttached = true;
        this.applyPlugins();
    }

    detaching() {
        this.isAttached = false;
    }

    dataChanged() {
        this.applyPlugins();
    }

    @watch(({ filters }: AureliaTableCustomAttribute) => filters?.map(
        ({ value, keys, custom }) => [value, Array.isArray(keys) ? keys.slice() : keys, custom],
    ))
    filterChanged() {
        if (this.dataSource === 'server') {
            return;
        }
        
        if (this.hasPagination()) {
            this.currentPage = 1;
        }
        
        this.applyPlugins();
    }

    currentPageChanged() {
        this.applyPlugins();
    }

    pageSizeChanged() {
        this.applyPlugins();
    }

    /**
     * Copies the data into the display data
     */
    getDataCopy() {
        return [...this.data];
    }

    getPageData(localData: TRow[]) {
        if (this.hasPagination()) {
            this.beforePagination = [...localData];
            return this.doPaginate(localData);
        }
        
        return localData;
      }

    /**
     * Applies all the plugins to the display data
     */
    @watch((x: AureliaTableCustomAttribute) => x.data?.length)
    applyPlugins() {
        if (!this.isAttached || !this.data || this.dataSource === 'server') {
            return;
        }

        let localData = this.getDataCopy();

        if (this.hasFilter()) {
            localData = this.doFilter(localData);
        }

        if ((this.sortKey || this.customSort) && this.sortOrder !== 0) {
            this.doSort(localData);
        }

        this.totalItems = localData.length;
        this.displayData = this.getPageData(localData);
    }

    doFilter(toFilter: TRow[]) {
        const filteredData: TRow[] = [];

        for (const item of toFilter) {
            let passed = true;
            
            for (const filter of this.filters) {
                if (!this.passFilter(item, filter)) {
                    passed = false;
                    break;
                }
            }

            if (passed) {
                filteredData.push(item);
            }
        }
        
        return filteredData;
    }

    passFilter(item: TRow, filter: TableFilter<TRow>) {
        if (typeof filter.custom === 'function' && !filter.custom(filter.value, item)) {
            return false;
        }

        if (filter.value === null || filter.value === undefined || filter.value === '' || !Array.isArray(filter.keys)) {
            return true;
        }

        for (const key of filter.keys) {
            const value: unknown = this.getPropertyValue(item, key);

            if (value !== null && value !== undefined) {
                const searchableValue = value.toString().toLowerCase();
                if (searchableValue.indexOf(filter.value.toString().toLowerCase()) > -1) {
                    return true;
                }
            }
        }
        return false;
    }

    doSort(toSort: TRow[]) {
        toSort.sort((a, b) => {
            if (typeof this.customSort === 'function') {
                return this.customSort(a, b, this.sortOrder);
            }

            let val1: unknown;
            let val2: unknown;

            if (typeof this.sortKey === 'function') {
                val1 = this.sortKey(a, this.sortOrder);
                val2 = this.sortKey(b, this.sortOrder);
            } else {
                val1 = this.getPropertyValue(a, this.sortKey);
                val2 = this.getPropertyValue(b, this.sortKey);
            }

            // accounting for null and undefined properties
            if (val1 === null || val1 === undefined) val1 = '';
            if (val2 === null || val2 === undefined) val2 = '';

            if (this.isNumeric(val1) && this.isNumeric(val2)) {
                return ((val1 as number) - (val2 as number)) * this.sortOrder;
            }

            const str1 = val1.toString();
            const str2 = val2.toString();

            return str1.localeCompare(str2) * this.sortOrder;
        });
    }

    /**
     * Retrieves the value in the object specified by the key path
     * @param object the object
     * @param keyPath the path
     * @returns the value
     */
    getPropertyValue<TKey extends Extract<keyof TRow, string>>(object: TRow, keyPath: TKey): TRow[TKey];
    getPropertyValue(object: unknown, keyPath: string): DefaultTableValue;
    getPropertyValue(object: unknown, keyPath: string): unknown {
        keyPath = keyPath.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
        keyPath = keyPath.replace(/^\./, ''); // strip a leading dot
        for (const key of keyPath.split('.')) {
            if (object == null) return undefined;
            object = (object as Record<string, unknown>)[key];
        }
        return object;
    }

    isNumeric(toCheck: unknown) {
        return !isNaN(parseFloat(toCheck as string)) && Number.isFinite(Number(toCheck));
    }

    doPaginate(toPaginate: TRow[]) {
        if (toPaginate.length <= this.pageSize) {
            return toPaginate;
        }

        const start = (this.currentPage - 1) * this.pageSize;

        const end = start + this.pageSize;

        return toPaginate.slice(start, end);
    }

    hasFilter() {
        return Array.isArray(this.filters) && this.filters.length > 0;
    }

    hasPagination() {
        return this.currentPage > 0 && this.pageSize > 0;
    }

    sortChanged(key: TableSortKey<TRow> | null | undefined, custom: TableComparator<TRow> | null | undefined, order: number) {
        this.sortKey = key;
        this.customSort = custom;
        this.sortOrder = order;
        this.applyPlugins();
        this.emitSortChanged();
    }

    addSortChangedListener(callback: () => void) {
        this.sortChangedListeners.push(callback);
    }

    removeSortChangedListener(callback: () => void) {
        this.removeListener(callback, this.sortChangedListeners);
    }

    emitSortChanged() {
        for (const listener of this.sortChangedListeners) {
            listener();
        }
    }

    removeListener<T>(callback: T, listeners: T[]) {
        const index = listeners.indexOf(callback);

        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    revealItem(item: TRow) {
        if (!this.hasPagination()) {
            return true;
        }

        const index = this.beforePagination.indexOf(item);

        if (index === -1) {
            return false;
        }

        this.currentPage = Math.ceil((index + 1) / this.pageSize);

        return true;
    }
}
