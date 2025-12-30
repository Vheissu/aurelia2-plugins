import { IContainer, IRegistry } from 'aurelia';

import { AureliaTableCustomAttribute } from './aurelia-table-attribute.js';
import { AutSortCustomAttribute } from './aurelia-table-sort.js';
import { AutSelectCustomAttribute } from './aurelia-table-select.js';
import { AutPaginationCustomElement } from './aurelia-table-pagination.js';

export { TableSettings, TableResult } from './aurelia-table-settings.js';

const DefaultComponents = [
    AureliaTableCustomAttribute,
    AutSortCustomAttribute,
    AutSelectCustomAttribute,
    AutPaginationCustomElement,
];

export const AureliaTableConfiguration: IRegistry = {
    register(container: IContainer): IContainer {
        return container.register(...DefaultComponents);
    }
};
