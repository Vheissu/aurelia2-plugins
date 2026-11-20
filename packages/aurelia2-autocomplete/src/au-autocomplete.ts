import { bindable, BindingMode, customElement, INode, resolve } from 'aurelia';
import { IAutocompleteService } from './autocomplete-service';
import type {
  AutocompleteOption,
  AutocompleteSearch,
  AutocompleteSelectDetail,
} from './types';
import template from './au-autocomplete.html';

const identity = <T>(value: T): T => value;

@customElement({
  name: 'au-autocomplete',
  template,
})
export class AuAutocompleteCustomElement<T = unknown> {
  @bindable({ set: identity }) public options: AutocompleteOption<T>[] = [];
  @bindable({ mode: BindingMode.twoWay }) public query = '';
  @bindable({ mode: BindingMode.twoWay, set: identity }) public selected: AutocompleteOption<T> | AutocompleteOption<T>[] | null = null;
  @bindable({ set: identity }) public search: AutocompleteSearch<T> | null = null;
  @bindable public multiple = false;
  @bindable public disabled = false;
  @bindable public minLength: number | null = null;
  @bindable public maxResults: number | null = null;
  @bindable public placeholder: string | null = null;
  @bindable public noResultsText: string | null = null;

  public results: AutocompleteOption<T>[] = [];
  public open = false;
  public activeIndex = 0;
  public placeholderText = '';
  public noResultsTextValue = '';

  private readonly host = resolve(INode) as HTMLElement;
  private readonly autocomplete = resolve(IAutocompleteService);
  private isBound = false;
  private searchVersion = 0;

  public get selectedItems(): AutocompleteOption<T>[] {
    if (Array.isArray(this.selected)) return this.selected;
    return this.selected ? [this.selected] : [];
  }

  public bound(): void {
    this.isBound = true;
    this.placeholderText = this.placeholder ?? this.autocomplete.options.placeholder;
    this.noResultsTextValue = this.noResultsText ?? this.autocomplete.options.noResultsText;
    void this.refresh();
  }

  public unbinding(): void {
    this.isBound = false;
    this.searchVersion++;
    this.closeList();
  }

  public queryChanged(): void {
    void this.refresh();
  }

  public optionsChanged(): void {
    void this.refresh();
  }

  public searchChanged(): void {
    void this.refresh();
  }

  public minLengthChanged(): void {
    void this.refresh();
  }

  public maxResultsChanged(): void {
    void this.refresh();
  }

  public selectedChanged(): void {
    if (this.multiple) void this.refresh();
  }

  public multipleChanged(): void {
    void this.refresh();
  }

  public disabledChanged(): void {
    if (this.disabled) this.closeList();
  }

  public placeholderChanged(): void {
    this.placeholderText = this.placeholder ?? this.autocomplete.options.placeholder;
  }

  public noResultsTextChanged(): void {
    this.noResultsTextValue = this.noResultsText ?? this.autocomplete.options.noResultsText;
  }

  public openList(): void {
    if (this.disabled) return;
    this.open = true;
    void this.refresh();
  }

  public closeList(): void {
    this.open = false;
    this.activeIndex = 0;
  }

  public onKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeList();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open = true;
      this.move(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.open = true;
      this.move(-1);
      return;
    }

    if (event.key === 'Enter' && this.open) {
      const option = this.results[this.activeIndex];
      if (option) {
        event.preventDefault();
        this.select(option);
      }
    }
  }

  public select(option: AutocompleteOption<T>): void {
    if (this.disabled || option.disabled) return;

    if (this.multiple) {
      const selected = this.selectedItems;
      if (!selected.some((entry) => entry.value === option.value)) {
        this.selected = [...selected, option];
      }
      this.query = '';
      this.open = true;
    } else {
      this.selected = option;
      this.query = option.label;
      this.closeList();
    }

    this.dispatch('autocomplete-select', { option, selected: this.selected });
  }

  public remove(option: AutocompleteOption<T>): void {
    if (this.disabled) return;
    if (!this.multiple) {
      this.selected = null;
      return;
    }

    this.selected = this.selectedItems.filter((entry) => entry.value !== option.value);
    this.dispatch('autocomplete-remove', { option, selected: this.selected });
  }

  private async refresh(): Promise<void> {
    if (!this.isBound) return;
    const version = ++this.searchVersion;
    const max = this.maxResults ?? this.autocomplete.options.maxResults;
    const min = this.minLength ?? this.autocomplete.options.minLength;
    const query = this.query;
    this.applyResults(this.autocomplete.filter(this.options, query, max, min));
    if (!this.search || query.trim().length < min) return;

    try {
      const searched = await this.search({ query, options: this.options });
      if (version === this.searchVersion) {
        this.applyResults(this.autocomplete.filter(searched, query, max, min));
      }
    } catch (error) {
      if (version === this.searchVersion) {
        this.host.dispatchEvent(new CustomEvent('autocomplete-search-error', {
          bubbles: true,
          detail: error,
        }));
      }
    }
  }

  private applyResults(results: AutocompleteOption<T>[]): void {
    if (this.multiple) {
      const selectedValues = new Set(this.selectedItems.map((item) => item.value));
      results = results.filter((option) => !selectedValues.has(option.value));
    }
    this.results = results;

    if (this.activeIndex >= this.results.length) {
      this.activeIndex = Math.max(0, this.results.length - 1);
    }
  }

  private move(delta: number): void {
    if (this.results.length === 0) return;
    this.activeIndex = (this.activeIndex + delta + this.results.length) % this.results.length;
  }

  private dispatch(name: string, detail: AutocompleteSelectDetail<T>): void {
    this.host.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      detail,
    }));
  }
}
