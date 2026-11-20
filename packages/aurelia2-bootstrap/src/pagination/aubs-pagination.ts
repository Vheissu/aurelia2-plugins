import { bindable, BindingMode } from "aurelia";
import { bootstrapOptions } from "../utils/bootstrap-options";

export class AubsPaginationCustomElement {
  @bindable({ mode: BindingMode.twoWay }) currentPage: number = 1;
  @bindable pageSize: number = 5;
  @bindable totalItems: number = 0;
  @bindable hideSinglePage = bootstrapOptions.paginationHideSinglePage;
  @bindable paginationSize: number = 0;
  @bindable boundaryLinks = bootstrapOptions.paginationBoundaryLinks;
  @bindable firstText = bootstrapOptions.paginationFirstText;
  @bindable lastText = bootstrapOptions.paginationLastText;
  @bindable directionLinks = bootstrapOptions.paginationDirectionLinks;
  @bindable previousText = bootstrapOptions.paginationPreviousText;
  @bindable nextText = bootstrapOptions.paginationNextText;

  totalPages = 1;
  displayPages: { title: string; value: number }[] = [];

  bound() {
    if (
      this.currentPage === undefined ||
      this.currentPage == null ||
      this.currentPage < 1
    ) {
      this.currentPage = 1;
    }

    if (
      this.pageSize === undefined ||
      this.pageSize === null ||
      this.pageSize < 1
    ) {
      this.pageSize = 5;
    }
    this.calculatePages();
  }

  paginationSizeChanged() {
    this.calculatePages();
  }

  totalItemsChanged() {
    this.calculatePages();
  }

  pageSizeChanged() {
    this.calculatePages();
  }

  currentPageChanged() {
    this.calculatePages();
  }

  calculatePages() {
    const pageSize = Number(this.pageSize);
    const totalItems = Number(this.totalItems);
    this.totalPages = Number.isFinite(pageSize) && pageSize >= 1 && Number.isFinite(totalItems)
      ? Math.max(1, Math.ceil(totalItems / pageSize))
      : 1;

    if (!(this.currentPage >= 1 && this.currentPage <= this.totalPages)) {
      this.currentPage = 1;
    }

    const paginationSize = Math.floor(Number(this.paginationSize));
    if (!Number.isFinite(paginationSize) || paginationSize <= 0) {
      this.displayAllPages();
    } else {
      this.limitVisiblePages(paginationSize);
    }
  }

  displayAllPages() {
    const displayPages = [];

    for (let i = 1; i <= this.totalPages; i++) {
      displayPages.push({
        title: i.toString(),
        value: i,
      });
    }
    this.displayPages = displayPages;
  }

  limitVisiblePages(paginationSize = Number(this.paginationSize)) {
    const displayPages = [];

    const totalTiers = Math.ceil(this.totalPages / paginationSize);

    const activeTier = Math.ceil(this.currentPage / paginationSize);

    const start = (activeTier - 1) * paginationSize + 1;
    const end = start + paginationSize;

    if (activeTier > 1) {
      displayPages.push({
        title: "...",
        value: start - 1,
      });
    }

    for (let i = start; i < end; i++) {
      if (i > this.totalPages) {
        break;
      }

      displayPages.push({
        title: i.toString(),
        value: i,
      });
    }

    if (activeTier < totalTiers) {
      displayPages.push({
        title: "...",
        value: end,
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
