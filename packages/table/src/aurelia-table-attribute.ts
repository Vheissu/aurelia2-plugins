import { bindable, BindingMode, customAttribute, watch } from '@aurelia/runtime-html';

@customAttribute('aurelia-table')
export class AureliaTableCustomAttribute {
    @bindable dataSource = 'local';
    
    @bindable data = [];
    @bindable({ mode: BindingMode.twoWay }) displayData;

    @bindable filters = [];

    @bindable({ mode: BindingMode.twoWay }) currentPage;
    @bindable pageSize;
    @bindable({ mode: BindingMode.twoWay }) totalItems;

    @bindable({ mode: BindingMode.twoWay }) api;

    isAttached = false;

    sortKey;
    sortOrder;
    sortChangedListeners: any[] = [];
    beforePagination: any[] = [];

    private customSort;

    bind() {
        this.api = {
            revealItem: (item) => this.revealItem(item),
        };
    }

    attached() {
        this.isAttached = true;
        this.applyPlugins();
    }

    @watch((x: AureliaTableCustomAttribute) => x.filters.map((f:any) => f.value).join(''))
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
        return [].concat(this.data);
    }

    getPageData(localData) {
        if (this.hasPagination()) {
            this.beforePagination = [].concat(localData);
            return this.doPaginate(localData);
        }
        
        return localData;
      }

    /**
     * Applies all the plugins to the display data
     */
    @watch((x: AureliaTableCustomAttribute) => x.data.length)
    applyPlugins() {
        if (!this.isAttached || !this.data || this.dataSource === 'server') {
            return;
        }

        let localData: any[] = this.getDataCopy();

        if (this.hasFilter()) {
            localData = this.doFilter(localData);
        }

        if ((this.sortKey || this.customSort) && this.sortOrder !== 0) {
            this.doSort(localData);
        }

        this.totalItems = localData.length;
        this.displayData = this.getPageData(localData);
    }

    doFilter(toFilter) {
        let filteredData: any[] = [];

        for (let item of toFilter) {
            let passed = true;
            
            for (let filter of this.filters) {
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

    passFilter(item, filter) {
        if (typeof filter.custom === 'function' && !filter.custom(filter.value, item)) {
            return false;
        }

        if (filter.value === null || filter.value === undefined || filter.value === '' || !Array.isArray(filter.keys)) {
            return true;
        }

        for (let key of filter.keys) {
            let value = this.getPropertyValue(item, key);

            if (value !== null && value !== undefined) {
                value = value.toString().toLowerCase();

                if (value.indexOf(filter.value.toString().toLowerCase()) > -1) {
                    return true;
                }
            }
        }
        return false;
    }

    doSort(toSort) {
        toSort.sort((a, b) => {
            if (typeof this.customSort === 'function') {
                return this.customSort(a, b, this.sortOrder);
            }

            let val1;
            let val2;

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
                return (val1 - val2) * this.sortOrder;
            }

            let str1 = val1.toString();
            let str2 = val2.toString();

            return str1.localeCompare(str2) * this.sortOrder;
        });
    }

    /**
     * Retrieves the value in the object specified by the key path
     * @param object the object
     * @param keyPath the path
     * @returns {*} the value
     */
    getPropertyValue(object, keyPath) {
        keyPath = keyPath.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
        keyPath = keyPath.replace(/^\./, ''); // strip a leading dot
        let a = keyPath.split('.');
        for (let i = 0, n = a.length; i < n; ++i) {
            let k = a[i];
            if (k in object) {
                object = object[k];
            } else {
                return;
            }
        }
        return object;
    }

    isNumeric(toCheck) {
        return !isNaN(parseFloat(toCheck)) && isFinite(toCheck);
    }

    doPaginate(toPaginate) {
        if (toPaginate.length <= this.pageSize) {
            return toPaginate;
        }

        let start = (this.currentPage - 1) * this.pageSize;

        let end = start + this.pageSize;

        return toPaginate.slice(start, end);
    }

    hasFilter() {
        return Array.isArray(this.filters) && this.filters.length > 0;
    }

    hasPagination() {
        return this.currentPage > 0 && this.pageSize > 0;
    }

    dataChanged() {
        this.applyPlugins();
    }

    sortChanged(key, custom, order) {
        this.sortKey = key;
        this.customSort = custom;
        this.sortOrder = order;
        this.applyPlugins();
        this.emitSortChanged();
    }

    addSortChangedListener(callback) {
        this.sortChangedListeners.push(callback);
    }

    removeSortChangedListener(callback) {
        this.removeListener(callback, this.sortChangedListeners);
    }

    emitSortChanged() {
        for (let listener of this.sortChangedListeners) {
            listener();
        }
    }

    removeListener(callback, listeners) {
        let index = listeners.indexOf(callback);

        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    revealItem(item) {
        if (!this.hasPagination()) {
            return true;
        }

        let index = this.beforePagination.indexOf(item);

        if (index === -1) {
            return false;
        }

        this.currentPage = Math.ceil((index + 1) / this.pageSize);

        return true;
    }
}
