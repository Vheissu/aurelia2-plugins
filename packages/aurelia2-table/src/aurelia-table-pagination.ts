import { bindable, BindingMode, customElement, type IController, type ICustomElementViewModel } from 'aurelia';

import template from './aurelia-table-pagination.html';

@customElement({
  name: 'aut-pagination',
  template
})
export class AutPaginationCustomElement implements ICustomElementViewModel {
    @bindable({mode: BindingMode.twoWay}) currentPage!: number;
    @bindable pageSize!: number;
    @bindable totalItems = 0;
    @bindable hideSinglePage = true;
    @bindable paginationSize?: number;
    @bindable boundaryLinks = false;
    @bindable firstText = 'First';
    @bindable lastText = 'Last';
    @bindable directionLinks = true;
    @bindable previousText = '<';
    @bindable nextText = '>';

    totalPages = 1;
    displayPages: { title: string; value: number; }[] = [];

    private element!: HTMLElement;

    created(controller: IController) {
      this.element = controller.host as HTMLElement;
    }

    binding() {
        if (this.currentPage === undefined || this.currentPage === null || this.currentPage < 1) {
            this.currentPage = 1;
        }

        if (this.pageSize === undefined || this.pageSize === null || this.pageSize < 1) {
            this.pageSize = 5;
        }

        if (this.totalItems === undefined || this.totalItems === null || isNaN(this.totalItems) || this.totalItems < 0) {
            this.totalItems = 0;
        }

        this.calculatePages();
    }

    totalItemsChanged() {
        if (this.totalItems === undefined || this.totalItems === null || isNaN(this.totalItems) || this.totalItems < 0) {
            this.totalItems = 0;
            return;
        }

        this.currentPage = 1;
        this.calculatePages();
    }

    pageSizeChanged() {
        if (this.pageSize === undefined || this.pageSize === null || isNaN(this.pageSize) || this.pageSize < 0) {
            this.pageSize = 5;
            return;
        }

        this.currentPage = 1;
        this.calculatePages();
    }

    currentPageChanged() {
        if (this.currentPage === undefined || this.currentPage === null || isNaN(this.currentPage) || this.currentPage < 1) {
            this.currentPage = 1;
            return;
        }

        this.calculatePages();
        this.dispatchPageChangedEvent();
    }

    dispatchPageChangedEvent() {
        this.element?.dispatchEvent(new CustomEvent('page-changed', {
            bubbles: true,
            detail: { currentPage: this.currentPage }
        }));
    }

    calculatePages() {
        const pageSize = Number.isFinite(Number(this.pageSize)) ? Number(this.pageSize) : 0;
        const totalItems = Number.isFinite(Number(this.totalItems)) ? Number(this.totalItems) : 0;

        if (pageSize === 0) {
            this.totalPages = 1
        }else {
            this.totalPages = totalItems <= pageSize ? 1 : Math.ceil(totalItems / pageSize);
        }

        if (isNaN(this.paginationSize) || this.paginationSize <= 0) {
            this.displayAllPages();
        } else {
            this.limitVisiblePages();
        }
    }

    displayAllPages() {
        const displayPages: { title: string; value: number; }[] = [];

        for (let i = 1; i <= this.totalPages; i++) {
            displayPages.push({
              title: i.toString(),
              value: i
            });
        }
        
        this.displayPages = displayPages;
    }

    limitVisiblePages() {
        const displayPages: { title: string; value: number; }[] = [];

        const totalTiers = Math.ceil(this.totalPages / this.paginationSize);

        const activeTier = Math.ceil(this.currentPage / this.paginationSize);

        const start = ((activeTier - 1) * this.paginationSize) + 1;
        const end = start + this.paginationSize;

        if (activeTier > 1) {
            displayPages.push({
                title: '...',
                value: start - 1
            });
        }

        for (let i = start; i < end; i++) {
            if (i > this.totalPages) {
                break;
            }

            displayPages.push({
                title: i.toString(),
                value: i
            });
        }

        if (activeTier < totalTiers) {
            displayPages.push({
                title: '...',
                value: end
            });
        }

        this.displayPages = displayPages;
    }

    selectPage(page: number) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) {
            return;
        }

        this.currentPage = page;
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
    }

    firstPage() {
        this.currentPage = 1;
    }

    lastPage() {
        this.currentPage = this.totalPages;
    }
}
